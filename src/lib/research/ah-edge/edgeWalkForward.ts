// AH EDGE ENGINE — Chronological walk-forward evaluation.
//
// Folds are season-based: train on ALL seasons strictly earlier than the test
// season; never shuffled. Model probabilities are settlement-aware (5 category
// distribution derived from a goal-difference PMF). Market comparison uses the
// devigged two-way AH price for the same bet (the market's own probability).
//
// Threshold selection: reported OOS metrics cover every threshold, but the
// "selected threshold" is chosen on an inner train/validation split inside the
// training window only (never on the test season).

import type { AhSide } from '../ah-yield/ahTypes';
import { settleAhBet } from '../ah-yield/ahSettlement';
import { ahExpectedValue, ahFairOdds } from '../ah-yield/ahFairOdds';
import { devigTwoWay } from './edgeProbability';
import { categoriesFromRates, trainEdgeModel, type TrainedEdgeModel } from './edgeModels';
import type {
  EdgeBetPrediction,
  EdgeMatch,
  EdgeModelConfig,
  EdgeModelId,
} from './edgeTypes';
import { ALL_FEATURE_GROUPS } from './edgeTypes';

export const DEFAULT_MODEL_IDS: EdgeModelId[] = [
  'market_poisson',
  'league_line_prior',
  'form_poisson',
  'elo_poisson',
  'poisson_glm',
  'softmax_glm',
];

export const DEFAULT_THRESHOLDS = [0, 0.01, 0.02, 0.03, 0.05, 0.07, 0.1];

export interface EdgeWalkForwardConfig {
  modelIds?: EdgeModelId[];
  modelConfig?: EdgeModelConfig;
  minTrainSeasons?: number;
  thresholds?: number[];
  minThresholdBets?: number;
  calibrationBuckets?: number;
}

interface FlatMetrics {
  bets: number;
  pushes: number;
  brier: number | null;
  logLoss: number | null;
  ece: number | null;
  fiveClassLogLoss: number | null;
}

interface SelectionMetrics {
  bets: number;
  stake: number;
  pnl: number;
  roi: number;
  ci95: [number, number];
  maxDrawdown: number;
}

export interface GroupMetrics extends FlatMetrics {
  modelId: string;
  evPositiveBets: number;
  evPositivePnl: number;
  evPositiveRoi: number;
  evPositiveCi95: [number, number];
  marketBrier: number | null;
  vsMarketDiff: number | null;
  vsMarketCi95: [number, number] | null;
}

export function pnlOfPrediction(r: { actualOutcome: string; odds: number }): number {
  if (r.actualOutcome === 'PUSH' || r.actualOutcome === 'VOID') return 0;
  if (r.actualOutcome === 'FULL_WIN') return r.odds - 1;
  if (r.actualOutcome === 'HALF_WIN') return 0.5 * (r.odds - 1);
  if (r.actualOutcome === 'HALF_LOSS') return -0.5;
  return -1;
}

export function computeGroupMetrics(modelId: string, rows: EdgeBetPrediction[]): GroupMetrics {
  const decided = rows.filter((r) => r.y !== null);
  const squared = decided.map((r) => (r.modelBinaryProbability - (r.y as number)) ** 2);
  const marketSquared = decided
    .filter((r) => r.marketBinaryProbability !== null)
    .map((r) => ((r.marketBinaryProbability as number) - (r.y as number)) ** 2);
  const losses = decided.map((r) => {
    const p = Math.min(1 - 1e-9, Math.max(1e-9, r.modelBinaryProbability));
    return -((r.y as number) * Math.log(p) + (1 - (r.y as number)) * Math.log(1 - p));
  });
  const fiveClass = rows
    .filter((r) => r.actualCategoryIndex >= 0)
    .map((r) => {
      const probs = [
        r.probabilities.pFullWin,
        r.probabilities.pHalfWin,
        r.probabilities.pPush,
        r.probabilities.pHalfLoss,
        r.probabilities.pFullLoss,
      ];
      return -Math.log(Math.max(1e-9, probs[r.actualCategoryIndex]));
    });

  const evSel = rows.filter((r) => r.modelEv > 0);
  const evMetrics = selectionMetrics(evSel.map(pnlOfPrediction), false);

  const diffPairs = decided
    .filter((r) => r.marketBinaryProbability !== null)
    .map(
      (r) =>
        (r.modelBinaryProbability - (r.y as number)) ** 2 -
        ((r.marketBinaryProbability as number) - (r.y as number)) ** 2
    );
  const meanDiff = diffPairs.length > 0 ? mean(diffPairs) : null;
  const seDiff = diffPairs.length > 1 ? stdDev(diffPairs) / Math.sqrt(diffPairs.length) : 0;

  return {
    modelId,
    bets: decided.length,
    pushes: rows.length - decided.length,
    brier: squared.length > 0 ? Number(mean(squared).toFixed(6)) : null,
    logLoss: losses.length > 0 ? Number(mean(losses).toFixed(6)) : null,
    ece: null,
    fiveClassLogLoss: fiveClass.length > 0 ? Number(mean(fiveClass).toFixed(6)) : null,
    marketBrier: marketSquared.length > 0 ? Number(mean(marketSquared).toFixed(6)) : null,
    evPositiveBets: evSel.length,
    evPositivePnl: evMetrics.pnl,
    evPositiveRoi: evMetrics.roi,
    evPositiveCi95: evMetrics.ci95,
    vsMarketDiff: meanDiff === null ? null : Number(meanDiff.toFixed(6)),
    vsMarketCi95:
      meanDiff === null
        ? null
        : [Number((meanDiff - 1.96 * seDiff).toFixed(6)), Number((meanDiff + 1.96 * seDiff).toFixed(6))],
  };
}

export interface ModelFoldMetrics extends FlatMetrics {
  modelId: string;
  label: string;
  allBets: SelectionMetrics;
  evPositive: SelectionMetrics;
  byThreshold: Array<{ threshold: number; metrics: SelectionMetrics }>;
  selectedThreshold: { threshold: number; metrics: SelectionMetrics } | null;
  vsMarket: { meanSquaredErrorDiff: number; se: number; ci95: [number, number]; z: number } | null;
  calibration: Array<{ lower: number; upper: number; count: number; predictedMean: number; observedFrequency: number }>;
}

export interface EdgeFoldResult {
  foldIndex: number;
  testSeason: string;
  trainSeasons: string[];
  trainMatches: number;
  testMatches: number;
  testSides: number;
  models: ModelFoldMetrics[];
  market: FlatMetrics;
}

export interface ThresholdFoldStats {
  folds: number;
  positiveFolds: number;
  medianFoldRoi: number;
  worstFoldRoi: number;
  bestFoldRoi: number;
  perFold: Array<{ season: string; roi: number; bets: number }>;
}

export interface ModelOosSummary {
  modelId: string;
  label: string;
  folds: number;
  bets: number;
  pushes: number;
  brier: number | null;
  logLoss: number | null;
  ece: number | null;
  fiveClassLogLoss: number | null;
  allBetsRoi: number;
  evPositive: SelectionMetrics;
  selectedThreshold: (SelectionMetrics & {
    thresholdsUsed: Record<string, number>;
    foldRois: Array<{ season: string; roi: number; bets: number; threshold: number }>;
    positiveFolds: number;
    medianFoldRoi: number;
    worstFoldRoi: number;
    bestFoldRoi: number;
  }) | null;
  byThreshold: Array<{ threshold: number; metrics: SelectionMetrics; foldStats: ThresholdFoldStats }>;
  vsMarket: { meanSquaredErrorDiff: number; se: number; ci95: [number, number]; z: number } | null;
}

export interface EdgeWalkForwardReport {
  config: Required<EdgeWalkForwardConfig>;
  folds: EdgeFoldResult[];
  market: FlatMetrics;
  models: ModelOosSummary[];
}

// ─────────────────────────────── metric helpers ───────────────────────────────

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1));
}

export function selectionMetrics(pnls: number[], maxDd = true): SelectionMetrics {
  const n = pnls.length;
  const stake = n;
  const pnl = pnls.reduce((s, v) => s + v, 0);
  const roi = n > 0 ? pnl / stake : 0;
  const sd = stdDev(pnls);
  const se = n > 0 ? sd / Math.sqrt(n) : 0;
  let peak = 0;
  let cum = 0;
  let dd = 0;
  if (maxDd) {
    for (const p of pnls) {
      cum += p;
      if (cum > peak) peak = cum;
      dd = Math.max(dd, peak - cum);
    }
  }
  return {
    bets: n,
    stake,
    pnl: Number(pnl.toFixed(6)),
    roi: Number(roi.toFixed(6)),
    ci95: [Number((roi - 1.96 * se).toFixed(6)), Number((roi + 1.96 * se).toFixed(6))],
    maxDrawdown: Number(dd.toFixed(6)),
  };
}

function eceOf(pairs: Array<{ p: number; y: number }>, buckets: number): number | null {
  if (pairs.length === 0) return null;
  const counts = new Array(buckets).fill(0);
  const pred = new Array(buckets).fill(0);
  const obs = new Array(buckets).fill(0);
  for (const { p, y } of pairs) {
    const b = Math.min(buckets - 1, Math.floor(p * buckets));
    counts[b] += 1;
    pred[b] += p;
    obs[b] += y;
  }
  let ece = 0;
  for (let b = 0; b < buckets; b++) {
    if (counts[b] === 0) continue;
    ece += (counts[b] / pairs.length) * Math.abs(obs[b] / counts[b] - pred[b] / counts[b]);
  }
  return Number(ece.toFixed(6));
}

function calibrationBuckets(
  pairs: Array<{ p: number; y: number }>,
  buckets: number
): Array<{ lower: number; upper: number; count: number; predictedMean: number; observedFrequency: number }> {
  const out: Array<{ lower: number; upper: number; count: number; predictedMean: number; observedFrequency: number }> = [];
  for (let b = 0; b < buckets; b++) {
    const lower = b / buckets;
    const upper = (b + 1) / buckets;
    const inBucket = pairs.filter((x) => x.p >= lower && (b === buckets - 1 ? x.p <= upper : x.p < upper));
    out.push({
      lower,
      upper,
      count: inBucket.length,
      predictedMean: inBucket.length > 0 ? Number(mean(inBucket.map((x) => x.p)).toFixed(6)) : 0,
      observedFrequency: inBucket.length > 0 ? Number(mean(inBucket.map((x) => x.y)).toFixed(6)) : 0,
    });
  }
  return out;
}

// ─────────────────────────────── prediction rows ───────────────────────────────

interface FoldPredictionSet {
  predictions: EdgeBetPrediction[];
  matchCount: number;
}

export function predictTestSeason(
  testMatches: EdgeMatch[],
  models: TrainedEdgeModel[],
  modelIds: string[]
): FoldPredictionSet {
  const predictions: EdgeBetPrediction[] = [];

  for (const m of testMatches) {
    // Rates are match-level; compute once per model and reuse for both sides.
    const ratesByModel = models.map((model) => (model.predictRates ? model.predictRates(m) : null));

    for (const side of ['home', 'away'] as AhSide[]) {
      const selectionLine = side === 'home' ? m.ah.line : -m.ah.line;
      const odds = side === 'home' ? m.ah.homeOdds : m.ah.awayOdds;
      const oppositeOdds = side === 'home' ? m.ah.awayOdds : m.ah.homeOdds;
      const settled = settleAhBet({
        side,
        line: selectionLine,
        homeScore: m.homeGoals,
        awayScore: m.awayGoals,
        odds,
        stake: 1,
      });
      const actualCategoryIndex =
        settled.outcome === 'FULL_WIN' ? 0 :
        settled.outcome === 'HALF_WIN' ? 1 :
        settled.outcome === 'PUSH' ? 2 :
        settled.outcome === 'HALF_LOSS' ? 3 :
        settled.outcome === 'FULL_LOSS' ? 4 : -1;
      const y: 0 | 1 | null =
        settled.outcome === 'PUSH' || settled.outcome === 'VOID'
          ? null
          : settled.outcome === 'FULL_WIN' || settled.outcome === 'HALF_WIN'
            ? 1
            : 0;

      const marketTwoWay = devigTwoWay(odds, oppositeOdds);
      const marketBinaryProbability = marketTwoWay.pA;
      const marketEv = marketBinaryProbability * (odds - 1) - (1 - marketBinaryProbability);

      for (let i = 0; i < models.length; i++) {
        const model = models[i];
        const rates = ratesByModel[i];
        const probabilities = rates
          ? categoriesFromRates(rates.lambdaHome, rates.lambdaAway, m.ah.line, side)
          : model.predict(m, m.ah.line, side);
        const binary = probabilities.pFullWin + probabilities.pHalfWin;
        const modelEv = ahExpectedValue(probabilities, odds);
        const fair = ahFairOdds(probabilities);
        predictions.push({
          canonicalId: m.canonicalId,
          matchDate: m.matchDate,
          season: m.season,
          leagueId: m.leagueId,
          side,
          line: m.ah.line,
          odds,
          oppositeOdds,
          favoriteStatus: selectionLine < 0 ? 'favorite' : selectionLine > 0 ? 'underdog' : 'market_neutral',
          actualOutcome: settled.outcome,
          actualCategoryIndex,
          y,
          modelId: modelIds[i],
          probabilities,
          fairOdds: fair === null ? null : Number(fair.toFixed(6)),
          modelEv: Number(modelEv.toFixed(6)),
          modelBinaryProbability: Number(binary.toFixed(6)),
          marketBinaryProbability: Number(marketBinaryProbability.toFixed(6)),
          marketEv: Number(marketEv.toFixed(6)),
        });
      }
    }
  }

  return { predictions, matchCount: testMatches.length };
}

// ─────────────────────────────── fold evaluation ───────────────────────────────

function evaluatePredictions(
  predictions: EdgeBetPrediction[],
  thresholds: number[],
  calibrationBucketCount: number
): ModelFoldMetrics[] {
  const byModel = new Map<string, EdgeBetPrediction[]>();
  for (const p of predictions) {
    const list = byModel.get(p.modelId);
    if (list) list.push(p);
    else byModel.set(p.modelId, [p]);
  }

  const out: ModelFoldMetrics[] = [];
  for (const [modelId, rows] of byModel) {
    const decided = rows.filter((r) => r.y !== null);
    const squared = decided.map((r) => (r.modelBinaryProbability - (r.y as number)) ** 2);
    const losses = decided.map((r) => {
      const p = Math.min(1 - 1e-9, Math.max(1e-9, r.modelBinaryProbability));
      return -((r.y as number) * Math.log(p) + (1 - (r.y as number)) * Math.log(1 - p));
    });
    const pairs = decided.map((r) => ({ p: r.modelBinaryProbability, y: r.y as number }));
    const fiveClass = rows
      .filter((r) => r.actualCategoryIndex >= 0)
      .map((r) => {
        const probs = [
          r.probabilities.pFullWin,
          r.probabilities.pHalfWin,
          r.probabilities.pPush,
          r.probabilities.pHalfLoss,
          r.probabilities.pFullLoss,
        ];
        return -Math.log(Math.max(1e-9, probs[r.actualCategoryIndex]));
      });

    const realizedPnl = (filter: (r: EdgeBetPrediction) => boolean) =>
      rows.filter(filter).map((r) => {
        if (r.actualOutcome === 'PUSH') return 0;
        if (r.actualOutcome === 'VOID') return 0;
        if (r.actualOutcome === 'FULL_WIN') return r.odds - 1;
        if (r.actualOutcome === 'HALF_WIN') return 0.5 * (r.odds - 1);
        if (r.actualOutcome === 'HALF_LOSS') return -0.5;
        return -1;
      });

    const evPositive = selectionMetrics(realizedPnl((r) => r.modelEv > 0));

    const byThreshold = thresholds.map((t) => ({
      threshold: t,
      metrics: selectionMetrics(realizedPnl((r) => r.modelEv > t)),
    }));

    const diffPairs = decided
      .filter((r) => r.marketBinaryProbability !== null)
      .map((r) => ({
        d:
          (r.modelBinaryProbability - (r.y as number)) ** 2 -
          ((r.marketBinaryProbability as number) - (r.y as number)) ** 2,
      }));
    const meanDiff = diffPairs.length > 0 ? mean(diffPairs.map((x) => x.d)) : 0;
    const seDiff = diffPairs.length > 1 ? stdDev(diffPairs.map((x) => x.d)) / Math.sqrt(diffPairs.length) : 0;
    const vsMarket =
      diffPairs.length > 1
        ? {
            meanSquaredErrorDiff: Number(meanDiff.toFixed(6)),
            se: Number(seDiff.toFixed(6)),
            ci95: [Number((meanDiff - 1.96 * seDiff).toFixed(6)), Number((meanDiff + 1.96 * seDiff).toFixed(6))] as [number, number],
            z: seDiff > 0 ? Number((meanDiff / seDiff).toFixed(4)) : 0,
          }
        : null;

    out.push({
      modelId,
      label: modelId,
      bets: decided.length,
      pushes: rows.length - decided.length,
      brier: squared.length > 0 ? Number(mean(squared).toFixed(6)) : null,
      logLoss: losses.length > 0 ? Number(mean(losses).toFixed(6)) : null,
      ece: eceOf(pairs, calibrationBucketCount),
      fiveClassLogLoss: fiveClass.length > 0 ? Number(mean(fiveClass).toFixed(6)) : null,
      allBets: selectionMetrics(realizedPnl(() => true)),
      evPositive,
      byThreshold,
      selectedThreshold: null,
      vsMarket,
      calibration: calibrationBuckets(pairs, calibrationBucketCount),
    });
  }

  return out;
}

function marketFlatMetrics(predictions: EdgeBetPrediction[]): FlatMetrics {
  const decided = predictions.filter((r) => r.y !== null && r.marketBinaryProbability !== null);
  const squared = decided.map((r) => ((r.marketBinaryProbability as number) - (r.y as number)) ** 2);
  const losses = decided.map((r) => {
    const p = Math.min(1 - 1e-9, Math.max(1e-9, r.marketBinaryProbability as number));
    return -((r.y as number) * Math.log(p) + (1 - (r.y as number)) * Math.log(1 - p));
  });
  const pairs = decided.map((r) => ({ p: r.marketBinaryProbability as number, y: r.y as number }));
  return {
    bets: decided.length,
    pushes: predictions.length - decided.length,
    brier: squared.length > 0 ? Number(mean(squared).toFixed(6)) : null,
    logLoss: losses.length > 0 ? Number(mean(losses).toFixed(6)) : null,
    ece: eceOf(pairs, 10),
    fiveClassLogLoss: null,
  };
}

// ─────────────────────────────── orchestration ───────────────────────────────

function seasonsOf(matches: EdgeMatch[]): string[] {
  return Array.from(new Set(matches.map((m) => m.season))).sort();
}

function trainContext(trainMatches: EdgeMatch[]) {
  const samples: Array<{ line: number; side: AhSide; category: string }> = [];
  for (const m of trainMatches) {
    for (const side of ['home', 'away'] as AhSide[]) {
      const selectionLine = side === 'home' ? m.ah.line : -m.ah.line;
      const odds = side === 'home' ? m.ah.homeOdds : m.ah.awayOdds;
      const settled = settleAhBet({ side, line: selectionLine, homeScore: m.homeGoals, awayScore: m.awayGoals, odds, stake: 1 });
      if (settled.outcome === 'VOID') continue;
      samples.push({ line: m.ah.line, side, category: settled.outcome });
    }
  }
  return { trainMatches, trainSamples: samples };
}

function trainModels(ids: EdgeModelId[], trainMatches: EdgeMatch[], config: EdgeModelConfig): TrainedEdgeModel[] {
  const context = trainContext(trainMatches);
  return ids.map((id) => trainEdgeModel(id, context, config));
}

function selectThreshold(
  modelId: EdgeModelId,
  config: EdgeModelConfig,
  trainSeasonsMatches: EdgeMatch[],
  innerTrainSeasons: string[],
  innerValSeason: string,
  thresholds: number[],
  minBets: number
): number {
  const innerTrain = trainSeasonsMatches.filter((m) => innerTrainSeasons.includes(m.season));
  const innerVal = trainSeasonsMatches.filter((m) => m.season === innerValSeason);
  if (innerTrain.length === 0 || innerVal.length === 0) return 0;
  const models = trainModels([modelId], innerTrain, config);
  const { predictions } = predictTestSeason(innerVal, models, [modelId]);
  const rows = predictions;
  let bestThreshold = 0;
  let bestRoi = -Infinity;
  for (const t of thresholds) {
    const selected = rows.filter((r) => r.modelEv > t);
    if (selected.length < minBets) continue;
    const pnl = selected.map((r) => {
      if (r.actualOutcome === 'PUSH' || r.actualOutcome === 'VOID') return 0;
      if (r.actualOutcome === 'FULL_WIN') return r.odds - 1;
      if (r.actualOutcome === 'HALF_WIN') return 0.5 * (r.odds - 1);
      if (r.actualOutcome === 'HALF_LOSS') return -0.5;
      return -1;
    });
    const roi = pnl.reduce((s, v) => s + v, 0) / selected.length;
    if (roi > bestRoi + 1e-12) {
      bestRoi = roi;
      bestThreshold = t;
    }
  }
  return bestThreshold;
}

function mergeSelection(a: SelectionMetrics, b: SelectionMetrics): SelectionMetrics {
  const bets = a.bets + b.bets;
  const pnl = a.pnl + b.pnl;
  const stake = a.stake + b.stake;
  const roi = stake > 0 ? pnl / stake : 0;
  // Conservative CI combination: sqrt of summed squared half-widths.
  const halfA = (a.ci95[1] - a.ci95[0]) / 2;
  const halfB = (b.ci95[1] - b.ci95[0]) / 2;
  const half = Math.sqrt(halfA ** 2 + halfB ** 2);
  return {
    bets,
    stake,
    pnl: Number(pnl.toFixed(6)),
    roi: Number(roi.toFixed(6)),
    ci95: [Number((roi - half).toFixed(6)), Number((roi + half).toFixed(6))],
    maxDrawdown: Math.max(a.maxDrawdown, b.maxDrawdown),
  };
}

export interface EdgeWalkForwardRun {
  report: EdgeWalkForwardReport;
  /**
   * Out-of-sample per-bet predictions keyed by model id. Not serialized into
   * final artifacts; used for breakdowns and research log evidence.
   */
  predictionsByModel: Record<string, EdgeBetPrediction[]>;
}

export function runEdgeWalkForward(
  dataset: EdgeMatch[],
  config: EdgeWalkForwardConfig = {}
): EdgeWalkForwardRun {
  const fullConfig: Required<EdgeWalkForwardConfig> = {
    modelIds: config.modelIds ?? DEFAULT_MODEL_IDS,
    modelConfig: config.modelConfig ?? { groups: [...ALL_FEATURE_GROUPS] },
    minTrainSeasons: config.minTrainSeasons ?? 2,
    thresholds: config.thresholds ?? DEFAULT_THRESHOLDS,
    minThresholdBets: config.minThresholdBets ?? 100,
    calibrationBuckets: config.calibrationBuckets ?? 10,
  };

  const seasons = seasonsOf(dataset);
  const folds: EdgeFoldResult[] = [];
  const allMarketPredictions: EdgeBetPrediction[] = [];

  const perModelAccum = new Map<
    string,
    {
      label: string;
      predictions: EdgeBetPrediction[];
      foldRois: Array<{ season: string; roi: number; bets: number; threshold: number }>;
      thresholdsUsed: Record<string, number>;
    }
  >();

  for (let fi = fullConfig.minTrainSeasons; fi < seasons.length; fi++) {
    const testSeason = seasons[fi];
    const trainSeasons = seasons.slice(0, fi);
    const trainMatches = dataset.filter((m) => trainSeasons.includes(m.season));
    const testMatches = dataset.filter((m) => m.season === testSeason);

    const models = trainModels(fullConfig.modelIds, trainMatches, fullConfig.modelConfig);
    const { predictions } = predictTestSeason(testMatches, models, fullConfig.modelIds);

    const modelFoldMetrics = evaluatePredictions(predictions, fullConfig.thresholds, fullConfig.calibrationBuckets);
    const modelLabels = new Map(models.map((m) => [m.id, m.label] as const));

    // Inner train/validation threshold selection (never touches the test season).
    const innerValSeason = trainSeasons[trainSeasons.length - 1];
    const innerTrainSeasons = trainSeasons.slice(0, -1);

    for (const fm of modelFoldMetrics) {
      fm.label = modelLabels.get(fm.modelId) ?? fm.modelId;
      const singleZeroThreshold = fullConfig.thresholds.length === 1 && fullConfig.thresholds[0] === 0;
      if (innerTrainSeasons.length > 0 && !singleZeroThreshold) {
        const selected = selectThreshold(
          fm.modelId as EdgeModelId,
          fullConfig.modelConfig,
          trainMatches,
          innerTrainSeasons,
          innerValSeason,
          fullConfig.thresholds,
          fullConfig.minThresholdBets
        );
        const matching = fm.byThreshold.find((t) => t.threshold === selected) ?? fm.byThreshold[0];
        fm.selectedThreshold = { threshold: selected, metrics: matching.metrics };
      } else {
        const matching = fm.byThreshold[0];
        fm.selectedThreshold = { threshold: 0, metrics: matching.metrics };
      }

      let acc = perModelAccum.get(fm.modelId);
      if (!acc) {
        acc = { label: fm.label, predictions: [], foldRois: [], thresholdsUsed: {} };
        perModelAccum.set(fm.modelId, acc);
      }
      const foldRows = predictions.filter((r) => r.modelId === fm.modelId);
      acc.predictions.push(...foldRows);
      if (fm.selectedThreshold) {
        const t = fm.selectedThreshold.threshold;
        acc.thresholdsUsed[String(t)] = (acc.thresholdsUsed[String(t)] ?? 0) + 1;
        acc.foldRois.push({
          season: testSeason,
          roi: fm.selectedThreshold.metrics.roi,
          bets: fm.selectedThreshold.metrics.bets,
          threshold: t,
        });
      }
    }

    folds.push({
      foldIndex: fi - fullConfig.minTrainSeasons,
      testSeason,
      trainSeasons,
      trainMatches: trainMatches.length,
      testMatches: testMatches.length,
      testSides: testMatches.length * 2,
      models: modelFoldMetrics,
      market: marketFlatMetrics(predictions),
    });

    allMarketPredictions.push(...predictions.filter((r) => r.modelId === fullConfig.modelIds[0]));
  }

  const models: ModelOosSummary[] = [];
  for (const [modelId, acc] of perModelAccum) {
    const decided = acc.predictions.filter((r) => r.y !== null);
    const squared = decided.map((r) => (r.modelBinaryProbability - (r.y as number)) ** 2);
    const losses = decided.map((r) => {
      const p = Math.min(1 - 1e-9, Math.max(1e-9, r.modelBinaryProbability));
      return -((r.y as number) * Math.log(p) + (1 - (r.y as number)) * Math.log(1 - p));
    });
    const fiveClass = acc.predictions
      .filter((r) => r.actualCategoryIndex >= 0)
      .map((r) => {
        const probs = [
          r.probabilities.pFullWin,
          r.probabilities.pHalfWin,
          r.probabilities.pPush,
          r.probabilities.pHalfLoss,
          r.probabilities.pFullLoss,
        ];
        return -Math.log(Math.max(1e-9, probs[r.actualCategoryIndex]));
      });

    const realized = (filter: (r: EdgeBetPrediction) => boolean) =>
      acc.predictions.filter(filter).map((r) => {
        if (r.actualOutcome === 'PUSH' || r.actualOutcome === 'VOID') return 0;
        if (r.actualOutcome === 'FULL_WIN') return r.odds - 1;
        if (r.actualOutcome === 'HALF_WIN') return 0.5 * (r.odds - 1);
        if (r.actualOutcome === 'HALF_LOSS') return -0.5;
        return -1;
      });

    const evPositive = selectionMetrics(realized((r) => r.modelEv > 0));
    const foldSeasons = folds.map((f) => f.testSeason);
    const foldStatsFor = (t: number): ThresholdFoldStats => {
      const perFold = foldSeasons.map((season) => {
        const pnls = realized((r) => r.season === season && r.modelEv > t);
        const roi = pnls.length > 0 ? pnls.reduce((s, v) => s + v, 0) / pnls.length : 0;
        return { season, roi: Number(roi.toFixed(6)), bets: pnls.length };
      });
      const rois = perFold.map((f) => f.roi).sort((a, b) => a - b);
      const median =
        rois.length === 0
          ? 0
          : rois.length % 2 === 1
            ? rois[(rois.length - 1) / 2]
            : (rois[rois.length / 2 - 1] + rois[rois.length / 2]) / 2;
      return {
        folds: perFold.length,
        positiveFolds: perFold.filter((f) => f.roi > 0).length,
        medianFoldRoi: Number(median.toFixed(6)),
        worstFoldRoi: rois.length > 0 ? Number(rois[0].toFixed(6)) : 0,
        bestFoldRoi: rois.length > 0 ? Number(rois[rois.length - 1].toFixed(6)) : 0,
        perFold,
      };
    };
    const byThreshold = fullConfig.thresholds.map((t) => ({
      threshold: t,
      metrics: selectionMetrics(realized((r) => r.modelEv > t)),
      foldStats: foldStatsFor(t),
    }));

    // Selected-threshold aggregate across folds (each fold uses its own
    // train-chosen threshold, never a threshold picked on the test season).
    let selectedMetrics: SelectionMetrics | null = null;
    for (const r of acc.foldRois) {
      const foldRows = acc.predictions.filter((row) => row.season === r.season);
      const t = r.threshold;
      const m = selectionMetrics(
        foldRows
          .filter((row) => row.modelEv > t)
          .map((row) => {
            if (row.actualOutcome === 'PUSH' || row.actualOutcome === 'VOID') return 0;
            if (row.actualOutcome === 'FULL_WIN') return row.odds - 1;
            if (row.actualOutcome === 'HALF_WIN') return 0.5 * (row.odds - 1);
            if (row.actualOutcome === 'HALF_LOSS') return -0.5;
            return -1;
          })
      );
      selectedMetrics = selectedMetrics ? mergeSelection(selectedMetrics, m) : m;
    }

    const diffPairs = decided
      .filter((r) => r.marketBinaryProbability !== null)
      .map((r) => ({
        d:
          (r.modelBinaryProbability - (r.y as number)) ** 2 -
          ((r.marketBinaryProbability as number) - (r.y as number)) ** 2,
      }));
    const meanDiff = diffPairs.length > 0 ? mean(diffPairs.map((x) => x.d)) : 0;
    const seDiff = diffPairs.length > 1 ? stdDev(diffPairs.map((x) => x.d)) / Math.sqrt(diffPairs.length) : 0;

    models.push({
      modelId,
      label: acc.label,
      folds: folds.length,
      bets: decided.length,
      pushes: acc.predictions.length - decided.length,
      brier: squared.length > 0 ? Number(mean(squared).toFixed(6)) : null,
      logLoss: losses.length > 0 ? Number(mean(losses).toFixed(6)) : null,
      ece: eceOf(decided.map((r) => ({ p: r.modelBinaryProbability, y: r.y as number })), fullConfig.calibrationBuckets),
      fiveClassLogLoss: fiveClass.length > 0 ? Number(mean(fiveClass).toFixed(6)) : null,
      allBetsRoi: (() => {
        const pnls = realized(() => true);
        const roi = pnls.length > 0 ? pnls.reduce((s, v) => s + v, 0) / pnls.length : 0;
        return Number(roi.toFixed(6));
      })(),
      evPositive,
      selectedThreshold: selectedMetrics
        ? {
            ...selectedMetrics,
            thresholdsUsed: acc.thresholdsUsed,
            foldRois: acc.foldRois,
            positiveFolds: acc.foldRois.filter((r) => r.roi > 0).length,
            medianFoldRoi: (() => {
              const rois = acc.foldRois.map((r) => r.roi).sort((a, b) => a - b);
              if (rois.length === 0) return 0;
              return rois.length % 2 === 1
                ? rois[(rois.length - 1) / 2]
                : (rois[rois.length / 2 - 1] + rois[rois.length / 2]) / 2;
            })(),
            worstFoldRoi: acc.foldRois.length > 0 ? Math.min(...acc.foldRois.map((r) => r.roi)) : 0,
            bestFoldRoi: acc.foldRois.length > 0 ? Math.max(...acc.foldRois.map((r) => r.roi)) : 0,
          }
        : null,
      byThreshold,
      vsMarket:
        diffPairs.length > 1
          ? {
              meanSquaredErrorDiff: Number(meanDiff.toFixed(6)),
              se: Number(seDiff.toFixed(6)),
              ci95: [Number((meanDiff - 1.96 * seDiff).toFixed(6)), Number((meanDiff + 1.96 * seDiff).toFixed(6))] as [number, number],
              z: seDiff > 0 ? Number((meanDiff / seDiff).toFixed(4)) : 0,
            }
          : null,
    });
  }

  models.sort((a, b) => (a.brier ?? 9) - (b.brier ?? 9));

  const predictionsByModel: Record<string, EdgeBetPrediction[]> = {};
  for (const [modelId, acc] of perModelAccum) predictionsByModel[modelId] = acc.predictions;

  return {
    report: {
      config: fullConfig,
      folds,
      market: marketFlatMetrics(allMarketPredictions),
      models,
    },
    predictionsByModel,
  };
}
