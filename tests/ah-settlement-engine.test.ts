import { describe, it, expect } from 'vitest';
import { settleAsianHandicapBet, calculateAhExpectedValue } from '../src/lib/research/ahSettlementEngine';

describe('Canonical Asian Handicap Settlement Engine Tests', () => {
  it('1. Line 0.00 (Pick / Draw No Bet)', () => {
    // 2-1 Home Win
    const hw = settleAsianHandicapBet(2, 1, 0, 1.95, 'HOME');
    expect(hw.outcome).toBe('WIN');
    expect(hw.profit).toBe(0.95);

    // 1-1 Draw (Push)
    const dr = settleAsianHandicapBet(1, 1, 0, 1.95, 'HOME');
    expect(dr.outcome).toBe('PUSH');
    expect(dr.profit).toBe(0);

    // 0-1 Home Loss
    const hl = settleAsianHandicapBet(0, 1, 0, 1.95, 'HOME');
    expect(hl.outcome).toBe('LOSS');
    expect(hl.profit).toBe(-1);
  });

  it('2. Line -0.25 (Quarter-ball Favorite)', () => {
    // 1-0 Home Win (diff = +0.75 -> WIN)
    expect(settleAsianHandicapBet(1, 0, -0.25, 2.00, 'HOME').outcome).toBe('WIN');
    expect(settleAsianHandicapBet(1, 0, -0.25, 2.00, 'HOME').profit).toBe(1.00);

    // 0-0 Draw (diff = -0.25 -> HALF_LOSS)
    const draw = settleAsianHandicapBet(0, 0, -0.25, 2.00, 'HOME');
    expect(draw.outcome).toBe('HALF_LOSS');
    expect(draw.profit).toBe(-0.5);

    // 0-1 Loss (diff = -1.25 -> LOSS)
    const loss = settleAsianHandicapBet(0, 1, -0.25, 2.00, 'HOME');
    expect(loss.outcome).toBe('LOSS');
    expect(loss.profit).toBe(-1.0);
  });

  it('3. Line +0.25 (Quarter-ball Underdog)', () => {
    // 1-0 Win (diff = +1.25 -> WIN)
    expect(settleAsianHandicapBet(1, 0, 0.25, 1.90, 'HOME').outcome).toBe('WIN');
    expect(settleAsianHandicapBet(1, 0, 0.25, 1.90, 'HOME').profit).toBe(0.90);

    // 0-0 Draw (diff = +0.25 -> HALF_WIN)
    const draw = settleAsianHandicapBet(0, 0, 0.25, 1.90, 'HOME');
    expect(draw.outcome).toBe('HALF_WIN');
    expect(draw.profit).toBe(0.45); // (1.90 - 1) / 2 = 0.45

    // 0-1 Loss (diff = -0.75 -> LOSS)
    expect(settleAsianHandicapBet(0, 1, 0.25, 1.90, 'HOME').outcome).toBe('LOSS');
    expect(settleAsianHandicapBet(0, 1, 0.25, 1.90, 'HOME').profit).toBe(-1.0);
  });

  it('4. Line -0.75 and +0.75 (Three-Quarter Ball)', () => {
    // Home -0.75: Win by 1 goal (diff = +0.25 -> HALF_WIN)
    const hHalfWin = settleAsianHandicapBet(2, 1, -0.75, 1.90, 'HOME');
    expect(hHalfWin.outcome).toBe('HALF_WIN');
    expect(hHalfWin.profit).toBe(0.45);

    // Away +0.75 on same 2-1 score: Lost by 1 goal (diff = -0.25 -> HALF_LOSS)
    const aHalfLoss = settleAsianHandicapBet(2, 1, 0.75, 1.95, 'AWAY');
    expect(aHalfLoss.outcome).toBe('HALF_LOSS');
    expect(aHalfLoss.profit).toBe(-0.5);

    // Home -0.75: Win by 2 goals (diff = +1.25 -> WIN)
    expect(settleAsianHandicapBet(3, 1, -0.75, 1.90, 'HOME').outcome).toBe('WIN');
  });

  it('5. Line -1.50 and +1.50 (Half-ball Single Handicap)', () => {
    // Win by 1 goal (diff = -0.50 -> LOSS for -1.5, WIN for +1.5)
    expect(settleAsianHandicapBet(2, 1, -1.50, 2.10, 'HOME').outcome).toBe('LOSS');
    expect(settleAsianHandicapBet(2, 1, 1.50, 1.80, 'AWAY').outcome).toBe('WIN');

    // Win by 2 goals (diff = +0.50 -> WIN for -1.5)
    expect(settleAsianHandicapBet(3, 1, -1.50, 2.10, 'HOME').outcome).toBe('WIN');
  });

  it('6. Strict Market Symmetry Invariant (Home Line L vs Away Line -L)', () => {
    const scores = [[1, 0], [2, 1], [0, 0], [1, 1], [0, 2], [3, 1], [1, 2]];
    const lines = [-1.75, -1.5, -1.25, -1.0, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75];

    for (const [h, a] of scores) {
      for (const line of lines) {
        const homeRes = settleAsianHandicapBet(h, a, line, 1.95, 'HOME');
        const awayRes = settleAsianHandicapBet(h, a, -line, 1.95, 'AWAY');

        if (homeRes.outcome === 'WIN') expect(awayRes.outcome).toBe('LOSS');
        else if (homeRes.outcome === 'HALF_WIN') expect(awayRes.outcome).toBe('HALF_LOSS');
        else if (homeRes.outcome === 'PUSH') expect(awayRes.outcome).toBe('PUSH');
        else if (homeRes.outcome === 'HALF_LOSS') expect(awayRes.outcome).toBe('HALF_WIN');
        else if (homeRes.outcome === 'LOSS') expect(awayRes.outcome).toBe('WIN');
      }
    }
  });

  it('7. Expected Value Calculation on AH +0 respects Push state', () => {
    // Mock 3x3 matrix: P(1-0)=0.4, P(0-0)=0.3, P(0-1)=0.3
    const matrix = [
      [0.3, 0.3, 0],
      [0.4, 0, 0],
      [0, 0, 0]
    ];

    const res = calculateAhExpectedValue({ matrix }, 0, 2.00, 'HOME');
    expect(res.pWin).toBeCloseTo(0.4, 2);
    expect(res.pPush).toBeCloseTo(0.3, 2);
    expect(res.pLoss).toBeCloseTo(0.3, 2);
    // EV = 0.4*(2-1) + 0.3*(0) + 0.3*(-1) = 0.4 - 0.3 = +0.10
    expect(res.ev).toBeCloseTo(0.10, 2);
    // Fair odds = (1 - 0.3) / 0.4 = 0.7 / 0.4 = 1.75
    expect(res.fairOdds).toBe(1.75);
  });
});
