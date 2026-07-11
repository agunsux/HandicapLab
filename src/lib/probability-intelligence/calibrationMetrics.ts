/**
 * EPIC 18.3 — Calibration Metrics Engine
 * Computes ECE, MCE, ACE, Brier, Log Loss, NLL, Sharpness, Resolution,
 * Uncertainty, and Murphy Decomposition.
 * All metrics deterministic for identical inputs.
 */

import type { CalibrationMetricsResult } from './types';
import { createBuckets, type BinEntry } from './reliabilityEngine';

export class CalibrationMetricsEngine {
  compute(probabilities: number[], outcomes: number[], numBins = 10): CalibrationMetricsResult {
    const n = probabilities.length;
    if (n === 0) return this.emptyMetrics();

    const buckets = createBuckets(probabilities, outcomes, numBins);

    // ECE: Expected Calibration Error
    let ece = 0;
    let mce = 0;
    let total = 0;
    for (const b of buckets) {
      if (b.count === 0) continue;
      const diff = Math.abs(b.expectedFreq - b.observedFreq);
      ece += diff * b.count;
      if (diff > mce) mce = diff;
      total += b.count;
    }
    ece = total > 0 ? ece / total : 0;

    // ACE: Adaptive Calibration Error (equal-mass bins)
    const sorted = probabilities.map((p, i) => ({ p, o: outcomes[i] })).sort((a, b) => a.p - b.p);
    const binSize = Math.max(1, Math.floor(n / numBins));
    let ace = 0;
    for (let i = 0; i < n; i += binSize) {
      const slice = sorted.slice(i, i + binSize);
      const expFreq = slice.reduce((s, x) => s + x.p, 0) / slice.length;
      const obsFreq = slice.reduce((s, x) => s + x.o, 0) / slice.length;
      ace += Math.abs(expFreq - obsFreq) * slice.length;
    }
    ace = n > 0 ? ace / n : 0;

    // Brier Score
    const brierScore = probabilities.reduce((s, p, i) => s + Math.pow(p - outcomes[i], 2), 0) / n;

    // Log Loss
    const logLoss = -probabilities.reduce((s, p, i) => {
      const pred = Math.max(0.001, Math.min(0.999, p));
      const actual = outcomes[i];
      return s + (actual * Math.log(pred) + (1 - actual) * Math.log(1 - pred));
    }, 0) / n;

    // Negative Log Likelihood
    const negativeLogLikelihood = -probabilities.reduce((s, p, i) => {
      const pred = Math.max(0.001, Math.min(0.999, p));
      return s + outcomes[i] * Math.log(pred) + (1 - outcomes[i]) * Math.log(1 - pred);
    }, 0);

    // Calibration Loss = ECE
    const calibrationLoss = ece;

    // Sharpness: variance of predictions
    const meanP = probabilities.reduce((s, p) => s + p, 0) / n;
    const sharpness = probabilities.reduce((s, p) => s + Math.pow(p - meanP, 2), 0) / n;

    // Resolution
    const baseRate = outcomes.reduce((s, o) => s + o, 0) / n;
    let resolution = 0;
    for (const b of buckets) {
      if (b.count === 0) continue;
      resolution += Math.pow(b.observedFreq - baseRate, 2) * (b.count / total);
    }

    // Uncertainty = baseRate * (1 - baseRate)
    const uncertainty = baseRate * (1 - baseRate);

    // Murphy Decomposition
    const murphyDecomposition = {
      reliability: ece,
      resolution,
      uncertainty,
    };

    return {
      ece: Math.round(ece * 10000) / 10000,
      mce: Math.round(mce * 10000) / 10000,
      ace: Math.round(ace * 10000) / 10000,
      brierScore: Math.round(brierScore * 10000) / 10000,
      logLoss: Math.round(logLoss * 10000) / 10000,
      negativeLogLikelihood: Math.round(negativeLogLikelihood * 10000) / 10000,
      calibrationLoss: Math.round(calibrationLoss * 10000) / 10000,
      sharpness: Math.round(sharpness * 10000) / 10000,
      resolution: Math.round(resolution * 10000) / 10000,
      uncertainty: Math.round(uncertainty * 10000) / 10000,
      murphyDecomposition: {
        reliability: Math.round(murphyDecomposition.reliability * 10000) / 10000,
        resolution: Math.round(murphyDecomposition.resolution * 10000) / 10000,
        uncertainty: Math.round(murphyDecomposition.uncertainty * 10000) / 10000,
      },
    };
  }

  private emptyMetrics(): CalibrationMetricsResult {
    return {
      ece: 0, mce: 0, ace: 0, brierScore: 0, logLoss: 0,
      negativeLogLikelihood: 0, calibrationLoss: 0,
      sharpness: 0, resolution: 0, uncertainty: 0,
      murphyDecomposition: { reliability: 0, resolution: 0, uncertainty: 0 },
    };
  }
}

export const defaultCalibrationMetrics = new CalibrationMetricsEngine();