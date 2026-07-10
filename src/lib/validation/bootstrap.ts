/**
 * HandicapLab Bootstrap Validation
 * =============================
 * Bootstrap resampling for confidence intervals on profit/loss.
 *
 * All functions are pure --- no side effects.
 * No production code is modified.
 */

import { ValidationInput, ValidationMetrics, computeMetrics } from './metrics';

export interface BootstrapResult {
  mean: number;
  standardError: number;
  confidenceInterval95: [number, number];
  confidenceInterval99: [number, number];
  distribution: number[];
}

export interface BootstrapValidationResult {
  metrics: ValidationMetrics;
  bootstrap: BootstrapResult;
}

export class BootstrapValidator {
  private profits: number[];

  constructor(profits: number[]) {
    this.profits = profits;
  }

  resample(samples?: number[], numBootstrap: number = 1000): BootstrapResult {
    const data = samples ?? this.profits;
    if (data.length === 0) throw new Error("Cannot bootstrap empty data");
    const n = data.length;
    const means: number[] = [];
    for (let b = 0; b < numBootstrap; b++) {
      let sum = 0;
      for (let i = 0; i < n; i++) {
        const idx = Math.floor(Math.random() * n);
        sum += data[idx];
      }
      means.push(sum / n);
    }
    means.sort((a, b) => a - b);
    const mean = means.reduce((a, b) => a + b, 0) / numBootstrap;
    const se = Math.sqrt(means.reduce((s, m) => s + Math.pow(m - mean, 2), 0) / numBootstrap);
    const l95 = Math.floor(numBootstrap * 0.025);
    const u95 = Math.floor(numBootstrap * 0.975);
    const l99 = Math.floor(numBootstrap * 0.005);
    const u99 = Math.floor(numBootstrap * 0.995);
    return {
      mean: Math.round(mean * 10000) / 10000,
      standardError: Math.round(se * 10000) / 10000,
      confidenceInterval95: [Math.round(means[l95] * 10000) / 10000, Math.round(means[u95] * 10000) / 10000],
      confidenceInterval99: [Math.round(means[l99] * 10000) / 10000, Math.round(means[u99] * 10000) / 10000],
      distribution: means,
    };
  }

  static validate(input: ValidationInput, numBootstrap: number = 1000): BootstrapValidationResult {
    const metrics = computeMetrics(input);
    const profits = input.actualOutcomes.map((o, i) => {
      if (o === 1) return input.stakes[i] * (input.marketOdds[i] - 1);
      if (o === 0.5) return 0;
      return -input.stakes[i];
    });
    const b = new BootstrapValidator(profits).resample(profits, numBootstrap);
    return { metrics, bootstrap: b };
  }
}

