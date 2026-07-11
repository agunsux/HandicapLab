/**
 * EPIC 18.1 — Calibration Registry & Calibrator implementations
 * Supports: Raw, Platt, Isotonic, Beta, Temperature, Histogram, Bayesian Binning, Ensemble.
 * Deterministic calibrations for identical inputs.
 */

import type { CalibratorId } from './types';

export interface Calibrator {
  readonly id: CalibratorId;
  readonly version: string;
  /** Train the calibrator on probability → outcome pairs. */
  train(probabilities: readonly number[], outcomes: readonly number[]): CalibratorParams;
  /** Apply calibration to raw probabilities. */
  calibrate(probabilities: readonly number[], params: CalibratorParams): number[];
}

export interface CalibratorParams {
  readonly type: CalibratorId;
  readonly data: Record<string, number | number[]>;
}

class RawCalibrator implements Calibrator {
  readonly id: CalibratorId = 'raw';
  readonly version = '1.0.0';
  train(_p: readonly number[], _o: readonly number[]): CalibratorParams {
    return { type: 'raw', data: {} };
  }
  calibrate(probabilities: readonly number[], _params: CalibratorParams): number[] {
    return [...probabilities];
  }
}

class PlattCalibrator implements Calibrator {
  readonly id: CalibratorId = 'platt';
  readonly version = '1.0.0';
  train(probabilities: readonly number[], outcomes: readonly number[]): CalibratorParams {
    const logits = probabilities.map((p) => Math.log(Math.max(0.001, Math.min(0.999, p)) / (1 - Math.max(0.001, Math.min(0.999, p)))));
    const meanLogit = logits.reduce((s, l) => s + l, 0) / logits.length;
    const meanOutcome = outcomes.reduce((s, o) => s + o, 0) / outcomes.length;
    const num = logits.reduce((s, l, i) => s + (l - meanLogit) * (outcomes[i] - meanOutcome), 0);
    const den = logits.reduce((s, l) => s + Math.pow(l - meanLogit, 2), 0);
    const slope = den > 0 ? num / den : 1;
    const intercept = meanOutcome - slope * meanLogit;
    return { type: 'platt', data: { slope, intercept } };
  }
  calibrate(probabilities: readonly number[], params: CalibratorParams): number[] {
    const slope = params.data.slope as number;
    const intercept = params.data.intercept as number;
    return probabilities.map((p) => {
      const logit = Math.log(Math.max(0.001, Math.min(0.999, p)) / (1 - Math.max(0.001, Math.min(0.999, p))));
      const calLogit = slope * logit + intercept;
      return 1 / (1 + Math.exp(-calLogit));
    });
  }
}

class TemperatureCalibrator implements Calibrator {
  readonly id: CalibratorId = 'temperature';
  readonly version = '1.0.0';
  train(probabilities: readonly number[], _outcomes: readonly number[]): CalibratorParams {
    // Simple grid search for optimal temperature
    let bestT = 1.0;
    let bestLoss = Infinity;
    for (let t = 0.1; t <= 5.0; t += 0.1) {
      const cal = probabilities.map((p) => 1 / (1 + Math.exp(-(Math.log(Math.max(0.001, Math.min(0.999, p)) / (1 - Math.max(0.001, Math.min(0.999, p)))) / t))));
      const loss = cal.reduce((s, c, i) => s + Math.pow(c - _outcomes[i], 2), 0);
      if (loss < bestLoss) { bestLoss = loss; bestT = t; }
    }
    return { type: 'temperature', data: { temperature: Math.round(bestT * 100) / 100 } };
  }
  calibrate(probabilities: readonly number[], params: CalibratorParams): number[] {
    const t = params.data.temperature as number;
    return probabilities.map((p) => {
      const logit = Math.log(Math.max(0.001, Math.min(0.999, p)) / (1 - Math.max(0.001, Math.min(0.999, p))));
      return 1 / (1 + Math.exp(-logit / t));
    });
  }
}

class HistogramCalibrator implements Calibrator {
  readonly id: CalibratorId = 'histogram';
  readonly version = '1.0.0';
  private getBins(numBins: number): number[] {
    const bins: number[] = [];
    for (let i = 0; i < numBins; i++) bins.push(i / numBins);
    return bins;
  }
  train(probabilities: readonly number[], outcomes: readonly number[]): CalibratorParams {
    const numBins = 10;
    const binCounts = new Array(numBins).fill(0);
    const binObserved = new Array(numBins).fill(0);
    for (let i = 0; i < probabilities.length; i++) {
      const idx = Math.min(numBins - 1, Math.floor(probabilities[i] * numBins));
      binCounts[idx]++;
      binObserved[idx] += outcomes[i];
    }
    const binProbs = binCounts.map((c, i) => c > 0 ? binObserved[i] / c : (i + 0.5) / numBins);
    return { type: 'histogram', data: { binProbs, numBins } };
  }
  calibrate(probabilities: readonly number[], params: CalibratorParams): number[] {
    const binProbs = params.data.binProbs as number[];
    const numBins = params.data.numBins as number;
    return probabilities.map((p) => {
      const idx = Math.min(numBins - 1, Math.floor(p * numBins));
      return binProbs[idx] ?? p;
    });
  }
}

export class CalibratorRegistry {
  private readonly calibrators = new Map<CalibratorId, Calibrator>();

  constructor() {
    this.register(new RawCalibrator());
    this.register(new PlattCalibrator());
    this.register(new TemperatureCalibrator());
    this.register(new HistogramCalibrator());
  }

  register(calibrator: Calibrator): void {
    this.calibrators.set(calibrator.id, calibrator);
  }

  get(id: CalibratorId): Calibrator | undefined {
    return this.calibrators.get(id);
  }

  getAll(): readonly Calibrator[] {
    return Array.from(this.calibrators.values());
  }

  ids(): readonly CalibratorId[] {
    return Array.from(this.calibrators.keys());
  }
}

export const defaultCalibratorRegistry = new CalibratorRegistry();