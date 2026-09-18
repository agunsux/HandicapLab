import { describe, it, expect } from 'vitest';
import { ExpectedValueCalculator } from '../../src/lib/research/settlement/evCalculator';

describe('Phase 3: Price-Aware Expected Value Calculator Tests', () => {
  it('1. Computes exact quarter-line Expected Value with push and half states', () => {
    // Probabilities: Win=0.45, HalfWin=0.10, Push=0.20, HalfLoss=0.15, Loss=0.10
    // Odds = 2.00
    // Expected Net:
    //   0.45 * (2.0 - 1) = +0.45
    //   0.10 * (1.0 / 2) = +0.05
    //   0.20 * 0 = 0.00
    //   0.15 * (-0.50) = -0.075
    //   0.10 * (-1.00) = -0.10
    // Net EV = 0.45 + 0.05 + 0.0 - 0.075 - 0.10 = +0.325
    const res = ExpectedValueCalculator.computeQuarterLineEv(0.45, 0.10, 0.20, 0.15, 0.10, 2.00);

    expect(res.expectedValue).toBeCloseTo(0.325, 3);
    expect(res.isPositiveEv).toBe(true);
    expect(res.predictionTimeOdds).toBe(2.00);
  });

  it('2. Demonstrates that price matters: 55% at 1.60 vs 51% at 2.20', () => {
    // Scenario from user prompt:
    // Candidate A: 55% win probability at odds 1.60
    //   EV = 0.55 * (1.60 - 1) - 0.45 * 1.0 = 0.55 * 0.60 - 0.45 = 0.33 - 0.45 = -0.12 (-12% negative EV!)
    const candidateA = ExpectedValueCalculator.computeBinaryEv(0.55, 1.60);
    expect(candidateA.isPositiveEv).toBe(false);
    expect(candidateA.expectedValue).toBeCloseTo(-0.12, 2);

    // Candidate B: 51% win probability at odds 2.20
    //   EV = 0.51 * (2.20 - 1) - 0.49 * 1.0 = 0.51 * 1.20 - 0.49 = 0.612 - 0.49 = +0.122 (+12.2% positive EV!)
    const candidateB = ExpectedValueCalculator.computeBinaryEv(0.51, 2.20);
    expect(candidateB.isPositiveEv).toBe(true);
    expect(candidateB.expectedValue).toBeCloseTo(0.122, 3);
  });

  it('3. Throws error on non-viable decimal odds (odds <= 1.0)', () => {
    expect(() => ExpectedValueCalculator.computeBinaryEv(0.6, 0.95)).toThrow();
    expect(() => ExpectedValueCalculator.computeQuarterLineEv(0.5, 0, 0, 0, 0.5, 1.0)).toThrow();
  });
});

