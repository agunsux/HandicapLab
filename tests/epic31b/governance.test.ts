import { describe, it, expect } from 'vitest';
import { QualityGates } from '../../src/application/validation/quality-gates';
import { ReportGenerator } from '../../src/application/reporting/report-generator';
import type { StatisticalValidatorOutput } from '../../src/lib/epic31b/types';

describe('SUPER EPIC 31B.5D — Governance Platform (QA & Reporting)', () => {
  const mockStats: StatisticalValidatorOutput = {
    metrics: {
      totalMatches: 10,
      totalPredictions: 10,
      won: 6,
      lost: 4,
      voided: 0,
      roi: 8.5,
      yield: 8.5,
      avgClv: 0.02,
      winRate: 60,
      totalStake: 1.0,
      totalProfit: 0.085,
      brierScore: 0.20,
      logLoss: 0.58,
      avgKellyStake: 0.1,
      maxDrawdown: 5.0,
      sharpeRatio: 1.8,
      sortinoRatio: 2.1,
      profitFactor: 1.5,
      longestWinStreak: 3,
      longestLossStreak: 2,
      ece: 0.025,
      mce: 0.05,
      sharpness: 0.15,
      entropy: 0.90,
      accuracy: 0.60,
      precision: 0.60,
      recall: 1.0,
      f1: 0.75,
      rocauc: 0.72,
      prauc: 0.75,
      kellyRiskRatio: 0.02
    },
    confidenceIntervals: [],
    calibrationQuality: 'Good',
    statisticalConfidence: 'High',
    driftDetected: false,
    calibrationBins: [],
    rocPoints: [],
    prPoints: [],
    decileLifts: [],
    kellyRisk: {
      avgKellyStake: 0.1,
      stdDevKellyStake: 0.02,
      expectedKellyGrowth: 0.05,
      realizedKellyGrowth: 0.04,
      riskStatus: 'SAFE',
    },
    dixonColesAudit: {
      rho: -0.06,
      lowScoreCorrectionFactor: 0.20,
      adjustmentMatchCount: 5,
      status: 'OPTIMAL',
    },
    stabilityWindows: [],
    multipleComparisons: [],
  };

  it('should pass quality gates when thresholds are satisfied', () => {
    const config = {
      maxExpectedCalibrationError: 0.05,
      maxDrawdownLimit: 15.0,
      minimumExpectedValue: 0.0,
      minimumRoi: 3.0,
      requireClvPositive: true,
    };

    const gate = QualityGates.evaluate(mockStats, config);
    expect(gate.passed).toBe(true);
  });

  it('should fail quality gates when ECE is too high', () => {
    const config = {
      maxExpectedCalibrationError: 0.01, // strict
      maxDrawdownLimit: 15.0,
      minimumExpectedValue: 0.0,
      minimumRoi: 3.0,
      requireClvPositive: true,
    };

    const gate = QualityGates.evaluate(mockStats, config);
    expect(gate.passed).toBe(false);
  });
});
