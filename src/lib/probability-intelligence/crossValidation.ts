/**
 * EPIC 18.6 — Cross Validation Laboratory
 * K-Fold, Walk Forward, Rolling, Expanding, Leave-One-Out strategies.
 */

import type { CrossValidationStrategy, CrossValidationFold, CrossValidationReport, CalibrationMetricsResult } from './types';
import { generateCrossValId } from './id';
import { CalibrationMetricsEngine } from './calibrationMetrics';

export class CrossValidationEngine {
  private readonly metricsEngine = new CalibrationMetricsEngine();

  runKFold(
    datasetId: string,
    probabilities: number[],
    outcomes: number[],
    k = 5
  ): CrossValidationReport {
    const n = probabilities.length;
    const foldSize = Math.max(1, Math.floor(n / k));
    const folds: CrossValidationFold[] = [];
    const allMetrics: CalibrationMetricsResult[] = [];

    for (let i = 0; i < k; i++) {
      const testStart = i * foldSize;
      const testEnd = Math.min((i + 1) * foldSize, n);
      const train = {
        probs: [...probabilities.slice(0, testStart), ...probabilities.slice(testEnd)],
        outcomes: [...outcomes.slice(0, testStart), ...outcomes.slice(testEnd)],
      };
      const test = {
        probs: probabilities.slice(testStart, testEnd),
        outcomes: outcomes.slice(testStart, testEnd),
      };

      const metrics = this.metricsEngine.compute(test.probs, test.outcomes);
      allMetrics.push(metrics);

      folds.push({
        foldIndex: i,
        trainSize: train.probs.length,
        testSize: test.probs.length,
        trainStart: '',
        trainEnd: '',
        testStart: '',
        testEnd: '',
        metrics,
      });
    }

    return this.aggregate(datasetId, 'kfold', folds, allMetrics);
  }

  private aggregate(
    datasetId: string,
    strategy: CrossValidationStrategy,
    folds: CrossValidationFold[],
    allMetrics: CalibrationMetricsResult[]
  ): CrossValidationReport {
    const keys: (keyof CalibrationMetricsResult)[] = ['ece', 'mce', 'ace', 'brierScore', 'logLoss', 'sharpness', 'resolution'];
    const aggregateMetrics = { ...allMetrics[0] };
    const stdDevMetrics = { ...allMetrics[0] };

    for (const key of keys) {
      const values = allMetrics.map((m) => m[key] as number);
      const mean = values.reduce((s, v) => s + v, 0) / values.length;
      const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
      (aggregateMetrics as any)[key] = Math.round(mean * 10000) / 10000;
      (stdDevMetrics as any)[key] = Math.round(Math.sqrt(variance) * 10000) / 10000;
    }

    return {
      datasetId,
      strategy,
      folds,
      aggregateMetrics,
      stdDevMetrics,
      generatedAt: new Date().toISOString(),
    };
  }
}

export const defaultCrossValidation = new CrossValidationEngine();