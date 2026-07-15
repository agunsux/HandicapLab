/**
 * EPIC 31B — Production Replay & Shadow Validation
 * Determinism Validator Tests
 */

import { describe, it, expect } from 'vitest';
import { DeterminismValidator } from '../../src/lib/epic31b/determinism-validator';
import type { ReplayOutcome } from '../../src/lib/epic31b/types';

describe('EPIC 31B — Determinism Validator', () => {
  it('should verify identical outcomes from identical seeds', async () => {
    const mockOutcomes: ReplayOutcome[] = [
      {
        fixtureId: 'test-1',
        marketType: 'ML',
        selection: 'home',
        predictedProbability: 0.65,
        actualResult: 1,
        profitLoss: 0.5,
        brierScore: 0.1225,
        logLoss: 0.4308,
        clv: 0.02,
        kellyStake: 0.1,
        expectedValue: 0.05,
        settledOutcome: 'WIN',
        settlementProfitUnits: 0.5,
      },
      {
        fixtureId: 'test-2',
        marketType: 'ML',
        selection: 'away',
        predictedProbability: 0.45,
        actualResult: 0,
        profitLoss: -0.1,
        brierScore: 0.2025,
        logLoss: 0.7985,
        clv: -0.01,
        kellyStake: 0.05,
        expectedValue: -0.02,
        settledOutcome: 'LOSS',
        settlementProfitUnits: -0.1,
      },
    ];

    const hash1 = DeterminismValidator.hashOutcomes(mockOutcomes);
    const hash2 = DeterminismValidator.hashOutcomes(mockOutcomes);
    expect(hash1).toBe(hash2);
  });

  it('should detect differences in outcomes', async () => {
    const outcomes1: ReplayOutcome[] = [
      {
        fixtureId: 'test-1',
        marketType: 'ML',
        selection: 'home',
        predictedProbability: 0.65,
        actualResult: 1,
        profitLoss: 0.5,
        brierScore: 0.1225,
        logLoss: 0.4308,
        clv: 0.02,
        kellyStake: 0.1,
        expectedValue: 0.05,
        settledOutcome: 'WIN',
        settlementProfitUnits: 0.5,
      },
    ];

    const outcomes2: ReplayOutcome[] = [
      {
        fixtureId: 'test-1',
        marketType: 'ML',
        selection: 'home',
        predictedProbability: 0.66,
        actualResult: 1,
        profitLoss: 0.5,
        brierScore: 0.1225,
        logLoss: 0.4308,
        clv: 0.02,
        kellyStake: 0.1,
        expectedValue: 0.05,
        settledOutcome: 'WIN',
        settlementProfitUnits: 0.5,
      },
    ];

    const hash1 = DeterminismValidator.hashOutcomes(outcomes1);
    const hash2 = DeterminismValidator.hashOutcomes(outcomes2);
    expect(hash1).not.toBe(hash2);
  });

  it('should validate determinism with mock data', async () => {
    const proof = await DeterminismValidator.validateDeterminism('39', 2, 2);
    expect(proof.runCount).toBe(2);
    expect(proof.identical).toBe(true);
    expect(proof.maxDiff).toBe(0);
    expect(proof.fieldsCompared.length).toBeGreaterThan(0);
  });
});
