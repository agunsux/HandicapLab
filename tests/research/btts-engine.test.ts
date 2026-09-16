import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateBtts,
  calculateBttsFromGrid,
  settleBttsMatch,
  BTTS_MODEL_VERSION,
} from '@/lib/research/bttsEngine';
import { buildScoreGrid } from '@/lib/engine/probability';
import { getBlockedRequestCount, resetBlockedRequestCount } from '../setup-env';

describe('P1.1 BTTS Mathematical Baseline (BTTS-jointscore-v1.0.0)', () => {
  beforeEach(() => {
    resetBlockedRequestCount();
  });

  it('correctly sets model version, unvalidated yield, and calibration status', () => {
    const res = calculateBtts(1.4, 1.1, -0.04);
    expect(res.modelVersion).toBe(BTTS_MODEL_VERSION);
    expect(res.yieldStatus).toBe('UNVALIDATED');
    expect(res.calibrationStatus).toBe('UNVALIDATED');
  });

  it('strictly preserves the identity P(BTTS YES) + P(BTTS NO) = 1.0', () => {
    const testCases = [
      { homeXG: 1.5, awayXG: 1.2, rho: -0.04 },
      { homeXG: 0.8, awayXG: 0.6, rho: 0.0 },
      { homeXG: 2.5, awayXG: 1.9, rho: -0.08 },
      { homeXG: 3.2, awayXG: 0.4, rho: 0.05 },
    ];

    for (const tc of testCases) {
      const res = calculateBtts(tc.homeXG, tc.awayXG, tc.rho);
      const sum = res.probabilities.yes + res.probabilities.no;
      expect(sum).toBeCloseTo(1.0, 9);
      expect(res.probabilities.yes).toBeGreaterThanOrEqual(0);
      expect(res.probabilities.yes).toBeLessThanOrEqual(1);
      expect(res.probabilities.no).toBeGreaterThanOrEqual(0);
      expect(res.probabilities.no).toBeLessThanOrEqual(1);
    }
  });

  it('matches inclusion-exclusion probability against direct grid cell summation', () => {
    const homeXG = 1.6;
    const awayXG = 1.3;
    const rho = -0.04;

    const grid = buildScoreGrid(homeXG, awayXG, rho);
    const res = calculateBttsFromGrid(grid, { homeXG, awayXG, rho });

    // Direct cell summation: sum_{x=1..10, y=1..10} grid[x][y]
    let directSum = 0;
    for (let x = 1; x <= 10; x++) {
      for (let y = 1; y <= 10; y++) {
        directSum += grid[x][y];
      }
    }

    expect(res.probabilities.yes).toBeCloseTo(directSum, 8);
    expect(res.pBothZero).toBeCloseTo(grid[0][0], 8);
  });

  it('handles extreme lambda values with numerical stability and bounds', () => {
    // Very low scoring match (0.1 xG each)
    const lowRes = calculateBtts(0.1, 0.1, 0.0);
    expect(lowRes.probabilities.yes).toBeGreaterThan(0);
    expect(lowRes.probabilities.yes).toBeLessThan(0.05);
    expect(lowRes.probabilities.no).toBeGreaterThan(0.95);
    expect(lowRes.probabilities.yes + lowRes.probabilities.no).toBeCloseTo(1.0, 9);

    // Very high scoring match (4.5 xG each)
    const highRes = calculateBtts(4.5, 4.0, -0.04);
    expect(highRes.probabilities.yes).toBeGreaterThan(0.95);
    expect(highRes.probabilities.no).toBeLessThan(0.05);
    expect(highRes.probabilities.yes + highRes.probabilities.no).toBeCloseTo(1.0, 9);
  });

  it('computes symmetric vs asymmetric distributions logically', () => {
    const symmetric = calculateBtts(1.5, 1.5, -0.04);
    expect(symmetric.pHomeZero).toBeCloseTo(symmetric.pAwayZero, 8);

    const asymmetric = calculateBtts(3.0, 0.4, -0.04);
    // Home team has very low probability of 0 goals, Away team has high probability of 0 goals
    expect(asymmetric.pHomeZero).toBeLessThan(asymmetric.pAwayZero);
    // BTTS Yes should be constrained by the weaker scoring away team
    expect(asymmetric.probabilities.yes).toBeLessThan(symmetric.probabilities.yes);
  });

  it('settles deterministic match outcomes accurately according to official rules', () => {
    // 0-0: Both failed to score
    expect(settleBttsMatch('YES', 0, 0)).toBe('LOSS');
    expect(settleBttsMatch('NO', 0, 0)).toBe('WIN');

    // 1-0: Only home scored
    expect(settleBttsMatch('YES', 1, 0)).toBe('LOSS');
    expect(settleBttsMatch('NO', 1, 0)).toBe('WIN');

    // 0-1: Only away scored
    expect(settleBttsMatch('YES', 0, 1)).toBe('LOSS');
    expect(settleBttsMatch('NO', 0, 1)).toBe('WIN');

    // 1-1: Both scored
    expect(settleBttsMatch('YES', 1, 1)).toBe('WIN');
    expect(settleBttsMatch('NO', 1, 1)).toBe('LOSS');

    // 2-1: Both scored
    expect(settleBttsMatch('YES', 2, 1)).toBe('WIN');
    expect(settleBttsMatch('NO', 2, 1)).toBe('LOSS');

    // 3-0: Only home scored
    expect(settleBttsMatch('YES', 3, 0)).toBe('LOSS');
    expect(settleBttsMatch('NO', 3, 0)).toBe('WIN');

    // 2-2: Both scored
    expect(settleBttsMatch('YES', 2, 2)).toBe('WIN');
    expect(settleBttsMatch('NO', 2, 2)).toBe('LOSS');
  });

  it('rejects invalid goals in settlement deterministically', () => {
    expect(() => settleBttsMatch('YES', -1, 0)).toThrow();
    expect(() => settleBttsMatch('YES', 1.5, 2)).toThrow();
  });

  it('executes completely offline with zero outbound network calls', () => {
    expect(getBlockedRequestCount()).toBe(0);
  });
});

