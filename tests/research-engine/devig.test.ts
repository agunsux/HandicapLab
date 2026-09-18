import { describe, it, expect } from 'vitest';
import { DeVigEngine } from '../../src/lib/research/probability/deVig';

describe('Phase 3: Market De-Vigging Engine Tests', () => {
  it('1. Two-way de-vigging removes overround and normalizes sum to 1.0', () => {
    // Sharp Pinnacle 2-way odds: 1.952 vs 1.952
    // Raw sum = 1/1.952 + 1/1.952 = 0.5123 + 0.5123 = 1.0246 (2.46% vig)
    const res = DeVigEngine.deVigTwoWay(1.952, 1.952, 'PROPORTIONAL');

    expect(res.rawOverround).toBeCloseTo(0.0246, 3);
    expect(res.impliedProbA).toBeCloseTo(0.50, 2);
    expect(res.impliedProbB).toBeCloseTo(0.50, 2);
    expect(res.impliedProbA + res.impliedProbB).toBeCloseTo(1.0, 4);
    expect(res.fairOddsA).toBeCloseTo(2.00, 2);
  });

  it('2. Two-way power method yields valid probabilities for asymmetrical lines', () => {
    // Heavy favorite vs Underdog: 1.30 vs 3.75
    const res = DeVigEngine.deVigTwoWay(1.30, 3.75, 'POWER');

    expect(res.impliedProbA + res.impliedProbB).toBeCloseTo(1.0, 4);
    expect(res.impliedProbA).toBeGreaterThan(res.impliedProbB);
    expect(res.fairOddsA).toBeGreaterThan(1.30); // Fair odds are longer than book odds
    expect(res.fairOddsB).toBeGreaterThan(3.75);
  });

  it('3. Three-way de-vigging via Shin method accounts for insider proportion', () => {
    // Typical 1X2 market: 2.10, 3.40, 3.60
    const res = DeVigEngine.deVigThreeWay(2.10, 3.40, 3.60, true);

    expect(res.method).toBe('SHIN');
    expect(res.shinZ).toBeDefined();
    expect(res.impliedProbHome + res.impliedProbDraw + res.impliedProbAway).toBeCloseTo(1.0, 4);
    expect(res.fairOddsHome).toBeGreaterThan(2.10);
    expect(res.fairOddsDraw).toBeGreaterThan(3.40);
    expect(res.fairOddsAway).toBeGreaterThan(3.60);
  });
});

