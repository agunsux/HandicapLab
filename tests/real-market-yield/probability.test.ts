import { describe, it, expect } from 'vitest';
import { HierarchicalDixonColesModel } from '../../src/lib/research/model-a/hierarchicalDixonColes';
import { AhProbabilityEngine } from '../../src/lib/research/model-a/ahProbabilityEngine';

describe('Real Market Yield — Mathematical Probability Invariants', () => {
  it('1. Bivariate score distribution matrix strictly sums to 1.0', () => {
    const testLambdas = [
      { home: 1.2, away: 0.9, rho: -0.1 },
      { home: 2.1, away: 1.5, rho: 0.02 },
      { home: 0.8, away: 2.4, rho: -0.05 },
      { home: 1.6, away: 1.6, rho: 0.0 },
    ];

    for (const params of testLambdas) {
      const dist = HierarchicalDixonColesModel.computeScoreDistribution(
        params.home,
        params.away,
        params.rho,
        10
      );

      let sum = 0;
      for (let h = 0; h <= dist.maxGoals; h++) {
        for (let a = 0; a <= dist.maxGoals; a++) {
          const p = dist.matrix[h][a];
          expect(p).toBeGreaterThanOrEqual(0);
          sum += p;
        }
      }
      expect(Math.abs(sum - 1.0)).toBeLessThan(1e-6);
    }
  });

  it('2. 1X2 probabilities derived from matrix strictly sum to 1.0', () => {
    const dist = HierarchicalDixonColesModel.computeScoreDistribution(1.55, 1.15, -0.08, 10);
    const outcomes = HierarchicalDixonColesModel.matrixToOutcomeProbabilities(dist);

    expect(outcomes.pHomeWin).toBeGreaterThan(0);
    expect(outcomes.pDraw).toBeGreaterThan(0);
    expect(outcomes.pAwayWin).toBeGreaterThan(0);

    const sum1X2 = outcomes.pHomeWin + outcomes.pDraw + outcomes.pAwayWin;
    expect(Math.abs(sum1X2 - 1.0)).toBeLessThan(1e-3);
  });

  it('3. OU 2.5 probabilities strictly sum to 1.0', () => {
    const dist = HierarchicalDixonColesModel.computeScoreDistribution(1.7, 1.3, -0.05, 10);
    let pOver = 0;
    let pUnder = 0;

    for (let h = 0; h <= dist.maxGoals; h++) {
      for (let a = 0; a <= dist.maxGoals; a++) {
        const p = dist.matrix[h][a];
        if (h + a >= 3) pOver += p;
        else pUnder += p;
      }
    }

    expect(Math.abs(pOver + pUnder - 1.0)).toBeLessThan(1e-6);
  });

  it('4. Asian Handicap line symmetry invariant: Home(L) vs Away(-L)', () => {
    const dist = HierarchicalDixonColesModel.computeScoreDistribution(1.4, 1.2, -0.04, 10);
    const testLines = [-1.5, -1.0, -0.75, -0.5, -0.25, 0.0, 0.25, 0.5, 0.75, 1.0, 1.5];

    for (const line of testLines) {
      const sym = AhProbabilityEngine.verifySymmetry(dist, line);
      expect(sym.symmetric).toBe(true);
      expect(sym.maxDiscrepancy).toBeLessThan(1e-4);
    }
  });
});

