import { describe, it, expect } from 'vitest';
import { ExactSettlementEngine } from '../../src/lib/research/settlement/exactSettlement';

describe('Phase 3: Exact Settlement Engine Tests', () => {
  it('1. Asian Handicap: verifies all 5 settlement states for Home and Away', () => {
    // WIN: 2-0, line -0.5 @ 1.95 => +0.95
    const win = ExactSettlementEngine.settleAsianHandicap(2, 0, -0.5, 1.95, 'HOME');
    expect(win.outcome).toBe('WIN');
    expect(win.profit).toBe(0.95);

    // HALF WIN: 2-1, line -0.75 @ 1.90 => +0.45
    const halfWin = ExactSettlementEngine.settleAsianHandicap(2, 1, -0.75, 1.90, 'HOME');
    expect(halfWin.outcome).toBe('HALF_WIN');
    expect(halfWin.profit).toBe(0.45);

    // PUSH: 1-1, line 0.0 @ 1.95 => 0.0
    const push = ExactSettlementEngine.settleAsianHandicap(1, 1, 0.0, 1.95, 'HOME');
    expect(push.outcome).toBe('PUSH');
    expect(push.profit).toBe(0.0);

    // HALF LOSS: 1-1, line -0.25 @ 1.95 => -0.50
    const halfLoss = ExactSettlementEngine.settleAsianHandicap(1, 1, -0.25, 1.95, 'HOME');
    expect(halfLoss.outcome).toBe('HALF_LOSS');
    expect(halfLoss.profit).toBe(-0.50);

    // LOSS: 0-1, line -0.5 @ 1.95 => -1.0
    const loss = ExactSettlementEngine.settleAsianHandicap(0, 1, -0.5, 1.95, 'HOME');
    expect(loss.outcome).toBe('LOSS');
    expect(loss.profit).toBe(-1.0);
  });

  it('2. Asian Handicap: verifies strict symmetry between Home(L) and Away(-L)', () => {
    const scores = [
      [1, 0], [2, 1], [0, 0], [1, 1], [0, 2], [3, 1]
    ];
    const lines = [-1.5, -1.25, -1.0, -0.75, -0.5, -0.25, 0.0, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5];

    for (const [h, a] of scores) {
      for (const line of lines) {
        const homeRes = ExactSettlementEngine.settleAsianHandicap(h, a, line, 1.95, 'HOME');
        const awayRes = ExactSettlementEngine.settleAsianHandicap(h, a, -line, 1.95, 'AWAY');

        if (homeRes.outcome === 'WIN') expect(awayRes.outcome).toBe('LOSS');
        else if (homeRes.outcome === 'HALF_WIN') expect(awayRes.outcome).toBe('HALF_LOSS');
        else if (homeRes.outcome === 'PUSH') expect(awayRes.outcome).toBe('PUSH');
        else if (homeRes.outcome === 'HALF_LOSS') expect(awayRes.outcome).toBe('HALF_WIN');
        else if (homeRes.outcome === 'LOSS') expect(awayRes.outcome).toBe('WIN');
      }
    }
  });

  it('3. Over/Under: verifies whole, half, and quarter lines settlement', () => {
    // Total = 2 goals
    // Under 2.5 @ 1.90 => WIN (+0.90)
    expect(ExactSettlementEngine.settleOverUnder(2, 2.5, 1.90, 'UNDER').outcome).toBe('WIN');
    expect(ExactSettlementEngine.settleOverUnder(2, 2.5, 1.90, 'UNDER').profit).toBe(0.90);

    // Over 2.5 @ 1.95 => LOSS (-1.00)
    expect(ExactSettlementEngine.settleOverUnder(2, 2.5, 1.95, 'OVER').outcome).toBe('LOSS');

    // Over 2.0 @ 1.90 on 2 goals => PUSH (0.0)
    expect(ExactSettlementEngine.settleOverUnder(2, 2.0, 1.90, 'OVER').outcome).toBe('PUSH');
    expect(ExactSettlementEngine.settleOverUnder(2, 2.0, 1.90, 'OVER').profit).toBe(0.0);

    // Over 2.25 on 2 goals => HALF_LOSS (-0.50)
    expect(ExactSettlementEngine.settleOverUnder(2, 2.25, 1.95, 'OVER').outcome).toBe('HALF_LOSS');
    expect(ExactSettlementEngine.settleOverUnder(2, 2.25, 1.95, 'OVER').profit).toBe(-0.50);

    // Under 2.25 on 2 goals => HALF_WIN (+0.45)
    const uQuarter = ExactSettlementEngine.settleOverUnder(2, 2.25, 1.90, 'UNDER');
    expect(uQuarter.outcome).toBe('HALF_WIN');
    expect(uQuarter.profit).toBe(0.45);
  });

  it('4. BTTS and Moneyline settlement matches physical facts', () => {
    // 2-1: BTTS is YES
    expect(ExactSettlementEngine.settleBtts(2, 1, 1.80, 'YES').outcome).toBe('WIN');
    expect(ExactSettlementEngine.settleBtts(2, 1, 2.05, 'NO').outcome).toBe('LOSS');

    // 2-0: BTTS is NO
    expect(ExactSettlementEngine.settleBtts(2, 0, 1.80, 'YES').outcome).toBe('LOSS');
    expect(ExactSettlementEngine.settleBtts(2, 0, 2.05, 'NO').outcome).toBe('WIN');

    // 2-1: 1X2 is HOME
    expect(ExactSettlementEngine.settleMoneyline(2, 1, 2.10, 'HOME').outcome).toBe('WIN');
    expect(ExactSettlementEngine.settleMoneyline(2, 1, 3.40, 'DRAW').outcome).toBe('LOSS');
    expect(ExactSettlementEngine.settleMoneyline(2, 1, 3.60, 'AWAY').outcome).toBe('LOSS');
  });
});

