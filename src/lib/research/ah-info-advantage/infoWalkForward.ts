// AH INFORMATION ADVANTAGE RESEARCH — Chronological Walk-Forward Engine.
// Strict Walk-Forward: Train on seasons < S, test on season S. Zero shuffling.

import type { AhSide } from '../ah-yield/ahTypes';
import { settleAhBet } from '../ah-yield/ahSettlement';
import { ahExpectedValue } from '../ah-yield/ahFairOdds';
import {
  devigTwoWay,
  type AhCategoryProbabilities,
} from '../ah-edge/edgeProbability';

function calculateBinaryProbability(p: AhCategoryProbabilities): number {
  return p.pFullWin + p.pHalfWin;
}
import type {
  AblationModelId,
  EarlyVsClosingModelId,
  FeatureGroup,
  InfoBetPrediction,
  InfoMatch,
  MetricSummaryStats,
} from './infoTypes';
import {
  ABLATION_GROUPS_MAP,
  computeStats,
  predictMarketBaselineProbabilities,
  predictMatchProbabilities,
  trainPoissonGlm,
} from './infoModels';

export interface WalkForwardFold {
  foldIndex: number;
  testSeason: string;
  trainSeasons: string[];
  trainMatches: number;
  testMatches: number;
}

export interface WalkForwardRunResult {
  folds: WalkForwardFold[];
  predictionsByModel: Record<string, InfoBetPrediction[]>;
  statsByModel: Record<string, MetricSummaryStats>;
  baselinePredictions: InfoBetPrediction[];
  baselineStats: MetricSummaryStats;
}

function resolveOutcome(homeGoals: number, awayGoals: number, line: number, side: AhSide, odds: number): {
  outcome: string;
  categoryIndex: number;
  y: 0 | 1 | null;
  pnl: number;
} {
  const res = settleAhBet({
    side,
    line,
    homeScore: homeGoals,
    awayScore: awayGoals,
    odds,
    stake: 1,
  });
  let y: 0 | 1 | null = null;
  let categoryIndex = 2;
  switch (res.outcome) {
    case 'FULL_WIN':
      y = 1; categoryIndex = 0; break;
    case 'HALF_WIN':
      y = 1; categoryIndex = 1; break;
    case 'PUSH':
      y = null; categoryIndex = 2; break;
    case 'HALF_LOSS':
      y = 0; categoryIndex = 3; break;
    case 'FULL_LOSS':
      y = 0; categoryIndex = 4; break;
  }
  return { outcome: res.outcome, categoryIndex, y, pnl: res.pnl };
}

export function runInfoWalkForward(
  matches: InfoMatch[],
  modelDefs: { id: string; groups: FeatureGroup[]; snapshot: 'early' | 'closing' | 'movement_bridge' }[],
  evaluationSnapshot: 'early' | 'closing' = 'early',
  minTrainSeasons = 2
): WalkForwardRunResult {
  const allSeasons = Array.from(new Set(matches.map((m) => m.season))).sort();
  const folds: WalkForwardFold[] = [];
  const predictionsByModel: Record<string, InfoBetPrediction[]> = {};
  for (const mDef of modelDefs) predictionsByModel[mDef.id] = [];
  const baselinePredictions: InfoBetPrediction[] = [];

  for (let sIdx = minTrainSeasons; sIdx < allSeasons.length; sIdx++) {
    const testSeason = allSeasons[sIdx];
    const trainSeasons = allSeasons.slice(0, sIdx);

    const trainMatches = matches.filter((m) => trainSeasons.includes(m.season));
    const testMatches = matches.filter((m) => m.season === testSeason);

    if (trainMatches.length === 0 || testMatches.length === 0) continue;

    folds.push({
      foldIndex: folds.length,
      testSeason,
      trainSeasons,
      trainMatches: trainMatches.length,
      testMatches: testMatches.length,
    });

    // Train each model
    const trainedModels: Record<string, ReturnType<typeof trainPoissonGlm>> = {};
    for (const mDef of modelDefs) {
      trainedModels[mDef.id] = trainPoissonGlm(trainMatches, mDef.groups, mDef.snapshot);
    }

    // Predict on test season
    for (const m of testMatches) {
      const activeQuote = evaluationSnapshot === 'closing' ? m.closingAh : m.earlyAh;
      if (!activeQuote) continue;

      const targetLine = activeQuote.line;
      const closingQuote = m.closingAh;

      // Evaluate Market Baseline
      const baseProb = predictMarketBaselineProbabilities(m, targetLine, evaluationSnapshot);

      for (const side of ['home', 'away'] as const) {
        const isHome = side === 'home';
        const odds = isHome ? activeQuote.homeOdds : activeQuote.awayOdds;
        const oppOdds = isHome ? activeQuote.awayOdds : activeQuote.homeOdds;
        const closingOdds = closingQuote ? (isHome ? closingQuote.homeOdds : closingQuote.awayOdds) : null;
        const closingLine = closingQuote ? closingQuote.line : null;

        const effectiveLine = isHome ? targetLine : -targetLine;
        const outcome = resolveOutcome(m.homeGoals, m.awayGoals, effectiveLine, side, odds);

        const favStatus =
          effectiveLine > 0 ? 'underdog' : effectiveLine < 0 ? 'favorite' : odds < oppOdds ? 'favorite' : 'market_neutral';

        // CLV against Pinnacle closing
        let clv: number | null = null;
        if (closingOdds && closingLine === targetLine) {
          clv = odds / closingOdds - 1;
        }

        // Market baseline probabilities
        const baseCats = isHome ? baseProb.homeCats : baseProb.awayCats;
        const mktDevig = devigTwoWay(activeQuote.homeOdds, activeQuote.awayOdds);
        const mktBinaryP = isHome ? mktDevig.pA : mktDevig.pB;

        const baseEv = ahExpectedValue(baseCats, odds);

        const basePred: InfoBetPrediction = {
          canonicalId: m.canonicalId,
          matchDate: m.matchDate,
          season: m.season,
          leagueId: m.leagueId,
          side,
          line: effectiveLine,
          odds,
          oppositeOdds: oppOdds,
          closingOdds,
          closingLine,
          favoriteStatus: favStatus,
          actualOutcome: outcome.outcome,
          actualCategoryIndex: outcome.categoryIndex,
          y: outcome.y,
          pnl: outcome.pnl,
          modelId: 'market_baseline',
          probabilities: baseCats,
          modelBinaryProbability: calculateBinaryProbability(baseCats),
          marketBinaryProbability: mktBinaryP,
          modelEv: baseEv,
          clv,
          movementPattern: m.movementPattern,
        };
        baselinePredictions.push(basePred);

        // Evaluate candidate models
        for (const mDef of modelDefs) {
          const tModel = trainedModels[mDef.id];
          const probs = predictMatchProbabilities(tModel, m, targetLine, mDef.snapshot);
          const cats = isHome ? probs.homeCats : probs.awayCats;
          const ev = ahExpectedValue(cats, odds);
          const binaryP = calculateBinaryProbability(cats);

          const pred: InfoBetPrediction = {
            canonicalId: m.canonicalId,
            matchDate: m.matchDate,
            season: m.season,
            leagueId: m.leagueId,
            side,
            line: effectiveLine,
            odds,
            oppositeOdds: oppOdds,
            closingOdds,
            closingLine,
            favoriteStatus: favStatus,
            actualOutcome: outcome.outcome,
            actualCategoryIndex: outcome.categoryIndex,
            y: outcome.y,
            pnl: outcome.pnl,
            modelId: mDef.id,
            probabilities: cats,
            modelBinaryProbability: binaryP,
            marketBinaryProbability: mktBinaryP,
            modelEv: ev,
            clv,
            movementPattern: m.movementPattern,
          };
          predictionsByModel[mDef.id].push(pred);
        }
      }
    }
  }

  const baselineStats = computeStats(baselinePredictions);
  const statsByModel: Record<string, MetricSummaryStats> = {};
  for (const mDef of modelDefs) {
    statsByModel[mDef.id] = computeStats(predictionsByModel[mDef.id], baselinePredictions);
  }

  return {
    folds,
    predictionsByModel,
    statsByModel,
    baselinePredictions,
    baselineStats,
  };
}
