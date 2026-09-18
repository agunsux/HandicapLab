/**
 * REAL MARKET YIELD AUDIT — DISCOVERY RUNNER
 * Location: scripts/research/run-real-market-discovery.ts
 *
 * Evaluates the complete frozen 140-hypothesis family on the Discovery period
 * (seasons 2015-2016 through 2020-2021) using Pinnacle Opening odds.
 *
 * Implements Benjamini-Hochberg FDR correction (q <= 0.10) and freezes
 * the deterministic candidate set into REAL_MARKET_YIELD_DISCOVERY.json.
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import crypto from 'crypto';
import {
  StrictWalkForwardAdapter,
  AuditablePrediction,
} from '../../src/lib/research/real-yield/walkForwardAdapter';
import {
  SelectionSettlementEngine,
  PinnacleMarketOdds,
  ExecutableBet,
} from '../../src/lib/research/real-yield/selectionSettlement';
import {
  PreregistrationBuilder,
  RealMarketYieldPreregistration,
  PreregisteredHypothesis,
} from '../../src/lib/research/real-yield/preregistration';
import {
  computeBootstrapCi,
  computeRawPValue,
  applyBenjaminiHochberg,
  HypothesisEvaluationStats,
} from '../../src/lib/research/real-yield/statistics';
import { CanonicalMatch, FittedLeagueModel } from '../../src/lib/research/model-a/types';

export interface DiscoveryArtifact {
  schemaVersion: string;
  runId: string;
  executedAt: string;
  datasetHash: string;
  familyHash: string;
  discoveryPeriod: string[];
  bookmaker: string;
  priceObservation: string;
  minEvThreshold: number;
  totalHypothesesEvaluated: number;
  candidateSelectionRule: {
    minBets: number;
    requirePositiveRoi: boolean;
    maxRawPValue: number;
    maxFdrQValue: number;
  };
  totalCandidatesDiscovered: number;
  candidateIds: string[];
  candidates: HypothesisEvaluationStats[];
  allHypotheses: HypothesisEvaluationStats[];
}

export async function runRealMarketDiscovery(): Promise<DiscoveryArtifact> {
  const preregPath = path.resolve(
    process.cwd(),
    'data/verification/REAL_MARKET_YIELD_PREREGISTRATION.json'
  );
  if (!fs.existsSync(preregPath)) {
    throw new Error(`[BLOCK] Preregistration artifact not found at ${preregPath}`);
  }

  const prereg = JSON.parse(fs.readFileSync(preregPath, 'utf-8')) as RealMarketYieldPreregistration;

  // 1. Pre-execution hash verifications
  const { familyHash, ...basePayload } = prereg;
  const computedFamilyHash = PreregistrationBuilder.computeFamilyHash(basePayload as any);
  if (computedFamilyHash !== familyHash) {
    throw new Error(
      `[BLOCK] Family hash mismatch! Committed: ${familyHash}, Computed: ${computedFamilyHash}`
    );
  }

  const { combinedHash } = StrictWalkForwardAdapter.verifyFrozenGoldChecksum();
  if (combinedHash !== prereg.datasetHash) {
    throw new Error(
      `[BLOCK] Gold dataset hash mismatch! Expected: ${prereg.datasetHash}, Got: ${combinedHash}`
    );
  }

  // 2. Load canonical matches
  const allMatches = await StrictWalkForwardAdapter.loadCanonicalMatches();

  // Filter discovery cohort
  const discoverySeasons = new Set(prereg.discoveryPeriod);
  const discoveryMatches = allMatches.filter((m) => discoverySeasons.has(m.season));

  console.log(`Loaded ${allMatches.length} total matches.`);
  console.log(`Discovery cohort size: ${discoveryMatches.length} matches across seasons:`, prereg.discoveryPeriod);

  // 3. Load Pinnacle opening odds
  const oddsPath = path.resolve(process.cwd(), 'data/golden/europe/market_odds.jsonl');
  const oddsByMatch = new Map<string, PinnacleMarketOdds>();

  const oddsRl = readline.createInterface({
    input: fs.createReadStream(oddsPath, 'utf-8'),
    crlfDelay: Infinity,
  });

  for await (const line of oddsRl) {
    if (!line.trim()) continue;
    const o = JSON.parse(line);
    if (o.bookmaker_source !== 'pinnacle' || o.observation !== 'opening') continue;

    let matchOdds = oddsByMatch.get(o.canonical_id);
    if (!matchOdds) {
      matchOdds = {
        canonical_id: o.canonical_id,
        league_id: o.league_id,
        season: o.season,
        match_date: o.match_date,
      };
      oddsByMatch.set(o.canonical_id, matchOdds);
    }

    if (o.market === 'AH' && typeof o.line === 'number') {
      matchOdds.ah = {
        line: o.line,
        home_odds: o.home_odds,
        away_odds: o.away_odds,
      };
    } else if (o.market === 'OU' && o.line === 2.5) {
      matchOdds.ou = {
        line: 2.5,
        over_odds: o.over_odds,
        under_odds: o.under_odds,
      };
    } else if (o.market === 'ML') {
      matchOdds.ml = {
        home_odds: o.home_odds,
        draw_odds: o.draw_odds,
        away_odds: o.away_odds,
      };
    }
  }

  console.log(`Indexed Pinnacle opening odds for ${oddsByMatch.size} fixtures.`);

  // 4. Generate walk-forward predictions and executable bets
  const modelCache = new Map<string, FittedLeagueModel>();
  const allSelectedBets: ExecutableBet[] = [];

  console.log('Generating walk-forward predictions and selecting bets for discovery cohort...');
  for (let i = 0; i < discoveryMatches.length; i++) {
    const fixture = discoveryMatches[i];
    const pred = StrictWalkForwardAdapter.predictFixture(fixture, allMatches, modelCache);
    const odds = oddsByMatch.get(fixture.canonicalId);

    if (odds) {
      const bets = SelectionSettlementEngine.selectBetsForFixture(
        pred,
        odds,
        prereg.selectionRule.minEvThreshold
      );
      allSelectedBets.push(...bets);
    }
  }

  console.log(`Selected total ${allSelectedBets.length} executable bets across Discovery period.`);

  // 5. Evaluate all 140 hypotheses
  const oddsBandsMap = new Map(prereg.oddsBands.map((b) => [b.bandKey, b]));

  function isOddsInBand(odds: number, bandKey: string): boolean {
    const spec = oddsBandsMap.get(bandKey);
    if (!spec) return false;
    const minOk = spec.inclusiveMin ? odds >= spec.minOdds : odds > spec.minOdds;
    const maxOk = spec.inclusiveMax ? odds <= spec.maxOdds : odds < spec.maxOdds;
    return minOk && maxOk;
  }

  const rawHypothesisStats: Omit<HypothesisEvaluationStats, 'fdrAdjustedQValue' | 'fdrPass' | 'isCandidate'>[] = [];

  for (const hyp of prereg.hypotheses) {
    // Filter bets matching this hypothesis
    const matchingBets = allSelectedBets.filter((b) => {
      if (b.market !== hyp.market) return false;
      if (!isOddsInBand(b.decimalOdds, hyp.oddsBand)) return false;

      if (hyp.market === '1X2') {
        if (hyp.targetKey === '1X2_ALL') return true;
        return b.outcomeSelection === hyp.targetKey;
      }

      if (hyp.market === 'OU_2_5') {
        if (hyp.targetKey === 'OU_ALL') return true;
        return b.outcomeSelection === hyp.targetKey;
      }

      if (hyp.market === 'AH') {
        if (hyp.targetKey === 'AH_ALL') return true;
        if (hyp.targetKey === 'AH_FAVOURITE') return b.line !== null && b.line < 0;
        if (hyp.targetKey === 'AH_UNDERDOG') return b.line !== null && b.line > 0;
        if (hyp.targetKey === 'AH_LEVEL') return b.line !== null && b.line === 0;
        if (hyp.targetType === 'INDIVIDUAL_LINE') {
          return b.line !== null && Math.abs(b.line - hyp.line!) < 1e-4;
        }
      }

      return false;
    });

    const betsCount = matchingBets.length;
    let winsCount = 0;
    let lossesCount = 0;
    let pushesCount = 0;
    let halfWinsCount = 0;
    let halfLossesCount = 0;
    let totalStake = 0;
    let totalProfit = 0;
    let sumOdds = 0;
    let sumProb = 0;
    let sumEv = 0;

    const pnlList: number[] = [];
    const stakeList: number[] = [];

    for (const b of matchingBets) {
      totalStake += b.stake;
      totalProfit += b.pnl;
      sumOdds += b.decimalOdds;
      sumProb += b.modelProbability;
      sumEv += b.expectedValue;

      pnlList.push(b.pnl);
      stakeList.push(b.stake);

      if (b.outcome === 'WIN') winsCount++;
      else if (b.outcome === 'LOSS') lossesCount++;
      else if (b.outcome === 'PUSH') pushesCount++;
      else if (b.outcome === 'HALF_WIN') halfWinsCount++;
      else if (b.outcome === 'HALF_LOSS') halfLossesCount++;
    }

    const realizedRoi = totalStake > 0 ? Number((totalProfit / totalStake).toFixed(6)) : 0;
    const meanReturn = betsCount > 0 ? Number((totalProfit / betsCount).toFixed(6)) : 0;
    const meanOdds = betsCount > 0 ? Number((sumOdds / betsCount).toFixed(4)) : 0;
    const meanModelProbability = betsCount > 0 ? Number((sumProb / betsCount).toFixed(4)) : 0;
    const meanEv = betsCount > 0 ? Number((sumEv / betsCount).toFixed(4)) : 0;

    // Bootstrap CI (1000 iterations, seed 0x5eed)
    const { ci95, probabilityPositive } = computeBootstrapCi(
      pnlList,
      stakeList,
      prereg.bootstrap.iterations,
      prereg.bootstrap.seed
    );

    // Raw p-value for H0: mean return <= 0
    const rawPValue = computeRawPValue(pnlList);

    rawHypothesisStats.push({
      hypothesisId: hyp.id,
      market: hyp.market,
      targetKey: hyp.targetKey,
      oddsBand: hyp.oddsBand,
      eligibleObservations: matchingBets.length, // executable bets evaluated
      betsCount,
      winsCount,
      lossesCount,
      pushesCount,
      halfWinsCount,
      halfLossesCount,
      totalStake: Number(totalStake.toFixed(2)),
      totalProfit: Number(totalProfit.toFixed(2)),
      realizedRoi,
      meanReturn,
      meanOdds,
      meanModelProbability,
      meanEv,
      bootstrapCi95: ci95,
      probabilityPositiveRoi: probabilityPositive,
      rawPValue: Number(rawPValue.toFixed(6)),
    });
  }

  // 6. Benjamini-Hochberg FDR correction across all 140 hypotheses
  const fdrCorrected = applyBenjaminiHochberg(rawHypothesisStats, prereg.multipleTesting.fdrQ);

  // 7. Deterministic candidate selection rule:
  // - betsCount >= 50
  // - realizedRoi > 0
  // - rawPValue <= 0.05
  // - fdrPass === true (q <= 0.10)
  const candidateSelectionRule = {
    minBets: 50,
    requirePositiveRoi: true,
    maxRawPValue: 0.05,
    maxFdrQValue: prereg.multipleTesting.fdrQ,
  };

  const allHypotheses: HypothesisEvaluationStats[] = fdrCorrected.map((h) => {
    const isCandidate =
      h.betsCount >= candidateSelectionRule.minBets &&
      h.realizedRoi > 0 &&
      h.rawPValue <= candidateSelectionRule.maxRawPValue &&
      h.fdrPass === true;

    return {
      ...h,
      isCandidate,
    };
  });

  const candidates = allHypotheses.filter((h) => h.isCandidate);
  const candidateIds = candidates.map((c) => c.hypothesisId);

  const runId = `discovery-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const artifact: DiscoveryArtifact = {
    schemaVersion: 'real-market-yield-discovery-v1',
    runId,
    executedAt: new Date().toISOString(),
    datasetHash: prereg.datasetHash,
    familyHash: prereg.familyHash,
    discoveryPeriod: prereg.discoveryPeriod,
    bookmaker: prereg.bookmaker,
    priceObservation: prereg.priceObservation,
    minEvThreshold: prereg.selectionRule.minEvThreshold,
    totalHypothesesEvaluated: allHypotheses.length,
    candidateSelectionRule,
    totalCandidatesDiscovered: candidates.length,
    candidateIds,
    candidates,
    allHypotheses,
  };

  // 8. Freeze discovery artifact to disk
  const outPath = path.resolve(
    process.cwd(),
    'data/verification/REAL_MARKET_YIELD_DISCOVERY.json'
  );
  fs.writeFileSync(outPath, JSON.stringify(artifact, null, 2), 'utf-8');

  console.log(`Saved discovery artifact to ${outPath}`);
  console.log(`Total Hypotheses: ${allHypotheses.length}`);
  console.log(`Total Candidates Discovered: ${candidates.length}`);

  return artifact;
}

if (require.main === module || process.argv[1]?.includes('run-real-market-discovery')) {
  runRealMarketDiscovery().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

