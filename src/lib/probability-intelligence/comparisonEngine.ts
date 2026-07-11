/**
 * EPIC 18.5 — Calibration Comparison Engine
 * Compares calibration strategies across metrics.
 */

import type { CalibratorId, CalibrationComparisonResult, CalibrationMetricsResult } from './types';

export class ComparisonEngine {
  compare(
    calibratorA: CalibratorId,
    calibratorB: CalibratorId,
    market: string,
    metricsA: CalibrationMetricsResult,
    metricsB: CalibrationMetricsResult
  ): CalibrationComparisonResult {
    return {
      calibratorA,
      calibratorB,
      market,
      eceDelta: Math.round((metricsB.ece - metricsA.ece) * 10000) / 10000,
      brierDelta: Math.round((metricsB.brierScore - metricsA.brierScore) * 10000) / 10000,
      logLossDelta: Math.round((metricsB.logLoss - metricsA.logLoss) * 10000) / 10000,
      sharpnessDelta: Math.round((metricsB.sharpness - metricsA.sharpness) * 10000) / 10000,
      resolutionDelta: Math.round((metricsB.resolution - metricsA.resolution) * 10000) / 10000,
      expectedImprovement: Math.round((metricsA.ece - metricsB.ece) * 10000) / 10000,
      significant: Math.abs(metricsA.ece - metricsB.ece) > 0.01,
    };
  }
}

export const defaultComparisonEngine = new ComparisonEngine();