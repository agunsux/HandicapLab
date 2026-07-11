/**
 * EPIC 18.2 — Reliability Engine
 * Generates reliability curves, calibration tables, confidence buckets,
 * and confidence histograms. Deterministic for identical inputs.
 */

import type { BucketStats, ReliabilityCurve, ConfidenceHistogram, CalibratorId } from './types';
import { generateReliabilityId } from './id';

export interface BinEntry {
  readonly binLower: number;
  readonly binUpper: number;
  readonly count: number;
  readonly expected: number;
  readonly observed: number;
  readonly expectedFreq: number;
  readonly observedFreq: number;
}

export function createBuckets(
  probabilities: readonly number[],
  outcomes: readonly number[],
  numBins: number
): BinEntry[] {
  const counts = new Array(numBins).fill(0);
  const expected = new Array(numBins).fill(0);
  const observed = new Array(numBins).fill(0);

  for (let i = 0; i < probabilities.length; i++) {
    const p = Math.max(0, Math.min(1, probabilities[i]));
    const idx = Math.min(numBins - 1, Math.floor(p * numBins));
    counts[idx]++;
    expected[idx] += p;
    observed[idx] += outcomes[i] ?? 0;
  }

  const bins: BinEntry[] = [];
  for (let i = 0; i < numBins; i++) {
    bins.push({
      binLower: i / numBins,
      binUpper: (i + 1) / numBins,
      count: counts[i],
      expected: expected[i],
      observed: observed[i],
      expectedFreq: counts[i] > 0 ? expected[i] / counts[i] : 0,
      observedFreq: counts[i] > 0 ? observed[i] / counts[i] : 0,
    });
  }

  return bins;
}

export class ReliabilityEngine {
  buildCurve(
    datasetId: string,
    market: string,
    calibratorId: CalibratorId,
    probabilities: readonly number[],
    outcomes: readonly number[],
    numBins = 10
  ): ReliabilityCurve {
    const bins = createBuckets(probabilities, outcomes, numBins);

    const buckets: BucketStats[] = bins
      .filter((b) => b.count > 0)
      .map((b, i) => ({
        binIndex: i,
        binLower: b.binLower,
        binUpper: b.binUpper,
        count: b.count,
        expectedFrequency: b.expectedFreq,
        observedFrequency: b.observedFreq,
        expectedCount: b.expected,
        observedCount: b.observed,
        residual: b.observedFreq - b.expectedFreq,
        confidence: b.count / Math.max(...bins.filter((x) => x.count > 0).map((x) => x.count), 1),
      }));

    let ece = 0;
    let total = 0;
    let mce = 0;
    for (const b of bins) {
      if (b.count === 0) continue;
      const diff = Math.abs(b.expectedFreq - b.observedFreq);
      ece += diff * b.count;
      if (diff > mce) mce = diff;
      total += b.count;
    }
    ece = total > 0 ? ece / total : 0;

    const n = probabilities.length;
    const brierScore = n > 0 ? probabilities.reduce((s, p, i) => s + Math.pow(p - outcomes[i], 2), 0) / n : 0;
    const logLoss = n > 0 ? -probabilities.reduce((s, p, i) => {
      const pred = Math.max(0.001, Math.min(0.999, p));
      return s + (outcomes[i] * Math.log(pred) + (1 - outcomes[i]) * Math.log(1 - pred));
    }, 0) / n : 0;

    return {
      datasetId,
      market,
      calibratorId,
      buckets,
      ece: Math.round(ece * 10000) / 10000,
      mce: Math.round(mce * 10000) / 10000,
      brierScore: Math.round(brierScore * 10000) / 10000,
      logLoss: Math.round(logLoss * 10000) / 10000,
    };
  }

  buildHistogram(probabilities: readonly number[], numBins = 20): ConfidenceHistogram[] {
    const bins = new Map<number, number>();
    for (let i = 0; i < numBins; i++) bins.set(i, 0);
    for (const p of probabilities) {
      const idx = Math.min(numBins - 1, Math.floor(p * numBins));
      bins.set(idx, (bins.get(idx) ?? 0) + 1);
    }
    return Array.from(bins.entries())
      .map(([i, count]) => ({ binLower: i / numBins, binUpper: (i + 1) / numBins, count }))
      .sort((a, b) => a.binLower - b.binLower);
  }
}

export const defaultReliabilityEngine = new ReliabilityEngine();