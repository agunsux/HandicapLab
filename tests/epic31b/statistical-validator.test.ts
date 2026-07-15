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
  });

  it('should compute confidence intervals', () => {
    const cis = StatisticalValidator.computeConfidenceIntervals(mockOutcomes);

    expect(cis.length).toBeGreaterThan(0);
    expect(cis[0].metric).toBe('ROI (%)');
    expect(cis[0].confidenceLevel).toBe(0.95);
    expect(cis[0].ciLower).toBeDefined();
    expect(cis[0].ciUpper).toBeDefined();
  });

  it('should assess calibration quality', () => {
    const { calibrationQuality } = StatisticalValidator.validate(mockOutcomes);

    expect(calibrationQuality).toContain('Excellent');
  });

  it('should assess statistical confidence', () => {
    const { statisticalConfidence } = StatisticalValidator.validate(mockOutcomes);

    expect(statisticalConfidence).toContain('Insufficient');
  });

  it('should detect drift when present', () => {
    const driftingOutcomes: ReplayOutcome[] = [];
    for (let i = 0; i < 10; i++) {
      driftingOutcomes.push({
        fixtureId: `test-${i}`,
        marketType: 'ML',
        selection: 'home',
        predictedProbability: 0.5,
        actualResult: 1,
        profitLoss: 0.1,
        brierScore: 0.25,
        logLoss: 0.69,
        clv: 0.05,
        kellyStake: 0.05,
        expectedValue: 0.02,
        settledOutcome: 'WIN',
        settlementProfitUnits: 0.1,
      });
    }
    for (let i = 10; i < 20; i++) {
      driftingOutcomes.push({
        fixtureId: `test-${i}`,
        marketType: 'ML',
        selection: 'home',
        predictedProbability: 0.5,
        actualResult: 0,
        profitLoss: -0.1,
        brierScore: 0.25,
        logLoss: 0.69,
        clv: -0.05,
        kellyStake: 0.05,
        expectedValue: -0.02,
        settledOutcome: 'LOSS',
        settlementProfitUnits: -0.1,
      });
    }

    const { driftDetected } = StatisticalValidator.validate(driftingOutcomes);
    expect(driftDetected).toBe(true);
  });

  it('should not detect drift in stable data', () => {
    const { driftDetected } = StatisticalValidator.validate(mockOutcomes);
    expect(driftDetected).toBe(false);
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
