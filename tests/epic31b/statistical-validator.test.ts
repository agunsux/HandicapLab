/**
 * EPIC 31B — Production Replay & Shadow Validation
 * Statistical Validator Tests
 */

import { describe, it, expect } from 'vitest';
import { StatisticalValidator } from '../../src/lib/epic31b/statistical-validator';
import type { ReplayOutcome } from '../../src/lib/epic31b/types';

describe('EPIC 31B — Statistical Validator', () => {
  const mockOutcomes: ReplayOutcome[] = [
    {
      fixtureId: 'test-1',
      marketType: 'ML',
      selection: 'home',
      predictedProbability: 0.7,
      actualResult: 1,
      profitLoss: 0.5,
      brierScore: 0.09,
      logLoss: 0.3567,
      clv: 0.03,
      kellyStake: 0.1,
      expectedValue: 0.05,
      settledOutcome: 'WIN',
      settlementProfitUnits: 0.5,
      homeGoals: 2,
      awayGoals: 0,
      leagueId: '39',
    },
    {
      fixtureId: 'test-2',
      marketType: 'ML',
      selection: 'away',
      predictedProbability: 0.4,
      actualResult: 0,
      profitLoss: -0.05,
      brierScore: 0.16,
      logLoss: 0.9163,
      clv: -0.01,
      kellyStake: 0.05,
      expectedValue: -0.02,
      settledOutcome: 'LOSS',
      settlementProfitUnits: -0.05,
      homeGoals: 0,
      awayGoals: 1,
      leagueId: '39',
    },
    {
      fixtureId: 'test-3',
      marketType: 'ML',
      selection: 'draw',
      predictedProbability: 0.3,
      actualResult: 0.5,
      profitLoss: 0,
      brierScore: 0.04,
      logLoss: 0,
      clv: 0.01,
      kellyStake: 0.02,
      expectedValue: 0.01,
      settledOutcome: 'PUSH',
      settlementProfitUnits: 0,
      homeGoals: 1,
      awayGoals: 1,
      leagueId: '39',
    },
  ];

  it('should compute metrics correctly', () => {
    const metrics = StatisticalValidator.computeMetrics(mockOutcomes);

    expect(metrics.totalPredictions).toBe(3);
    expect(metrics.won).toBe(1);
    expect(metrics.lost).toBe(1);
    expect(metrics.voided).toBe(1);
    expect(metrics.totalProfit).toBeGreaterThan(0);
    expect(metrics.brierScore).toBeGreaterThan(0);
    expect(metrics.logLoss).toBeGreaterThan(0);
    expect(metrics.ece).toBeDefined();
    expect(metrics.mce).toBeDefined();
    expect(metrics.sharpness).toBeDefined();
    expect(metrics.entropy).toBeDefined();
  });

  it('should compute confidence intervals', () => {
    const cis = StatisticalValidator.computeConfidenceIntervals(mockOutcomes);

    expect(cis.length).toBeGreaterThan(0);
    expect(cis[0].metric).toBe('ROI (%)');
    expect(cis[0].confidenceLevel).toBe(0.95);
    expect(cis[0].ciLower).toBeDefined();
    expect(cis[0].ciUpper).toBeDefined();
  });

  it('should compute calibration bins for Reliability Diagram', () => {
    const bins = StatisticalValidator.computeCalibrationBins(mockOutcomes);
    expect(bins).toHaveLength(10);
    expect(bins[0].lowerBound).toBe(0.0);
    expect(bins[0].upperBound).toBe(0.1);
  });

  it('should compute ROC and PR points', () => {
    const roc = StatisticalValidator.computeRocPoints(mockOutcomes);
    const pr = StatisticalValidator.computePrPoints(mockOutcomes);

    expect(roc).toHaveLength(11);
    expect(pr).toHaveLength(11);
    expect(roc[0].threshold).toBe(0.0);
    expect(roc[0].tpr).toBe(1.0);
    expect(pr[0].threshold).toBe(0.0);
  });

  it('should compute decile lifts', () => {
    const lifts = StatisticalValidator.computeDecileLifts(mockOutcomes);
    expect(lifts).toHaveLength(10);
    expect(lifts[0].decile).toBe(1);
  });

  it('should audit Kelly risk', () => {
    const risk = StatisticalValidator.computeKellyRisk(mockOutcomes);
    expect(risk.avgKellyStake).toBeCloseTo(0.0567, 4);
    expect(risk.stdDevKellyStake).toBeDefined();
    expect(risk.riskStatus).toBeDefined();
  });

  it('should audit Dixon-Coles rho parameter', () => {
    const audit = StatisticalValidator.computeDixonColesAudit(mockOutcomes);
    expect(audit.rho).toBe(-0.06);
    expect(audit.adjustmentMatchCount).toBe(2); // test-1 (2-0) is NOT dc match, test-2 (0-1) and test-3 (1-1) ARE dc matches
    expect(audit.status).toBeDefined();
  });

  it('should compute stability windows', () => {
    const windows = StatisticalValidator.computeStabilityWindows(mockOutcomes);
    expect(windows.length).toBeGreaterThan(0);
    expect(windows[0].windowIndex).toBe(1);
  });

  it('should compute multiple comparisons BH FDR adjustment', () => {
    const audit = StatisticalValidator.computeMultipleComparisons(mockOutcomes);
    expect(audit.length).toBeGreaterThan(0);
    expect(audit[0].leagueName).toBe('EPL');
    expect(audit[0].rawPValue).toBeDefined();
    expect(audit[0].adjustedPValue).toBeDefined();
    expect(audit[0].significant).toBeDefined();
  });

  it('should build league validation result', () => {
    const result = StatisticalValidator.buildLeagueValidationResult('39', mockOutcomes, {
      validFixtures: 3,
      invalidFixtures: 0,
    });

    expect(result.leagueId).toBe('39');
    expect(result.status).toBe('PASS');
    expect(result.metrics.totalPredictions).toBe(3);
    expect(result.confidenceIntervals.length).toBeGreaterThan(0);
  });
});
