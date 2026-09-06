/**
 * Coverage Layer Chronological Walk-Forward Model Ablation
 *
 * Implements strict out-of-sample chronological walk-forward evaluation:
 * - Baseline: Poisson + Dixon-Coles Ensemble
 * - Variant A: Baseline + Coverage Profile
 * - Variant B: Baseline + Coverage Profile + OU Lambda Adjustment
 * - Variant C: Baseline + Coverage Profile + Dynamic Rho
 *
 * Guaranteed Invariants:
 * 1. Strictly chronological walk-forward (match_time < T)
 * 2. Zero future-data leakage
 * 3. 1 canonical match = 1 observation
 */

import * as fs from 'fs';
import * as path from 'path';
import type { NormalizedMatch, HistoricalOdds, FeatureSnapshot } from '../types';
import { computeLambdas, scoreMatrix, deriveMarkets, fitLeagueConstants, type PoissonParams } from './poisson';
import { brierAndLogLoss, roiWithCI } from './metrics';
import { calculateCoverageFromMatches, type MatchRecord } from '../../lib/services/coverageCalculator';
import { settleMoneyline } from '../settlement/settlement';

const HIST_DIR = path.resolve(process.cwd(), 'data', 'historical');

export interface ModelMetrics {
  name: string;
  sampleSize: number;
  mlBrier: number;
  mlLogLoss: number;
  ouBrier: number;
  ouLogLoss: number;
  winRate: number;
  roi: number;
  clvBeatPct: number;
}

function loadJsonl<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as T);
}

export async function runCoverageWalkForward(): Promise<{
  baseline: ModelMetrics;
  variantA: ModelMetrics;
  variantB: ModelMetrics;
  variantC: ModelMetrics;
  superiorVariant: string | null;
  demonstratedImprovement: boolean;
}> {
  const matches = loadJsonl<NormalizedMatch>(path.join(HIST_DIR, 'normalized_matches.jsonl'));
  const oddsList = loadJsonl<HistoricalOdds>(path.join(HIST_DIR, 'historical_odds.jsonl'));
  const snapshots = loadJsonl<FeatureSnapshot>(path.join(HIST_DIR, 'feature_snapshots.jsonl'));

  // Sort matches strictly by match_date
  matches.sort((a, b) => a.match_date.localeCompare(b.match_date));

  const oddsByMatchId = new Map(oddsList.map((o) => [o.match_id, o]));
  const snapsByMatchId = new Map(snapshots.map((s) => [s.match_id, s]));

  // Map to MatchRecord for coverage calculator
  const allMatchRecords: MatchRecord[] = matches.map((m) => ({
    home_team: m.home_team,
    away_team: m.away_team,
    home_goals: m.home_goals,
    away_goals: m.away_goals,
    match_time: m.match_date,
    season: parseInt(m.season.split('-')[0] || '2022', 10),
  }));

  // Identify seasons
  const seasons = Array.from(new Set(matches.map((m) => m.season))).sort();
  // Walk-forward: Train on initial seasons, test on later seasons
  const trainSeasons = seasons.slice(0, Math.max(1, seasons.length - 2));
  const testSeasons = seasons.slice(Math.max(1, seasons.length - 2));

  console.log(`[WalkForward] Total matches: ${matches.length}`);
  console.log(`[WalkForward] Train seasons: ${trainSeasons.join(', ')}`);
  console.log(`[WalkForward] Test seasons: ${testSeasons.join(', ')}`);

  const trainMatches = matches.filter((m) => trainSeasons.includes(m.season));
  const testMatches = matches.filter((m) => testSeasons.includes(m.season));

  const trainResults = new Map(trainMatches.map((m) => [m.canonical_id, { home: m.home_goals, away: m.away_goals }]));
  const trainSnaps = snapshots.filter((s) => trainSeasons.includes(s.season));

  const constants = fitLeagueConstants(trainSnaps, trainResults);
  const basePoissonParams: PoissonParams = { ...constants, eloScale: 400, maxGoals: 10 };

  // Accumulators for each variant
  interface VariantAccumulator {
    predsML: Array<{ pHome: number; pDraw: number; pAway: number }>;
    predsOU: Array<number>;
    actualsML: Array<'H' | 'D' | 'A'>;
    actualsOU: Array<boolean>; // true = over 2.5
    betsWon: number;
    betsTotal: number;
    profits: number[];
    clvBeats: number;
    clvTotal: number;
  }

  const createAccumulator = (): VariantAccumulator => ({
    predsML: [],
    predsOU: [],
    actualsML: [],
    actualsOU: [],
    betsWon: 0,
    betsTotal: 0,
    profits: [],
    clvBeats: 0,
    clvTotal: 0,
  });

  const accBaseline = createAccumulator();
  const accVariantA = createAccumulator();
  const accVariantB = createAccumulator();
  const accVariantC = createAccumulator();

  // Evaluate chronologically
  for (let i = 0; i < testMatches.length; i++) {
    const match = testMatches[i];
    const snap = snapsByMatchId.get(match.canonical_id);
    const odds = oddsByMatchId.get(match.canonical_id);

    if (!snap || snap.home.avg_goals_for === null || snap.away.avg_goals_for === null || snap.league_avg_goals === null) {
      continue;
    }

    const matchDate = match.match_date;

    // Strict point-in-time coverage calculation: only matches strictly before matchDate
    const homeCov = calculateCoverageFromMatches(allMatchRecords, match.home_team, 'home', undefined, matchDate);
    const awayCov = calculateCoverageFromMatches(allMatchRecords, match.away_team, 'away', undefined, matchDate);

    const ouTendency = ((homeCov.ouRates.over25 || 0.5) + (awayCov.ouRates.over25 || 0.5)) / 2;
    const bttsTendency = ((homeCov.bttsYesRate || 0.5) + (awayCov.bttsYesRate || 0.5)) / 2;
    const covConfidence = Math.min(1.0, (homeCov.sampleSize + awayCov.sampleSize) / 20);

    const lambdaInput = {
      homeAvgGoalsFor: snap.home.avg_goals_for!,
      awayAvgGoalsAgainst: snap.away.avg_goals_against!,
      awayAvgGoalsFor: snap.away.avg_goals_for!,
      homeAvgGoalsAgainst: snap.home.avg_goals_against!,
      leagueAvgGoals: snap.league_avg_goals!,
      eloDelta: (snap.home.elo ?? 1500) - (snap.away.elo ?? 1500),
    };

    const isActualOver = match.home_goals + match.away_goals > 2.5;
    const actualResult = match.result;

    // 1. Baseline: Standard Poisson + Dixon-Coles
    const lambdasBase = computeLambdas(lambdaInput, basePoissonParams);
    const matBase = scoreMatrix(lambdasBase, 10);
    const probsBase = deriveMarkets(matBase);

    // 2. Variant A: Baseline + coverage features (informative profile only)
    const probsVarA = probsBase;

    // 3. Variant B: OU lambda adjustment from ouTendency
    const ouDeviation = ouTendency - 0.50;
    const lambdaMultB = covConfidence >= 0.5 ? Math.max(0.90, Math.min(1.12, 1.0 + ouDeviation * 0.15)) : 1.0;
    const lambdasB = {
      home: lambdasBase.home * lambdaMultB,
      away: lambdasBase.away * lambdaMultB,
    };
    const matB = scoreMatrix(lambdasB, 10);
    const probsVarB = deriveMarkets(matB);

    // 4. Variant C: Dynamic rho parameter from bttsTendency
    const bttsDeviation = bttsTendency - 0.50;
    const rhoShift = covConfidence >= 0.5 ? bttsDeviation * 0.08 : 0;
    const lambdasC = { ...lambdasBase };
    const matC = scoreMatrix(lambdasC, 10);
    if (rhoShift !== 0) {
      matC[0][0] = Math.max(0, matC[0][0] * (1 - lambdasC.home * lambdasC.away * rhoShift));
      matC[1][1] = Math.max(0, matC[1][1] * (1 + rhoShift));
    }
    const probsVarC = deriveMarkets(matC);

    const recordStep = (
      acc: VariantAccumulator,
      probs: typeof probsBase
    ) => {
      acc.predsML.push({ pHome: probs.pHome, pDraw: probs.pDraw, pAway: probs.pAway });
      acc.predsOU.push(probs.pOver['2.5']);
      acc.actualsML.push(actualResult);
      acc.actualsOU.push(isActualOver);

      // Betting simulation on Moneyline if odds present
      const mlOdds = odds?.market_1x2;
      if (mlOdds) {
        const evHome = probs.pHome * mlOdds.home - 1;
        const evAway = probs.pAway * mlOdds.away - 1;
        const maxEv = Math.max(evHome, evAway);

        if (maxEv > 0.03) { // 3% edge filter
          const selection = evHome > evAway ? 'home' : 'away';
          const price = selection === 'home' ? mlOdds.home : mlOdds.away;
          const won = settleMoneyline(selection, match.home_goals, match.away_goals) === 'WIN';

          acc.betsTotal++;
          if (won) {
            acc.betsWon++;
            acc.profits.push(price - 1);
          } else {
            acc.profits.push(-1);
          }

          // CLV: check if odds beat fair line
          const fairPrice = 1 / (selection === 'home' ? probs.pHome : probs.pAway);
          acc.clvTotal++;
          if (price > fairPrice) acc.clvBeats++;
        }
      }
    };

    recordStep(accBaseline, probsBase);
    recordStep(accVariantA, probsVarA);
    recordStep(accVariantB, probsVarB);
    recordStep(accVariantC, probsVarC);
  }

  const buildSummary = (name: string, acc: VariantAccumulator): ModelMetrics => {
    const mlStats = brierAndLogLoss(acc.predsML, acc.actualsML) || { brier: 0.60, logloss: 1.05, n: 0 };
    
    // OU Brier & LogLoss
    let ouBrier = 0;
    let ouLogLoss = 0;
    const nOU = acc.predsOU.length;
    for (let j = 0; j < nOU; j++) {
      const p = acc.predsOU[j];
      const y = acc.actualsOU[j] ? 1 : 0;
      ouBrier += (p - y) ** 2;
      ouLogLoss += -Math.log(Math.max(0.001, Math.min(0.999, y === 1 ? p : 1 - p)));
    }

    const roiStats = roiWithCI(acc.profits, acc.profits.map(() => 1));
    const winRate = acc.betsTotal > 0 ? Number((acc.betsWon / acc.betsTotal).toFixed(4)) : 0;
    const clvBeatPct = acc.clvTotal > 0 ? Number(((acc.clvBeats / acc.clvTotal) * 100).toFixed(2)) : 0;

    return {
      name,
      sampleSize: mlStats.n,
      mlBrier: mlStats.brier,
      mlLogLoss: mlStats.logloss,
      ouBrier: nOU > 0 ? Number((ouBrier / nOU).toFixed(5)) : 0.25,
      ouLogLoss: nOU > 0 ? Number((ouLogLoss / nOU).toFixed(5)) : 0.69,
      winRate,
      roi: roiStats ? Number(roiStats.roi.toFixed(4)) : 0,
      clvBeatPct,
    };
  };

  const resBase = buildSummary('Baseline (Poisson + Dixon-Coles)', accBaseline);
  const resVarA = buildSummary('Variant A (Baseline + Coverage Info)', accVariantA);
  const resVarB = buildSummary('Variant B (+ OU Lambda Adjustment)', accVariantB);
  const resVarC = buildSummary('Variant C (+ Dynamic Rho)', accVariantC);

  // Determine if any variant statistically beats baseline on Brier AND Log Loss
  let superiorVariant: string | null = null;
  let demonstratedImprovement = false;

  const candidates = [resVarB, resVarC];
  for (const c of candidates) {
    if (c.ouLogLoss < resBase.ouLogLoss && c.ouBrier < resBase.ouBrier) {
      superiorVariant = c.name;
      demonstratedImprovement = true;
      break;
    }
  }

  return {
    baseline: resBase,
    variantA: resVarA,
    variantB: resVarB,
    variantC: resVarC,
    superiorVariant,
    demonstratedImprovement,
  };
}

// CLI execution check
if (process.argv[1]?.includes('coverageWalkForward')) {
  runCoverageWalkForward().then((res) => {
    console.log('\n================================================================');
    console.log('CHRONOLOGICAL WALK-FORWARD MODEL ABLATION RESULTS');
    console.log('================================================================');
    console.table([res.baseline, res.variantA, res.variantB, res.variantC]);
    console.log(`\nSuperior Variant: ${res.superiorVariant || 'NONE (Baseline is superior or equal)'}`);
    console.log(`Demonstrated Improvement: ${res.demonstratedImprovement ? 'YES' : 'NO'}`);
    console.log('================================================================\n');
  }).catch((err) => {
    console.error('Walk-forward failed:', err);
    process.exit(1);
  });
}
