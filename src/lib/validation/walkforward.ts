/**
 * HandicapLab Walk-Forward Validation
 * ===================================
 * Walk-forward analysis via rolling windows, seasonal splits, and chronological splits.
 *
 * All functions are pure --- no side effects.
 * No production code is modified.
 */

import { ValidationInput, ValidationMetrics, computeMetrics } from './metrics';

export interface WalkForwardWindowResult {
  startIndex: number;
  endIndex: number;
  metrics: ValidationMetrics;
}

export interface WalkForwardResult {
  windows: WalkForwardWindowResult[];
  overallMetrics: ValidationMetrics;
  rollingRoi: number[];
  rollingBrier: number[];
  rollingWinRate: number[];
}

export class WalkForwardValidator {
  static validateByWindow(
    predictions: number[], actuals: number[], odds: number[], stakes: number[],
    windowSize: number, stepSize: number
  ): WalkForwardResult {
    const n = predictions.length;
    if (n === 0) throw new Error("Cannot run walk-forward on empty data");
    const windows: WalkForwardWindowResult[] = [];
    for (let s = 0; s + windowSize <= n; s += stepSize) {
      const e = s + windowSize;
      windows.push({ startIndex: s, endIndex: e, metrics: computeMetrics({
        predictedProbabilities: predictions.slice(s, e),
        actualOutcomes: actuals.slice(s, e),
        marketOdds: odds.slice(s, e),
        stakes: stakes.slice(s, e),
      })});
    }
    const overallMetrics = computeMetrics({
      predictedProbabilities: predictions,
      actualOutcomes: actuals, marketOdds: odds, stakes: stakes,
    });
    return {
      windows,
      overallMetrics,
      rollingRoi: windows.map(w => w.metrics.roi),
      rollingBrier: windows.map(w => w.metrics.brierScore),
      rollingWinRate: windows.map(w => w.metrics.winRate),
    };
  }

  static validateBySeason(
    pBySeason: Record<string, number[]>,
    aBySeason: Record<string, number[]>,
    oBySeason: Record<string, number[]>,
    sBySeason: Record<string, number[]>
  ): Record<string, ValidationMetrics> {
    const r: Record<string, ValidationMetrics> = {};
    for (const season of Object.keys(pBySeason)) {
      r[season] = computeMetrics({
        predictedProbabilities: pBySeason[season],
        actualOutcomes: aBySeason[season],
        marketOdds: oBySeason[season],
        stakes: sBySeason[season],
      });
    }
    return r;
  }

  static validateChronological(
    predictions: number[], actuals: number[], odds: number[], stakes: number[],
    trainRatio: number = 0.7
  ): { train: ValidationMetrics; test: ValidationMetrics } {
    const n = predictions.length;
    if (n === 0) throw new Error("Cannot split empty data");
    const si = Math.floor(n * trainRatio);
    return {
      train: computeMetrics({
        predictedProbabilities: predictions.slice(0, si),
        actualOutcomes: actuals.slice(0, si),
        marketOdds: odds.slice(0, si),
        stakes: stakes.slice(0, si),
      }),
      test: computeMetrics({
        predictedProbabilities: predictions.slice(si),
        actualOutcomes: actuals.slice(si),
        marketOdds: odds.slice(si),
        stakes: stakes.slice(si),
      }),
    };
  }
}

