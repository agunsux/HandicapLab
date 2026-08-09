/**
 * Phase 2b — Probability Calibration + Uncertainty Reduction Research
 *
 * Walk-forward protocol (strict no-leakage):
 *   For each fold (test_season):
 *     - Fit raw model on train_seasons (prior seasons only).
 *     - Generate RAW predictions for BOTH train seasons (calibrator fit data)
 *       and test season (evaluation).
 *     - Fit each calibrator (temperature / shrinkage / isotonic) ONLY on
 *       train-season raw predictions + their outcomes.
 *     - Apply calibrator to test-season raw predictions -> calibrated probs.
 *     - Evaluate calibration metrics + EV/ROI on test season only.
 *
 * Never fit a calibrator using any outcome at or after the test season starts.
 *
 * The Phase 2a baseline artifact is read-only and never modified.
 * This runner produces independent artifacts under data/phase2b/.
 */
import * as fs from 'fs';
import * as path from 'path';
import type { FeatureSnapshot, HistoricalOdds, NormalizedMatch } from '../../types';
import { computeLambdas, deriveMarkets, fitLeagueConstants, scoreMatrix, type MarketProbs, type PoissonParams } from '../../model/poisson';
import {
  fitBinaryTemperature, fitSoftmaxTemperature, applyBinaryTemperature, applySoftmaxTemperature,
  fitShrinkageBinary, applyShrinkageBinary,
  fitShrinkageMulticlass, applyShrinkageMulticlass,
  fitIsotonicBinary, applyIsotonicBinary,
  fitIsotonicMulticlass, applyIsotonicMulticlass,
  type BinaryCalibrationFit, type MulticlassCalibrationFit, type MultiDist,
} from './calibration';
import { evalBinary, evalMulticlass, reliabilityTablePhase2ABucket } from './metrics';

const HIST_OUT_DIR = path.resolve(process.cwd(), 'data', 'historical');
const OUT_DIR = path.resolve(process.cwd(), 'data', 'phase2b');

const ELO_SCALE = 400;
const MAX_GOALS = 10;

export const PHASE2B_VERSION = 'phase2b-v1';
export const BASELINE_REF = 'phase2a-baseline';

function loadJsonl<T>(file: string): T[] {
  return fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l) as T);
}

function seasonsOf(matches: NormalizedMatch[]): string[] {
  return Array.from(new Set(matches.map((m) => m.season))).sort();
}

function buildFolds(seasons: string[]): Array<{ train_seasons: string[]; test_season: string }> {
  const folds: Array<{ train_seasons: string[]; test_season: string }> = [];
  for (let i = 2; i < seasons.length; i++) {
    folds.push({ train_seasons: seasons.slice(0, i), test_season: seasons[i] });
  }
  return folds;
}

function hasCoreFeatures(snap: FeatureSnapshot): boolean {
  return snap.home.avg_goals_for !== null && snap.home.avg_goals_against !== null
    && snap.away.avg_goals_for !== null && snap.away.avg_goals_against !== null
    && snap.league_avg_goals !== null && snap.home.elo !== null && snap.away.elo !== null;
}

function predictMatch(snap: FeatureSnapshot, params: PoissonParams): MarketProbs | null {
  if (!hasCoreFeatures(snap)) return null;
  const lambdas = computeLambdas({
    homeAvgGoalsFor: snap.home.avg_goals_for!,
    awayAvgGoalsAgainst: snap.away.avg_goals_against!,
    awayAvgGoalsFor: snap.away.avg_goals_for!,
    homeAvgGoalsAgainst: snap.home.avg_goals_against!,
    leagueAvgGoals: snap.league_avg_goals!,
    eloDelta: snap.home.elo! - snap.away.elo!,
  }, params);
  return deriveMarkets(scoreMatrix(lambdas, MAX_GOALS));
}

export interface RawRow {
  match_id: string;
  season: string;
  match_date: string;
  market: 'ML' | 'OU25' | 'BTTS' | 'AH';
  selection: string;
  raw_probability: number;
  pHome: number | null;
  pDraw: number | null;
  pAway: number | null;
  outcome: boolean;
  outcome_label: 'WIN' | 'LOSS';
  actual_result: 'H' | 'D' | 'A';
  home_goals: number;
  away_goals: number;
  market_odds: number | null;
  fair_odds: number | null;
}

export type MethodName = 'raw' | 'temperature' | 'shrinkage' | 'isotonic';

export interface AppliedRow {
  match_id: string;
  market: 'ML' | 'OU25' | 'BTTS' | 'AH';
  selection: string;
  raw_probability: number;
  cal_probability: number;
  cal_pHome: number | null;
  cal_pDraw: number | null;
  cal_pAway: number | null;
  raw_ev: number | null;
  cal_ev: number | null;
  profit: number | null;
  eligible: boolean;
  method: MethodName;
}

function generateRows(
  snaps: FeatureSnapshot[],
  params: PoissonParams,
  matchById: Map<string, NormalizedMatch>,
  oddsById: Map<string, HistoricalOdds>
): RawRow[] {
  const rows: RawRow[] = [];
  for (const snap of snaps) {
    const match = matchById.get(snap.match_id);
    if (!match) continue;
    const probs = predictMatch(snap, params);
    if (!probs) continue;
    const odds = oddsById.get(snap.match_id);
    const mlOdds = odds?.market_1x2 ?? null;
    const ouOdds = odds?.market_ou25 ?? null;
    const totalGoals = match.home_goals + match.away_goals;
    const base = {
      match_id: snap.match_id, season: snap.season, match_date: snap.match_date,
      actual_result: match.result, home_goals: match.home_goals, away_goals: match.away_goals,
    };
    // ML
    for (const sel of ['home', 'draw', 'away'] as const) {
      const p = sel === 'home' ? probs.pHome : sel === 'draw' ? probs.pDraw : probs.pAway;
      rows.push({
        ...base, market: 'ML' as const, selection: sel,
        raw_probability: Number(p.toFixed(4)),
        pHome: Number(probs.pHome.toFixed(4)), pDraw: Number(probs.pDraw.toFixed(4)), pAway: Number(probs.pAway.toFixed(4)),
        outcome: sel === 'home' ? match.result === 'H' : sel === 'draw' ? match.result === 'D' : match.result === 'A',
        outcome_label: (sel === 'home' ? match.home_goals > match.away_goals : sel === 'draw' ? match.home_goals === match.away_goals : match.home_goals < match.away_goals) ? 'WIN' : 'LOSS',
        market_odds: mlOdds ? mlOdds[sel] : null,
        fair_odds: p > 0 ? Number((1 / p).toFixed(4)) : null,
      });
    }
    // OU25
    for (const sel of ['over', 'under'] as const) {
      const p = sel === 'over' ? probs.pOver['2.5'] : probs.pUnder['2.5'];
      const won = sel === 'over' ? totalGoals > 2.5 : totalGoals < 2.5;
      rows.push({
        ...base, market: 'OU25' as const, selection: sel,
        raw_probability: Number(p.toFixed(4)),
        pHome: null, pDraw: null, pAway: null,
        outcome: won, outcome_label: won ? 'WIN' : 'LOSS',
        market_odds: ouOdds ? ouOdds[sel] : null,
        fair_odds: p > 0 ? Number((1 / p).toFixed(4)) : null,
      });
    }
    // BTTS
    const bttsWon = match.home_goals >= 1 && match.away_goals >= 1;
    rows.push({
      ...base, market: 'BTTS' as const, selection: 'yes',
      raw_probability: Number(probs.pBttsYes.toFixed(4)),
      pHome: null, pDraw: null, pAway: null,
      outcome: bttsWon, outcome_label: bttsWon ? 'WIN' : 'LOSS',
      market_odds: null, fair_odds: Number((1 / probs.pBttsYes).toFixed(4)),
    });
    // AH home -0.5
    const ahWon = match.home_goals > match.away_goals;
    rows.push({
      ...base, market: 'AH' as const, selection: 'home -0.5',
      raw_probability: Number(probs.pAhHome['-0.5'].toFixed(4)),
      pHome: null, pDraw: null, pAway: null,
      outcome: ahWon, outcome_label: ahWon ? 'WIN' : 'LOSS',
      market_odds: null, fair_odds: Number((1 / probs.pAhHome['-0.5']).toFixed(4)),
    });
  }
  return rows;
}

export interface FoldPredictions {
  test_season: string;
  rawTrain: RawRow[];
  rawTest: RawRow[];
}

function scanFolds(
  matches: NormalizedMatch[],
  snaps: FeatureSnapshot[],
  oddsList: HistoricalOdds[],
  folds: Array<{ train_seasons: string[]; test_season: string }>
): FoldPredictions[] {
  const matchById = new Map(matches.map((m) => [m.canonical_id, m]));
  const results = new Map<string, { home: number; away: number }>(
    matches.map((m) => [m.canonical_id, { home: m.home_goals, away: m.away_goals }])
  );
  const oddsById = new Map(oddsList.map((o) => [o.match_id, o]));
  const out: FoldPredictions[] = [];
  for (const fold of folds) {
    const trainSnaps = snaps.filter((s) => fold.train_seasons.includes(s.season));
    const testSnaps = snaps.filter((s) => s.season === fold.test_season);
    const constants = fitLeagueConstants(trainSnaps, results);
    const params: PoissonParams = { ...constants, eloScale: ELO_SCALE, maxGoals: MAX_GOALS };
    out.push({
      test_season: fold.test_season,
      rawTrain: generateRows(trainSnaps, params, matchById, oddsById),
      rawTest: generateRows(testSnaps, params, matchById, oddsById),
    });
  }
  return out;
}

export interface FoldCalibration {
  test_season: string;
  ml: {
    temperature: MulticlassCalibrationFit;
    shrinkage: MulticlassCalibrationFit;
    isotonic: MulticlassCalibrationFit;
  };
  binary: Record<'OU25' | 'BTTS' | 'AH', {
    temperature: BinaryCalibrationFit;
    shrinkage: BinaryCalibrationFit;
    isotonic: BinaryCalibrationFit;
  }>;
}

function fitPerFold(fold: FoldPredictions): FoldCalibration {
  const mlTrain = fold.rawTrain.filter((r) => r.market === 'ML');
  const mlDists = mlTrain.map((r) => ({ pHome: r.pHome!, pDraw: r.pDraw!, pAway: r.pAway! }));
  const mlOutcomes = mlTrain.map((r) => r.actual_result);
  const seasons = Array.from(new Set(fold.rawTrain.map((r) => r.season))).sort();
  const fittedOn = seasons.length ? [seasons[0], seasons[seasons.length - 1]] : [];

  const fitT = adaptMultiT(fitSoftmaxTemperature(mlDists, mlOutcomes, fittedOn));
  const fitS = fitShrinkageMulticlass(mlDists, mlOutcomes, fittedOn);
  const fitI = fitIsotonicMulticlass(mlDists, mlOutcomes, fittedOn);

  const binary = {} as FoldCalibration['binary'];
  for (const m of ['OU25', 'BTTS', 'AH'] as const) {
    const rows = fold.rawTrain.filter((r) => r.market === m);
    const probs = rows.map((r) => r.raw_probability);
    let outcomes: boolean[];
    if (m === 'OU25') outcomes = rows.map((r) => r.outcome);
    else if (m === 'BTTS') outcomes = rows.map((r) => r.home_goals >= 1 && r.away_goals >= 1);
    else outcomes = rows.map((r) => r.home_goals > r.away_goals);
    binary[m] = {
      temperature: adaptBinT(fitBinaryTemperature(probs, outcomes, fittedOn)),
      shrinkage: fitShrinkageBinary(probs, outcomes, fittedOn),
      isotonic: fitIsotonicBinary(probs, outcomes, fittedOn),
    };
  }
  return { test_season: fold.test_season, ml: { temperature: fitT, shrinkage: fitS, isotonic: fitI }, binary };
}

function adaptBinT(fit: ReturnType<typeof fitBinaryTemperature>): BinaryCalibrationFit {
  return {
    method: 'temperature',
    fitted_on: fit.fitted_on,
    n_train: fit.n_train,
    train_logloss: fit.train_logloss,
    temperature: fit.T,
    at_boundary: fit.at_boundary,
  };
}

function adaptMultiT(fit: ReturnType<typeof fitSoftmaxTemperature>): MulticlassCalibrationFit {
  return {
    method: 'temperature',
    fitted_on: fit.fitted_on,
    n_train: fit.n_train,
    train_logloss: fit.train_logloss,
    temperature: fit.T,
    at_boundary: fit.at_boundary,
  };
}

function profitFor(row: RawRow, oddsPrice: number | null): number | null {
  if (oddsPrice === null) return null;
  return row.outcome ? oddsPrice - 1 : -1;
}

function applyCalibrators(testRows: RawRow[], cal: FoldCalibration): AppliedRow[] {
  const out: AppliedRow[] = [];
  for (const row of testRows) {
    if (row.market === 'ML') {
      const distIn: MultiDist = { pHome: row.pHome!, pDraw: row.pDraw!, pAway: row.pAway! };
      const calibs: Array<{ method: MethodName; d: MultiDist }> = [
        { method: 'raw', d: distIn },
        { method: 'temperature', d: applySoftmaxTemperature(distIn, cal.ml.temperature.temperature ?? 1) },
        { method: 'shrinkage', d: applyShrinkageMulticlass(distIn, cal.ml.shrinkage.alpha ?? 1, cal.ml.shrinkage.base_rates ?? [1 / 3, 1 / 3, 1 / 3]) },
        { method: 'isotonic', d: applyIsotonicMulticlass(distIn, cal.ml.isotonic) },
      ];
      const oddsPrice = row.market_odds;
      for (const c of calibs) {
        const p = row.selection === 'home' ? c.d.pHome : row.selection === 'draw' ? c.d.pDraw : c.d.pAway;
        out.push({
          match_id: row.match_id, market: 'ML', selection: row.selection,
          raw_probability: row.raw_probability, cal_probability: Number(p.toFixed(4)),
          cal_pHome: Number(c.d.pHome.toFixed(4)), cal_pDraw: Number(c.d.pDraw.toFixed(4)), cal_pAway: Number(c.d.pAway.toFixed(4)),
          raw_ev: oddsPrice !== null ? Number((row.raw_probability * oddsPrice - 1).toFixed(4)) : null,
          cal_ev: oddsPrice !== null ? Number((p * oddsPrice - 1).toFixed(4)) : null,
          profit: profitFor(row, oddsPrice), eligible: oddsPrice !== null, method: c.method,
        });
      }
    } else {
      const binFit = cal.binary[row.market];
      const oddsPrice = row.market_odds;
      const calibs: Array<{ method: MethodName; p: number }> = [
        { method: 'raw', p: row.raw_probability },
        { method: 'temperature', p: applyBinaryTemperature(row.raw_probability, binFit.temperature.temperature ?? 1) },
        { method: 'shrinkage', p: applyShrinkageBinary(row.raw_probability, binFit.shrinkage.alpha ?? 1, binFit.shrinkage.base_rate ?? 0.5) },
        { method: 'isotonic', p: applyIsotonicBinary(row.raw_probability, binFit.isotonic) },
      ];
      for (const c of calibs) {
        out.push({
          match_id: row.match_id, market: row.market, selection: row.selection,
          raw_probability: row.raw_probability, cal_probability: Number(c.p.toFixed(4)),
          cal_pHome: null, cal_pDraw: null, cal_pAway: null,
          raw_ev: oddsPrice !== null ? Number((row.raw_probability * oddsPrice - 1).toFixed(4)) : null,
          cal_ev: oddsPrice !== null ? Number((c.p * oddsPrice - 1).toFixed(4)) : null,
          profit: profitFor(row, oddsPrice), eligible: oddsPrice !== null, method: c.method,
        });
      }
    }
  }
  return out;
}

export interface FoldMetricsEval {
  method: MethodName;
  n: number;
  brier: number | null;
  logloss: number | null;
  ece: number | null;
  slope: number | null;
  intercept: number | null;
  roi: number | null;
  win_rate: number | null;
  calibration_status: string;
}

function outcomeFor(applied: AppliedRow, testRows: RawRow[]): { outcome: boolean; raw: RawRow | undefined } {
  const raw = testRows.find(
    (r) => r.match_id === applied.match_id && r.market === applied.market && r.selection === applied.selection
  );
  return { outcome: raw ? raw.outcome : false, raw };
}

function evaluateFold(applied: AppliedRow[], market: 'ML' | 'OU25', testRows: RawRow[]): Record<MethodName, FoldMetricsEval> {
  const result = {} as Record<MethodName, FoldMetricsEval>;
  for (const m of ['raw', 'temperature', 'shrinkage', 'isotonic'] as MethodName[]) {
    const rows = applied.filter((r) => r.market === market && r.method === m && r.eligible !== false);
    if (market === 'ML') {
      const byMatch = new Map<string, AppliedRow>();
      for (const r of rows) if (!byMatch.has(r.match_id)) byMatch.set(r.match_id, r);
      const unique = Array.from(byMatch.values());
      const dists = unique.map((r) => ({
        pHome: r.cal_pHome ?? 0, pDraw: r.cal_pDraw ?? 0, pAway: r.cal_pAway ?? 0,
      }));
      const outs = unique.map((r) => {
        const raw = testRows.find((x) => x.match_id === r.match_id && x.market === 'ML');
        return raw?.actual_result ?? 'D';
      });
      const ev = evalMulticlass(dists, outs);
      const profits = rows.map((r) => r.profit!).filter((v) => v !== null);
      const roi = profits.length ? profits.reduce((s, v) => s + v, 0) / profits.length : null;
      const wins = rows.filter((r) => (r.profit ?? 0) > 0).length;
      result[m] = {
        method: m, n: unique.length,
        brier: ev.brier, logloss: ev.logloss, ece: ev.ece, slope: ev.slope, intercept: ev.intercept,
        roi: roi !== null ? Number(roi.toFixed(4)) : null,
        win_rate: rows.length ? Number((wins / rows.length).toFixed(4)) : null,
        calibration_status: ev.calibration_status,
      };
    } else {
      const probs = rows.map((r) => r.cal_probability);
      const outs = rows.map((r) => outcomeFor(r, testRows).outcome);
      const ev = evalBinary(probs, outs);
      const profits = rows.map((r) => r.profit!).filter((v) => v !== null);
      const roi = profits.length ? profits.reduce((s, v) => s + v, 0) / profits.length : null;
      const wins = rows.filter((r) => (r.profit ?? 0) > 0).length;
      result[m] = {
        method: m, n: rows.length,
        brier: ev.brier, logloss: ev.logloss, ece: ev.ece, slope: ev.slope, intercept: ev.intercept,
        roi: roi !== null ? Number(roi.toFixed(4)) : null,
        win_rate: rows.length ? Number((wins / rows.length).toFixed(4)) : null,
        calibration_status: ev.calibration_status,
      };
    }
  }
  return result;
}

export interface EvBucketRow {
  bucket: string;
  n: number;
  avg_ev: number | null;
  realized_roi: number | null;
  roi_ci95: [number, number] | null;
  win_rate: number | null;
}

function evBuckets(rows: AppliedRow[]): EvBucketRow[] {
  const ranges = [
    { label: '<0%', lo: -Infinity, hi: 0 },
    { label: '0-5%', lo: 0, hi: 0.05 },
    { label: '5-10%', lo: 0.05, hi: 0.1 },
    { label: '10-20%', lo: 0.1, hi: 0.2 },
    { label: '20-30%', lo: 0.2, hi: 0.3 },
    { label: '30%+', lo: 0.3, hi: Infinity },
  ];
  const buckets: EvBucketRow[] = [];
  for (const r of ranges) {
    const items = rows.filter((x) => (x.cal_ev ?? -999) >= r.lo && (x.cal_ev ?? -999) < r.hi);
    if (items.length === 0) {
      buckets.push({ bucket: r.label, n: 0, avg_ev: null, realized_roi: null, roi_ci95: null, win_rate: null });
      continue;
    }
    const avgEv = items.reduce((s, x) => s + (x.cal_ev ?? 0), 0) / items.length;
    const profits = items.map((x) => x.profit!).filter((v) => v !== null);
    const roi = profits.length ? profits.reduce((s, v) => s + v, 0) / profits.length : null;
    const meanProf = profits.length ? profits.reduce((s, v) => s + v, 0) / profits.length : 0;
    const std = profits.length > 1 ? Math.sqrt(profits.reduce((s, v) => s + (v - meanProf) ** 2, 0) / (profits.length - 1)) : 0;
    const se = profits.length ? std / Math.sqrt(profits.length) : 0;
    const wins = items.filter((x) => (x.profit ?? 0) > 0).length;
    buckets.push({
      bucket: r.label, n: items.length,
      avg_ev: Number(avgEv.toFixed(4)),
      realized_roi: roi !== null ? Number(roi.toFixed(4)) : null,
      roi_ci95: profits.length ? [Number((roi! - 1.96 * se).toFixed(4)), Number((roi! + 1.96 * se).toFixed(4))] : null,
      win_rate: Number((wins / items.length).toFixed(4)),
    });
  }
  return buckets;
}

function main(): void {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const matches = loadJsonl<NormalizedMatch>(path.join(HIST_OUT_DIR, 'normalized_matches.jsonl'));
  const snaps = loadJsonl<FeatureSnapshot>(path.join(HIST_OUT_DIR, 'feature_snapshots.jsonl'));
  const oddsList = loadJsonl<HistoricalOdds>(path.join(HIST_OUT_DIR, 'historical_odds.jsonl'));

  const folds = buildFolds(seasonsOf(matches));
  const folded = scanFolds(matches, snaps, oddsList, folds);

  const allApplied: AppliedRow[] = [];
  const calibrationFits: FoldCalibration[] = [];
  const foldMetrics: Array<{
    test_season: string;
    ML: Record<MethodName, FoldMetricsEval>;
    OU25: Record<MethodName, FoldMetricsEval>;
  }> = [];

  const allRawRows: RawRow[] = [];
  for (const fold of folded) {
    const cal = fitPerFold(fold);
    calibrationFits.push(cal);
    const applied = applyCalibrators(fold.rawTest, cal);
    allApplied.push(...applied);
    allRawRows.push(...fold.rawTest);
    foldMetrics.push({
      test_season: fold.test_season,
      ML: evaluateFold(applied, 'ML', fold.rawTest),
      OU25: evaluateFold(applied, 'OU25', fold.rawTest),
    });
  }
  allRawCache = new Map(allRawRows.map((r) => [rawKey(r.match_id, r.market, r.selection), r]));

  const report = {
    version: PHASE2B_VERSION,
    baseline_ref: BASELINE_REF,
    generated_at: new Date().toISOString(),
    protocol: {
      walk_forward: true,
      calibrator_fit: 'prior seasons only; no test-fold outcome enters any fit',
      leakage_protection: 'raw model fitted on train seasons; calibrators fitted on train-season raw predictions; evaluation strictly on test seasons',
      methods: ['raw', 'temperature', 'shrinkage', 'isotonic'],
    },
    folds: foldMetrics,
    calibration_fits: calibrationFits.map((c) => ({
      test_season: c.test_season,
      ml: {
        temperature: { T: c.ml.temperature.temperature, n_train: c.ml.temperature.n_train, train_logloss: c.ml.temperature.train_logloss, at_boundary: c.ml.temperature.at_boundary },
        shrinkage: { alpha: c.ml.shrinkage.alpha, base_rates: c.ml.shrinkage.base_rates, n_train: c.ml.shrinkage.n_train, train_logloss: c.ml.shrinkage.train_logloss },
        isotonic: { n_train: c.ml.isotonic.n_train, train_logloss: c.ml.isotonic.train_logloss, status: c.ml.isotonic.isotonic_per_class ? 'FIT' : 'INSUFFICIENT_SAMPLE' },
      },
      binary: Object.fromEntries(Object.entries(c.binary).map(([k, v]) => [k, {
        temperature: { T: v.temperature.temperature, n_train: v.temperature.n_train, at_boundary: v.temperature.at_boundary },
        shrinkage: { alpha: v.shrinkage.alpha, base_rate: v.shrinkage.base_rate, n_train: v.shrinkage.n_train },
        isotonic: { n_train: v.isotonic.n_train, status: v.isotonic.isotonic_x ? 'FIT' : 'INSUFFICIENT_SAMPLE' },
      }])),
    })),
    aggregate: {
      ML: summarizeAggregate(allApplied, 'ML'),
      OU25: summarizeAggregate(allApplied, 'OU25'),
    },
    ev_buckets: {
      ML_raw: evBuckets(allApplied.filter((r) => r.market === 'ML' && r.method === 'raw')),
      ML_calibrated_temperature: evBuckets(allApplied.filter((r) => r.market === 'ML' && r.method === 'temperature')),
      ML_calibrated_shrinkage: evBuckets(allApplied.filter((r) => r.market === 'ML' && r.method === 'shrinkage')),
      ML_calibrated_isotonic: evBuckets(allApplied.filter((r) => r.market === 'ML' && r.method === 'isotonic')),
      OU25_raw: evBuckets(allApplied.filter((r) => r.market === 'OU25' && r.method === 'raw')),
      OU25_calibrated_shrinkage: evBuckets(allApplied.filter((r) => r.market === 'OU25' && r.method === 'shrinkage')),
    },
    note: 'Phase 2b research artifacts. Nothing here is used in production. Production continues with phase2a-baseline.',
  };

  fs.writeFileSync(path.join(OUT_DIR, 'phase2b_report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(
    path.join(OUT_DIR, 'applied_predictions.jsonl'),
    allApplied.map((r) => JSON.stringify(r)).join('\n')
  );
  fs.writeFileSync(
    path.join(OUT_DIR, 'raw_predictions.jsonl'),
    allRawRows.map((r) => JSON.stringify(r)).join('\n')
  );
  console.log(JSON.stringify(report, null, 2));
}

function summarizeAggregate(applied: AppliedRow[], market: 'ML' | 'OU25') {
  const byMethod: Record<MethodName, AppliedRow[]> = { raw: [], temperature: [], shrinkage: [], isotonic: [] };
  for (const r of applied) {
    if (r.market !== market || r.eligible === false) continue;
    byMethod[r.method].push(r);
  }
  return Object.fromEntries(
    (Object.keys(byMethod) as MethodName[]).map((m) => {
      const rows = byMethod[m];
      if (market === 'ML') {
        const byMatch = new Map<string, AppliedRow>();
        for (const r of rows) if (!byMatch.has(r.match_id)) byMatch.set(r.match_id, r);
        const unique = Array.from(byMatch.values());
        const dists = unique.map((r2) => ({ pHome: r2.cal_pHome ?? 0, pDraw: r2.cal_pDraw ?? 0, pAway: r2.cal_pAway ?? 0 }));
        const outs = unique.map((r2) => {
          const raw = allRawCache.get(rawKey(r2.match_id, 'ML', 'home'));
          return raw?.actual_result ?? 'D';
        });
        const ev = evalMulticlass(dists, outs);
        const profits = rows.map((r2) => r2.profit!).filter((v) => v !== null);
        const roi = profits.length ? profits.reduce((s, v) => s + v, 0) / profits.length : null;
        const wins = rows.filter((r2) => (r2.profit ?? 0) > 0).length;
        return [m, {
          n: unique.length, brier: ev.brier, logloss: ev.logloss, ece: ev.ece,
          slope: ev.slope, intercept: ev.intercept, calibration_status: ev.calibration_status,
          roi: roi !== null ? Number(roi.toFixed(4)) : null,
          win_rate: rows.length ? Number((wins / rows.length).toFixed(4)) : null,
          avg_ev: rows.length ? Number((rows.reduce((s, r2) => s + (r2.cal_ev ?? 0), 0) / rows.length).toFixed(4)) : null,
        }];
      }
      const probs = rows.map((r2) => r2.cal_probability);
      const outs = rows.map((r2) => {
        const raw = allRawCache.get(rawKey(r2.match_id, 'OU25', r2.selection));
        return raw ? raw.outcome : false;
      });
      const ev = evalBinary(probs, outs);
      const profits = rows.map((r2) => r2.profit!).filter((v) => v !== null);
      const roi = profits.length ? profits.reduce((s, v) => s + v, 0) / profits.length : null;
      const wins = rows.filter((r2) => (r2.profit ?? 0) > 0).length;
      return [m, {
        n: rows.length, brier: ev.brier, logloss: ev.logloss, ece: ev.ece,
        slope: ev.slope, intercept: ev.intercept, calibration_status: ev.calibration_status,
        roi: roi !== null ? Number(roi.toFixed(4)) : null,
        win_rate: rows.length ? Number((wins / rows.length).toFixed(4)) : null,
        avg_ev: rows.length ? Number((rows.reduce((s, r2) => s + (r2.cal_ev ?? 0), 0) / rows.length).toFixed(4)) : null,
      }];
    })
  );
}

let allRawCache: Map<string, RawRow> = new Map();

function rawKey(matchId: string, market: string, selection: string): string {
  return `${matchId}|${market}|${selection}`;
}

main();