// EPIC 35.7 — Drift Detection
// Detects feature / prediction / probability / market / league drift by
// comparing a recent window against a reference window using PSI
// (Population Stability Index).
//
// Thresholds are configurable (config.drift). Detection ONLY —
// no automatic retraining, no parameter tuning, no model changes.

import * as crypto from 'crypto';
import type {
  DriftDimension,
  DriftEventRecord,
  DriftSeverity,
  PredictionSnapshotRecord,
} from '../types';
import type { LiveValidationStore } from '../store/types';
import type { DriftThresholds, LiveValidationConfig } from '../config';
import type { Clock } from '../scheduler/prediction-scheduler';

const EPSILON = 1e-4;

/** PSI between two numeric samples, bucketed on the reference range. */
export function computePsi(
  reference: number[],
  current: number[],
  bucketCount = 10
): number {
  if (reference.length === 0 || current.length === 0) return 0;

  const min = Math.min(...reference);
  const max = Math.max(...reference);
  const width = max - min || 1;

  const refCounts = new Array<number>(bucketCount).fill(0);
  const curCounts = new Array<number>(bucketCount).fill(0);
  const bucketOf = (v: number) =>
    Math.max(0, Math.min(bucketCount - 1, Math.floor(((v - min) / width) * bucketCount)));

  for (const v of reference) refCounts[bucketOf(v)]++;
  for (const v of current) curCounts[bucketOf(v)]++;

  let psi = 0;
  for (let i = 0; i < bucketCount; i++) {
    const refPct = Math.max(EPSILON, refCounts[i] / reference.length);
    const curPct = Math.max(EPSILON, curCounts[i] / current.length);
    psi += (curPct - refPct) * Math.log(curPct / refPct);
  }
  return Number(psi.toFixed(4));
}

/** PSI over categorical distributions (e.g. league mix). */
export function categoricalPsi(
  reference: Record<string, number>,
  current: Record<string, number>
): number {
  const refTotal = Object.values(reference).reduce((a, b) => a + b, 0);
  const curTotal = Object.values(current).reduce((a, b) => a + b, 0);
  if (refTotal === 0 || curTotal === 0) return 0;

  const categories = new Set([...Object.keys(reference), ...Object.keys(current)]);
  let psi = 0;
  for (const cat of categories) {
    const refPct = Math.max(EPSILON, (reference[cat] ?? 0) / refTotal);
    const curPct = Math.max(EPSILON, (current[cat] ?? 0) / curTotal);
    psi += (curPct - refPct) * Math.log(curPct / refPct);
  }
  return Number(psi.toFixed(4));
}

export function severityForPsi(psi: number, thresholds: DriftThresholds): DriftSeverity {
  if (psi >= thresholds.psiCritical) return 'critical';
  if (psi >= thresholds.psiWarning) return 'warning';
  return 'none';
}

interface DriftCheck {
  dimension: DriftDimension;
  metric: string;
  psi: number;
  detail: string;
}

/** Extract the numeric series each drift dimension monitors. */
function numericSeries(
  predictions: PredictionSnapshotRecord[]
): Array<{ dimension: DriftDimension; metric: string; values: number[] }> {
  const evValues: number[] = [];
  const oddsValues: number[] = [];
  for (const p of predictions) {
    for (const rec of [
      p.prediction.asianHandicap,
      p.prediction.overUnder,
      p.prediction.moneyline,
    ]) {
      if (!rec) continue;
      evValues.push(rec.expectedValue);
      oddsValues.push(rec.odds);
    }
  }

  return [
    // Feature drift — model inputs proxied by the xG feature head
    {
      dimension: 'feature',
      metric: 'expected_goals_total',
      values: predictions.map(
        p => p.prediction.expectedGoalsHome + p.prediction.expectedGoalsAway
      ),
    },
    // Prediction drift — confidence and EV of emitted recommendations
    {
      dimension: 'prediction',
      metric: 'confidence',
      values: predictions.map(p => p.prediction.confidence),
    },
    {
      dimension: 'prediction',
      metric: 'expected_value',
      values: evValues,
    },
    // Probability drift — the 1X2 probability heads
    {
      dimension: 'probability',
      metric: 'home_prob',
      values: predictions.map(p => p.prediction.homeProb),
    },
    {
      dimension: 'probability',
      metric: 'draw_prob',
      values: predictions.map(p => p.prediction.drawProb),
    },
    // Market drift — odds the market offers on recommended selections
    {
      dimension: 'market',
      metric: 'recommended_odds',
      values: oddsValues,
    },
  ];
}

function leagueCounts(predictions: PredictionSnapshotRecord[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of predictions) {
    counts[p.fixture.league] = (counts[p.fixture.league] ?? 0) + 1;
  }
  return counts;
}

/** Pure drift evaluation between two prediction populations. */
export function evaluateDrift(
  reference: PredictionSnapshotRecord[],
  current: PredictionSnapshotRecord[],
  thresholds: DriftThresholds
): DriftCheck[] {
  if (reference.length < thresholds.minSamples || current.length < thresholds.minSamples) {
    return [];
  }

  const checks: DriftCheck[] = [];

  const refSeries = numericSeries(reference);
  const curSeries = numericSeries(current);
  for (let i = 0; i < refSeries.length; i++) {
    const ref = refSeries[i];
    const cur = curSeries[i];
    if (ref.values.length === 0 || cur.values.length === 0) continue;
    const psi = computePsi(ref.values, cur.values);
    checks.push({
      dimension: ref.dimension,
      metric: ref.metric,
      psi,
      detail: `PSI ${psi} on ${ref.metric} (ref n=${ref.values.length}, cur n=${cur.values.length})`,
    });
  }

  // League drift — categorical mix shift
  const leaguePsi = categoricalPsi(leagueCounts(reference), leagueCounts(current));
  checks.push({
    dimension: 'league',
    metric: 'league_mix',
    psi: leaguePsi,
    detail: `PSI ${leaguePsi} on league distribution (ref n=${reference.length}, cur n=${current.length})`,
  });

  return checks;
}

export class DriftDetector {
  constructor(
    private deps: {
      store: LiveValidationStore;
      config: LiveValidationConfig;
      clock?: Clock;
      idFactory?: () => string;
    }
  ) {}

  /** Evaluate all drift dimensions; append events for warning/critical drift. */
  async run(correlationId = 'drift-detector'): Promise<DriftEventRecord[]> {
    const { store, config } = this.deps;
    const thresholds = config.drift;
    const asOf = (this.deps.clock ? this.deps.clock() : new Date()).toISOString();
    const asOfMs = new Date(asOf).getTime();

    const currentFrom = new Date(
      asOfMs - thresholds.currentWindowDays * 86_400_000
    ).toISOString();
    const referenceFrom = new Date(
      asOfMs - (thresholds.currentWindowDays + thresholds.referenceWindowDays) * 86_400_000
    ).toISOString();

    const reference = await store.listPredictions({ from: referenceFrom, to: currentFrom });
    const current = await store.listPredictions({ from: currentFrom, to: asOf });

    const checks = evaluateDrift(reference, current, thresholds);
    const idFactory = this.deps.idFactory ?? (() => crypto.randomUUID());

    const events: DriftEventRecord[] = [];
    for (const check of checks) {
      const severity = severityForPsi(check.psi, thresholds);
      if (severity === 'none') continue; // only material drift becomes an event

      const record: DriftEventRecord = {
        id: idFactory(),
        asOf,
        dimension: check.dimension,
        metric: check.metric,
        psi: check.psi,
        severity,
        referenceWindowDays: thresholds.referenceWindowDays,
        currentWindowDays: thresholds.currentWindowDays,
        referenceSampleSize: reference.length,
        currentSampleSize: current.length,
        detail: check.detail,
        createdAt: asOf,
        createdBy: 'drift-detector',
        schemaVersion: config.schemaVersion,
        correlationId,
      };
      await store.appendDriftEvent(record);
      events.push(record);
    }

    return events;
  }
}
