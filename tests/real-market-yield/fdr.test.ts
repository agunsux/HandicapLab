import { describe, it, expect } from 'vitest';
import {
  applyBenjaminiHochberg,
  computeRawPValue,
  computeBootstrapCi,
} from '../../src/lib/research/real-yield/statistics';

describe('Real Market Yield — Multiple Testing FDR & Statistics', () => {
  it('1. Verifies Benjamini-Hochberg FDR against textbook reference vector', () => {
    // 5 hypotheses with raw p-values
    const input = [
      { id: 'H1', rawPValue: 0.01 },
      { id: 'H2', rawPValue: 0.04 },
      { id: 'H3', rawPValue: 0.03 },
      { id: 'H4', rawPValue: 0.20 },
      { id: 'H5', rawPValue: 0.50 },
    ];

    const res = applyBenjaminiHochberg(input, 0.10);

    // H1: rank 1 => rawQ = 5 * 0.01 = 0.05, monotonic = 0.05
    expect(res.find((r) => r.id === 'H1')?.fdrAdjustedQValue).toBeCloseTo(0.05, 4);
    expect(res.find((r) => r.id === 'H1')?.fdrPass).toBe(true);

    // H3: rank 2 (p=0.03) => rawQ = (5/2)*0.03 = 0.075, monotonic min(0.075, 0.0667) = 0.066667
    expect(res.find((r) => r.id === 'H3')?.fdrAdjustedQValue).toBeCloseTo(0.066667, 4);
    expect(res.find((r) => r.id === 'H3')?.fdrPass).toBe(true);

    // H2: rank 3 (p=0.04) => rawQ = (5/3)*0.04 = 0.066667, monotonic = 0.066667
    expect(res.find((r) => r.id === 'H2')?.fdrAdjustedQValue).toBeCloseTo(0.066667, 4);
    expect(res.find((r) => r.id === 'H2')?.fdrPass).toBe(true);

    // H4: rank 4 (p=0.20) => rawQ = (5/4)*0.20 = 0.25
    expect(res.find((r) => r.id === 'H4')?.fdrAdjustedQValue).toBeCloseTo(0.25, 4);
    expect(res.find((r) => r.id === 'H4')?.fdrPass).toBe(false);

    // H5: rank 5 (p=0.50) => rawQ = (5/5)*0.50 = 0.50
    expect(res.find((r) => r.id === 'H5')?.fdrAdjustedQValue).toBeCloseTo(0.50, 4);
    expect(res.find((r) => r.id === 'H5')?.fdrPass).toBe(false);
  });

  it('2. Computes raw p-values correctly for positive, zero, and negative mean PnL', () => {
    // Strongly positive PnL
    const positivePnl = [0.95, 0.90, 0.85, 1.05, 0.92, 0.88, 0.94, 0.91];
    const pPos = computeRawPValue(positivePnl);
    expect(pPos).toBeLessThan(0.001);

    // Strongly negative PnL
    const negativePnl = [-1, -1, -1, -1, -1, 0.95, -1, -1];
    const pNeg = computeRawPValue(negativePnl);
    expect(pNeg).toBeGreaterThanOrEqual(0.5);

    // Empty or single observation
    expect(computeRawPValue([])).toBe(1.0);
    expect(computeRawPValue([0.5])).toBe(1.0);
  });

  it('3. Seeded bootstrap CI is 100% deterministic', () => {
    const pnl = [0.95, -1, 0.90, -1, -0.5, 0.45, 1.0, -1];
    const stake = [1, 1, 1, 1, 1, 1, 1, 1];

    const run1 = computeBootstrapCi(pnl, stake, 500, 0x5eed);
    const run2 = computeBootstrapCi(pnl, stake, 500, 0x5eed);

    expect(run1.ci95[0]).toBe(run2.ci95[0]);
    expect(run1.ci95[1]).toBe(run2.ci95[1]);
    expect(run1.probabilityPositive).toBe(run2.probabilityPositive);
  });
});

