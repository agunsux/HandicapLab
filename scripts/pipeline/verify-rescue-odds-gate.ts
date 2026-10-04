import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env', override: false });

import { getBatchedFixtureOdds, primeTournamentOdds } from '../../src/lib/pipeline/tournamentOddsBatch';
import { RescueMathEngine } from '../../src/lib/pipeline/rescue/mathEngine';
import { ConfidenceGateSystem } from '../../src/lib/pipeline/confidenceGate';
import { RescueOddsSnapshot, RescuePredictionRecord } from '../../src/lib/pipeline/rescue/types';

const MARKETS_DICT = path.resolve('data/cache/oddspapi_markets_raw.json');
const rawMarkets = JSON.parse(fs.readFileSync(MARKETS_DICT, 'utf8')) as any[];
const marketMap = new Map<number, any>(rawMarkets.map((m) => [m.marketId, m]));

async function verifyRealOddsConfidenceGate() {
  await primeTournamentOdds({
    tournamentIds: [20560],
    bookmakers: ['pinnacle'],
  });

  const fixtureId = 'id1002056073929298';
  const data = getBatchedFixtureOdds(fixtureId);
  if (!data || !data.bookmakerOdds?.pinnacle) {
    console.error('Fixture odds not found in batch cache.');
    return;
  }

  const pinnacle = data.bookmakerOdds.pinnacle;
  const executedAt = new Date().toISOString();

  // Poisson Grid for Barito Putera vs Persela Lamongan
  const grid = RescueMathEngine.buildScoreGrid(1.5, 1.1);

  // Extract real Pinnacle AH -0.5 line
  let realAhSnapshot: RescueOddsSnapshot | null = null;
  let realAhOdds: number | null = null;
  let ahTimestamp: string = executedAt;

  for (const [mIdStr, mData] of Object.entries<any>(pinnacle.markets)) {
    const mId = Number(mIdStr);
    const meta = marketMap.get(mId);
    if (meta && meta.sportId === 10 && meta.period === 'fulltime' && meta.marketName === 'Asian Handicap' && meta.handicap === -0.5) {
      const outcomes = mData.outcomes || {};
      for (const outMeta of meta.outcomes || []) {
        const outData = outcomes[String(outMeta.outcomeId)];
        const p = outData?.players?.['0'];
        if (p && typeof p.price === 'number') {
          const name = String(outMeta.outcomeName).toLowerCase();
          if (name === '1' || name === 'home') {
            realAhOdds = p.price;
            if (p.changedAt) ahTimestamp = p.changedAt;
            realAhSnapshot = {
              snapshot_id: crypto.randomUUID(),
              fixture_id: 1002056,
              bookmaker: 'pinnacle',
              market: 'AH',
              line: -0.5,
              odds: realAhOdds!,
              timestamp: ahTimestamp,
              source: 'oddspapi',
            };
          }
        }
      }
    }
  }

  console.log('=== REAL PINNACLE ODDS SNAPSHOT ===');
  console.log(realAhSnapshot);

  if (!realAhSnapshot || !realAhOdds) {
    console.error('Real AH odds could not be extracted');
    return;
  }

  // Evaluate through RescueMathEngine
  const evalResult = RescueMathEngine.evaluateAsianHandicap(grid, -0.5, 'HOME');
  const edgePct = Number(((evalResult.pEffectiveWin - 1 / realAhOdds) * 100).toFixed(2));
  const ev = RescueMathEngine.calculateEv(
    evalResult.pFullWin,
    evalResult.pHalfWin,
    evalResult.pHalfLoss,
    evalResult.pFullLoss,
    realAhOdds
  );

  console.log('\n=== MODEL EVALUATION & EV WITH REAL PINNACLE ODDS ===');
  console.log({
    line: -0.5,
    pEffectiveWin: evalResult.pEffectiveWin,
    realMarketOdds: realAhOdds,
    impliedProb: Number((1 / realAhOdds).toFixed(4)),
    edgePct,
    ev,
  });

  // Evaluate through ConfidenceGateSystem
  const gateResult = ConfidenceGateSystem.evaluate({
    canonicalMatchId: String(fixtureId),
    fixtureId: String(fixtureId),
    match: 'Barito Putera vs Persela Lamongan',
    homeTeam: 'Barito Putera',
    awayTeam: 'Persela Lamongan',
    competition: 'Liga 2 Indonesia',
    kickoffUtc: executedAt,
    market: 'AH',
    selection: 'HOME -0.5',
    line: -0.5,
    odds: realAhOdds,
    modelProbability: evalResult.pEffectiveWin,
    calibratedProbability: evalResult.pEffectiveWin,
    predictionTimestampUtc: executedAt,
    oddsTimestampUtc: ahTimestamp,
    modelVersion: 'poisson_v1_rescue',
    sampleSizeHome: 8,
    sampleSizeAway: 8,
    modelValidated: true,
  });

  console.log('\n=== CONFIDENCE GATE SYSTEM DECISION ===');
  console.log(gateResult);

  const isPick = gateResult.qualified && gateResult.isHighConfidence;
  console.log(`\nPromoted to Pick: ${isPick} (Status: ${gateResult.status}, Verdict: ${gateResult.verdict}, Rejection: ${gateResult.rejectionReasons?.join('; ')})`);
}

verifyRealOddsConfidenceGate().catch(console.error);
