import { describe, it, expect } from 'vitest';
import { settleAsianHandicapBet, calculateAhExpectedValue } from '../../src/lib/research/ahSettlementEngine';

describe('GATE 1H: Asian Handicap Deterministic Settlement Suite', () => {
  it('settles 0.00 (Draw No Bet) correctly', () => {
    // Win
    expect(settleAsianHandicapBet(2, 1, 0, 1.95, 'HOME')).toEqual({
      outcome: 'WIN',
      profit: 0.95,
      returnAmount: 1.95,
    });
    // Push
    expect(settleAsianHandicapBet(1, 1, 0, 1.95, 'HOME')).toEqual({
      outcome: 'PUSH',
      profit: 0,
      returnAmount: 1.0,
    });
    // Loss
    expect(settleAsianHandicapBet(0, 1, 0, 1.95, 'HOME')).toEqual({
      outcome: 'LOSS',
      profit: -1.0,
      returnAmount: 0,
    });
  });

  it('settles -0.25 and +0.25 quarter lines correctly', () => {
    // Home -0.25 on 1-0 win -> full win
    expect(settleAsianHandicapBet(1, 0, -0.25, 2.0, 'HOME')).toEqual({
      outcome: 'WIN',
      profit: 1.0,
      returnAmount: 2.0,
    });
    // Home -0.25 on 0-0 draw -> half loss
    expect(settleAsianHandicapBet(0, 0, -0.25, 2.0, 'HOME')).toEqual({
      outcome: 'HALF_LOSS',
      profit: -0.5,
      returnAmount: 0.5,
    });
    // Away +0.25 on 0-0 draw -> half win
    expect(settleAsianHandicapBet(0, 0, 0.25, 1.9, 'AWAY')).toEqual({
      outcome: 'HALF_WIN',
      profit: 0.45,
      returnAmount: 1.45,
    });
    // Home -0.25 on 0-1 loss -> full loss
    expect(settleAsianHandicapBet(0, 1, -0.25, 2.0, 'HOME')).toEqual({
      outcome: 'LOSS',
      profit: -1.0,
      returnAmount: 0,
    });
  });

  it('settles -0.75 and +0.75 quarter lines correctly', () => {
    // Home -0.75 on 2-1 win (margin 1) -> half win
    expect(settleAsianHandicapBet(2, 1, -0.75, 2.0, 'HOME')).toEqual({
      outcome: 'HALF_WIN',
      profit: 0.5,
      returnAmount: 1.5,
    });
    // Away +0.75 on 2-1 loss (margin -1) -> half loss
    expect(settleAsianHandicapBet(2, 1, 0.75, 1.9, 'AWAY')).toEqual({
      outcome: 'HALF_LOSS',
      profit: -0.5,
      returnAmount: 0.5,
    });
    // Home -0.75 on 3-1 win (margin 2) -> full win
    expect(settleAsianHandicapBet(3, 1, -0.75, 2.0, 'HOME')).toEqual({
      outcome: 'WIN',
      profit: 1.0,
      returnAmount: 2.0,
    });
    // Home -0.75 on 1-1 draw (margin 0) -> full loss
    expect(settleAsianHandicapBet(1, 1, -0.75, 2.0, 'HOME')).toEqual({
      outcome: 'LOSS',
      profit: -1.0,
      returnAmount: 0,
    });
  });

  it('settles -1.25 and +1.25 quarter lines correctly', () => {
    // Home -1.25 on 2-1 win (margin 1) -> half loss
    expect(settleAsianHandicapBet(2, 1, -1.25, 2.0, 'HOME')).toEqual({
      outcome: 'HALF_LOSS',
      profit: -0.5,
      returnAmount: 0.5,
    });
    // Away +1.25 on 2-1 loss (margin -1) -> half win
    expect(settleAsianHandicapBet(2, 1, 1.25, 1.9, 'AWAY')).toEqual({
      outcome: 'HALF_WIN',
      profit: 0.45,
      returnAmount: 1.45,
    });
    // Home -1.25 on 3-1 win (margin 2) -> full win
    expect(settleAsianHandicapBet(3, 1, -1.25, 2.0, 'HOME')).toEqual({
      outcome: 'WIN',
      profit: 1.0,
      returnAmount: 2.0,
    });
  });

  it('settles -1.0 and -1.5 lines correctly', () => {
    // Margin 1 on -1.0 -> Push
    expect(settleAsianHandicapBet(2, 1, -1.0, 1.95, 'HOME').outcome).toBe('PUSH');
    // Margin 1 on -1.5 -> Loss
    expect(settleAsianHandicapBet(2, 1, -1.5, 1.95, 'HOME').outcome).toBe('LOSS');
    // Margin 2 on -1.5 -> Win
    expect(settleAsianHandicapBet(3, 1, -1.5, 1.95, 'HOME').outcome).toBe('WIN');
  });

  it('enforces strict payout symmetry across all quarter lines from -2.5 to +2.5', () => {
    const lines = [-2.5, -2.25, -2.0, -1.75, -1.5, -1.25, -1.0, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5];
    const scores = [
      [1, 0], [2, 0], [2, 1], [3, 1], [0, 0], [1, 1], [2, 2], [0, 1], [0, 2], [1, 2], [1, 3]
    ];

    for (const l of lines) {
      for (const [h, a] of scores) {
        const hRes = settleAsianHandicapBet(h, a, l, 2.0, 'HOME');
        const aRes = settleAsianHandicapBet(h, a, -l, 2.0, 'AWAY');

        const validOpposites =
          (hRes.outcome === 'WIN' && aRes.outcome === 'LOSS') ||
          (hRes.outcome === 'HALF_WIN' && aRes.outcome === 'HALF_LOSS') ||
          (hRes.outcome === 'PUSH' && aRes.outcome === 'PUSH') ||
          (hRes.outcome === 'HALF_LOSS' && aRes.outcome === 'HALF_WIN') ||
          (hRes.outcome === 'LOSS' && aRes.outcome === 'WIN');

        expect(validOpposites).toBe(true);
      }
    }
  });

  it('calculates 5-outcome Expected Value (EV) correctly from bivariate score distribution', () => {
    // Uniform score matrix for test
    const matrix: number[][] = Array(4).fill(0).map(() => Array(4).fill(1 / 16));
    const evCalc = calculateAhExpectedValue({ matrix }, -0.25, 2.0, 'HOME');

    expect(evCalc.pWin + evCalc.pHalfWin + evCalc.pPush + evCalc.pHalfLoss + evCalc.pLoss).toBeCloseTo(1.0, 4);
    expect(evCalc.fairOdds).not.toBeNull();
    expect(typeof evCalc.ev).toBe('number');
  });
});
