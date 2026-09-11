// AH EDGE ENGINE — Experiments: breakdowns, ablation, league generalization.

import type { AhSide } from '../ah-yield/ahTypes';
import { trainEdgeModel } from './edgeModels';
import {
  computeGroupMetrics,
  predictTestSeason,
  runEdgeWalkForward,
  type EdgeWalkForwardConfig,
  type GroupMetrics,
} from './edgeWalkForward';
import type { EdgeBetPrediction, EdgeMatch, EdgeModelConfig, EdgeModelId, FeatureGroup } from './edgeTypes';
import { ALL_FEATURE_GROUPS } from './edgeTypes';

// ─────────────────────────────── Breakdowns ───────────────────────────────

export interface BreakdownRow {
  key: string;
  modelId: string;
  metrics: GroupMetrics;
}

export function breakdownByLine(
  predictionsByModel: Record<string, EdgeBetPrediction[]>,
  modelIds: string[]
): BreakdownRow[] {
  const out: BreakdownRow[] = [];
  for (const modelId of modelIds) {
    const rows = predictionsByModel[modelId] ?? [];
    const byLine = new Map<number, EdgeBetPrediction[]>();
    for (const r of rows) {
      const list = byLine.get(r.line);
      if (list) list.push(r);
      else byLine.set(r.line, [r]);
    }
    for (const [line, list] of byLine) {
      out.push({ key: String(line), modelId, metrics: computeGroupMetrics(modelId, list) });
    }
  }
  out.sort((a, b) => a.modelId.localeCompare(b.modelId) || Number(a.key) - Number(b.key));
  return out;
}

export function breakdownByFavorite(
  predictionsByModel: Record<string, EdgeBetPrediction[]>,
  modelIds: string[]
): BreakdownRow[] {
  const out: BreakdownRow[] = [];
  for (const modelId of modelIds) {
    const rows = predictionsByModel[modelId] ?? [];
    const byKey = new Map<string, EdgeBetPrediction[]>();
    for (const r of rows) {
      const list = byKey.get(r.favoriteStatus);
      if (list) list.push(r);
      else byKey.set(r.favoriteStatus, [r]);
    }
    for (const [key, list] of byKey) {
      out.push({ key, modelId, metrics: computeGroupMetrics(modelId, list) });
    }
  }
  out.sort((a, b) => a.modelId.localeCompare(b.modelId) || a.key.localeCompare(b.key));
  return out;
}

export function breakdownByLeague(
  predictionsByModel: Record<string, EdgeBetPrediction[]>,
  modelIds: string[]
): BreakdownRow[] {
  const out: BreakdownRow[] = [];
  for (const modelId of modelIds) {
    const rows = predictionsByModel[modelId] ?? [];
    const byKey = new Map<string, EdgeBetPrediction[]>();
    for (const r of rows) {
      const list = byKey.get(r.leagueId);
      if (list) list.push(r);
      else byKey.set(r.leagueId, [r]);
    }
    for (const [key, list] of byKey) {
      out.push({ key, modelId, metrics: computeGroupMetrics(modelId, list) });
    }
  }
  out.sort((a, b) => a.modelId.localeCompare(b.modelId) || a.key.localeCompare(b.key));
  return out;
}

// ─────────────────────────────── Ablation ───────────────────────────────

export interface AblationRow {
  groups: FeatureGroup[];
  modelId: EdgeModelId;
  bets: number;
  brier: number | null;
  logLoss: number | null;
  fiveClassLogLoss: number | null;
  evPositiveBets: number;
  evPositiveRoi: number;
  evPositiveCi95: [number, number];
  marketBrier: number | null;
  vsMarketDiff: number | null;
  vsMarketCi95: [number, number] | null;
}

export const CUMULATIVE_FEATURE_GROUPS: FeatureGroup[][] = [
  ['market'],
  ['market', 'form'],
  ['market', 'form', 'rest'],
  ['market', 'form', 'rest', 'elo'],
  [...ALL_FEATURE_GROUPS],
];

export function runFeatureAblation(
  dataset: EdgeMatch[],
  options: {
    modelId?: EdgeModelId;
    featureSets?: FeatureGroup[][];
    epochs?: number;
    minTrainSeasons?: number;
  } = {}
): AblationRow[] {
  const modelId = options.modelId ?? 'poisson_glm';
  const featureSets = options.featureSets ?? CUMULATIVE_FEATURE_GROUPS;
  const out: AblationRow[] = [];

  for (const groups of featureSets) {
    const config: EdgeModelConfig = {
      groups,
      training: options.epochs !== undefined ? { poissonEpochs: options.epochs } : undefined,
    };
    const run = runEdgeWalkForward(dataset, {
      modelIds: [modelId],
      modelConfig: config,
      minTrainSeasons: options.minTrainSeasons ?? 2,
      thresholds: [0],
      minThresholdBets: 50,
    });
    const summary = run.report.models[0];
    const market = run.report.market;
    out.push({
      groups,
      modelId,
      bets: summary?.bets ?? 0,
      brier: summary?.brier ?? null,
      logLoss: summary?.logLoss ?? null,
      fiveClassLogLoss: summary?.fiveClassLogLoss ?? null,
      evPositiveBets: summary?.evPositive.bets ?? 0,
      evPositiveRoi: summary?.evPositive.roi ?? 0,
      evPositiveCi95: summary?.evPositive.ci95 ?? [0, 0],
      marketBrier: market.brier,
      vsMarketDiff: summary?.vsMarket?.meanSquaredErrorDiff ?? null,
      vsMarketCi95: summary?.vsMarket?.ci95 ?? null,
    });
  }
  return out;
}

// ─────────────────────────────── League generalization (leave-one-league-out) ───────────────────────────────

export interface LeagueGeneralizationRow {
  leagueId: string;
  seasonsTested: string[];
  bets: number;
  modelBrier: number | null;
  marketBrier: number | null;
  evPositiveBets: number;
  evPositiveRoi: number;
  evPositiveCi95: [number, number];
}

/**
 * Leave-one-league-out with strict temporal ordering: for each held-out league
 * and test season, training uses ONLY other leagues' matches strictly earlier
 * than the test season.
 */
export function runLeaveOneLeagueOut(
  dataset: EdgeMatch[],
  options: {
    modelId?: EdgeModelId;
    modelConfig?: EdgeModelConfig;
    minTrainMatches?: number;
    minTestMatches?: number;
  } = {}
): LeagueGeneralizationRow[] {
  const modelId = options.modelId ?? 'poisson_glm';
  const modelConfig = options.modelConfig ?? { groups: [...ALL_FEATURE_GROUPS] };
  const minTrain = options.minTrainMatches ?? 800;
  const minTest = options.minTestMatches ?? 100;

  const seasons = Array.from(new Set(dataset.map((m) => m.season))).sort();
  const leagues = Array.from(new Set(dataset.map((m) => m.leagueId))).sort();
  const out: LeagueGeneralizationRow[] = [];

  for (const leagueId of leagues) {
    const accumulated: EdgeBetPrediction[] = [];
    const seasonsTested: string[] = [];

    for (const testSeason of seasons) {
      const train = dataset.filter((m) => m.leagueId !== leagueId && m.season < testSeason);
      const test = dataset.filter((m) => m.leagueId === leagueId && m.season === testSeason);
      if (train.length < minTrain || test.length < minTest) continue;

      const model = trainEdgeModel(modelId, { trainMatches: train, trainSamples: [] }, modelConfig);
      const { predictions } = predictTestSeason(test, [model], [modelId]);
      accumulated.push(...predictions);
      seasonsTested.push(testSeason);
    }

    if (accumulated.length === 0) {
      out.push({
        leagueId,
        seasonsTested,
        bets: 0,
        modelBrier: null,
        marketBrier: null,
        evPositiveBets: 0,
        evPositiveRoi: 0,
        evPositiveCi95: [0, 0],
      });
      continue;
    }

    const metrics = computeGroupMetrics(modelId, accumulated);
    out.push({
      leagueId,
      seasonsTested,
      bets: accumulated.filter((r) => r.y !== null).length,
      modelBrier: metrics.brier,
      marketBrier: metrics.marketBrier,
      evPositiveBets: metrics.evPositiveBets,
      evPositiveRoi: metrics.evPositiveRoi,
      evPositiveCi95: metrics.evPositiveCi95,
    });
  }

  return out;
}

// ─────────────────────────────── Threshold sweep helper ───────────────────────────────

export interface ThresholdRow {
  threshold: number;
  modelId: string;
  bets: number;
  pnl: number;
  roi: number;
  ci95: [number, number];
  maxDrawdown: number;
}

export function thresholdSweepFromPredictions(
  predictionsByModel: Record<string, EdgeBetPrediction[]>,
  modelIds: string[],
  thresholds: number[]
): ThresholdRow[] {
  const out: ThresholdRow[] = [];
  for (const modelId of modelIds) {
    const rows = predictionsByModel[modelId] ?? [];
    for (const t of thresholds) {
      const selected = rows.filter((r) => r.modelEv > t);
      const pnls = selected.map((r) => {
        if (r.actualOutcome === 'PUSH' || r.actualOutcome === 'VOID') return 0;
        if (r.actualOutcome === 'FULL_WIN') return r.odds - 1;
        if (r.actualOutcome === 'HALF_WIN') return 0.5 * (r.odds - 1);
        if (r.actualOutcome === 'HALF_LOSS') return -0.5;
        return -1;
      });
      const n = pnls.length;
      const pnl = pnls.reduce((s, v) => s + v, 0);
      const roi = n > 0 ? pnl / n : 0;
      const mean = n > 0 ? pnl / n : 0;
      const sd = n > 1 ? Math.sqrt(pnls.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)) : 0;
      const se = n > 0 ? sd / Math.sqrt(n) : 0;
      let peak = 0;
      let cum = 0;
      let dd = 0;
      for (const p of pnls) {
        cum += p;
        if (cum > peak) peak = cum;
        dd = Math.max(dd, peak - cum);
      }
      out.push({
        threshold: t,
        modelId,
        bets: n,
        pnl: Number(pnl.toFixed(6)),
        roi: Number(roi.toFixed(6)),
        ci95: [Number((roi - 1.96 * se).toFixed(6)), Number((roi + 1.96 * se).toFixed(6))],
        maxDrawdown: Number(dd.toFixed(6)),
      });
    }
  }
  return out;
}

export { runEdgeWalkForward, type EdgeWalkForwardConfig };
export type { EdgeBetPrediction, AhSide };
