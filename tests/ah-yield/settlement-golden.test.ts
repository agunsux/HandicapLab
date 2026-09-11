import { describe, it, expect } from 'vitest';
import {
  ahPnl,
  isQuarterHandicap,
  isValidHandicapLine,
  quarterComponents,
  settleAhBet,
} from '../../src/lib/research/ah-yield/ahSettlement';
import { runSettlementInvariants } from '../../src/lib/research/ah-yield/ahSelfCheck';

const score = (h: number, a: number) => ({ homeScore: h, awayScore: a });
const H = 'home' as const;
const A = 'away' as const;

describe('AH settlement — golden cases (spec §4)', () => {
  it('AH 0', () => {
    expect(settleAhBet({ side: H, line: 0, ...score(2, 1), odds: 1.9 }).outcome).toBe('FULL_WIN');
    expect(settleAhBet({ side: H, line: 0, ...score(1, 1), odds: 1.9 }).outcome).toBe('PUSH');
    expect(settleAhBet({ side: H, line: 0, ...score(0, 2), odds: 1.9 }).outcome).toBe('FULL_LOSS');
    expect(settleAhBet({ side: A, line: 0, ...score(0, 2), odds: 1.9 }).outcome).toBe('FULL_WIN');
    expect(settleAhBet({ side: A, line: 0, ...score(1, 1), odds: 1.9 }).outcome).toBe('PUSH');
  });

  it('AH -0.5 home / +0.5 away', () => {
    expect(settleAhBet({ side: H, line: -0.5, ...score(1, 0), odds: 1.9 }).outcome).toBe('FULL_WIN');
    expect(settleAhBet({ side: H, line: -0.5, ...score(0, 0), odds: 1.9 }).outcome).toBe('FULL_LOSS');
    expect(settleAhBet({ side: H, line: -0.5, ...score(0, 2), odds: 1.9 }).outcome).toBe('FULL_LOSS');
    expect(settleAhBet({ side: A, line: 0.5, ...score(1, 1), odds: 1.9 }).outcome).toBe('FULL_WIN');
    expect(settleAhBet({ side: A, line: 0.5, ...score(2, 1), odds: 1.9 }).outcome).toBe('FULL_LOSS');
  });

  it('AH -0.25 home / +0.25 away (quarter split)', () => {
    expect(settleAhBet({ side: H, line: -0.25, ...score(1, 0), odds: 1.9 }).outcome).toBe('FULL_WIN');
    expect(settleAhBet({ side: H, line: -0.25, ...score(0, 0), odds: 1.9 }).outcome).toBe('HALF_LOSS');
    expect(settleAhBet({ side: H, line: -0.25, ...score(0, 1), odds: 1.9 }).outcome).toBe('FULL_LOSS');
    expect(settleAhBet({ side: A, line: 0.25, ...score(0, 0), odds: 1.9 }).outcome).toBe('HALF_WIN');
    expect(settleAhBet({ side: A, line: 0.25, ...score(1, 0), odds: 1.9 }).outcome).toBe('FULL_LOSS');
  });

  it('AH -0.75 home / +0.75 away (quarter split)', () => {
    expect(settleAhBet({ side: H, line: -0.75, ...score(2, 0), odds: 1.9 }).outcome).toBe('FULL_WIN');
    expect(settleAhBet({ side: H, line: -0.75, ...score(1, 0), odds: 1.9 }).outcome).toBe('HALF_WIN');
    expect(settleAhBet({ side: H, line: -0.75, ...score(0, 0), odds: 1.9 }).outcome).toBe('FULL_LOSS');
    expect(settleAhBet({ side: H, line: -0.75, ...score(0, 1), odds: 1.9 }).outcome).toBe('FULL_LOSS');
    expect(settleAhBet({ side: A, line: 0.75, ...score(0, 0), odds: 1.9 }).outcome).toBe('FULL_WIN');
    expect(settleAhBet({ side: A, line: 0.75, ...score(1, 0), odds: 1.9 }).outcome).toBe('HALF_LOSS');
    expect(settleAhBet({ side: A, line: 0.75, ...score(2, 0), odds: 1.9 }).outcome).toBe('FULL_LOSS');
  });

  it('AH -1.0 home / +1.0 away (exact handicap = push)', () => {
    expect(settleAhBet({ side: H, line: -1, ...score(2, 1), odds: 1.9 }).outcome).toBe('PUSH');
    expect(settleAhBet({ side: H, line: -1, ...score(3, 1), odds: 1.9 }).outcome).toBe('FULL_WIN');
    expect(settleAhBet({ side: H, line: -1, ...score(0, 0), odds: 1.9 }).outcome).toBe('FULL_LOSS');
    expect(settleAhBet({ side: A, line: 1, ...score(1, 0), odds: 1.9 }).outcome).toBe('PUSH');
    expect(settleAhBet({ side: A, line: 1, ...score(2, 0), odds: 1.9 }).outcome).toBe('FULL_LOSS');
    expect(settleAhBet({ side: A, line: 1, ...score(0, 0), odds: 1.9 }).outcome).toBe('FULL_WIN');
  });

  it('AH -1.25 home / +1.25 away (quarter split)', () => {
    expect(settleAhBet({ side: H, line: -1.25, ...score(3, 1), odds: 1.9 }).outcome).toBe('FULL_WIN');
    expect(settleAhBet({ side: H, line: -1.25, ...score(2, 1), odds: 1.9 }).outcome).toBe('HALF_LOSS');
    expect(settleAhBet({ side: H, line: -1.25, ...score(1, 1), odds: 1.9 }).outcome).toBe('FULL_LOSS');
    expect(settleAhBet({ side: A, line: 1.25, ...score(1, 0), odds: 1.9 }).outcome).toBe('HALF_WIN');
    expect(settleAhBet({ side: A, line: 1.25, ...score(2, 0), odds: 1.9 }).outcome).toBe('FULL_LOSS');
    expect(settleAhBet({ side: A, line: 1.25, ...score(0, 0), odds: 1.9 }).outcome).toBe('FULL_WIN');
  });

  it('AH -1.5 home / +1.5 away', () => {
    expect(settleAhBet({ side: H, line: -1.5, ...score(2, 0), odds: 1.9 }).outcome).toBe('FULL_WIN');
    expect(settleAhBet({ side: H, line: -1.5, ...score(1, 0), odds: 1.9 }).outcome).toBe('FULL_LOSS');
    expect(settleAhBet({ side: A, line: 1.5, ...score(0, 1), odds: 1.9 }).outcome).toBe('FULL_WIN');
    expect(settleAhBet({ side: A, line: 1.5, ...score(2, 0), odds: 1.9 }).outcome).toBe('FULL_LOSS');
  });

  it('-1.75 home / +1.75 away', () => {
    expect(settleAhBet({ side: H, line: -1.75, ...score(3, 1), odds: 1.9 }).outcome).toBe('HALF_WIN');
    expect(settleAhBet({ side: H, line: -1.75, ...score(4, 1), odds: 1.9 }).outcome).toBe('FULL_WIN');
    expect(settleAhBet({ side: H, line: -1.75, ...score(2, 1), odds: 1.9 }).outcome).toBe('FULL_LOSS');
    expect(settleAhBet({ side: A, line: 1.75, ...score(1, 2), odds: 1.9 }).outcome).toBe('FULL_WIN');
    expect(settleAhBet({ side: A, line: 1.75, ...score(3, 1), odds: 1.9 }).outcome).toBe('HALF_LOSS');
  });

  it('-2.0 / +2.0 and +2.0 exact result', () => {
    expect(settleAhBet({ side: H, line: -2, ...score(3, 1), odds: 1.9 }).outcome).toBe('PUSH');
    expect(settleAhBet({ side: H, line: -2, ...score(4, 1), odds: 1.9 }).outcome).toBe('FULL_WIN');
    expect(settleAhBet({ side: H, line: -2, ...score(2, 1), odds: 1.9 }).outcome).toBe('FULL_LOSS');
    expect(settleAhBet({ side: A, line: 2, ...score(3, 1), odds: 1.9 }).outcome).toBe('PUSH');
    expect(settleAhBet({ side: A, line: 2, ...score(1, 4), odds: 1.9 }).outcome).toBe('FULL_WIN');
  });
});

describe('AH settlement — P&L mapping (spec §8)', () => {
  it('odds 1.90 stake 1: +0.90 / +0.45 / 0 / -0.50 / -1.00', () => {
    expect(ahPnl('FULL_WIN', 1.9)).toBeCloseTo(0.9, 10);
    expect(ahPnl('HALF_WIN', 1.9)).toBeCloseTo(0.45, 10);
    expect(ahPnl('PUSH', 1.9)).toBe(0);
    expect(ahPnl('HALF_LOSS', 1.9)).toBe(-0.5);
    expect(ahPnl('FULL_LOSS', 1.9)).toBe(-1.0);
  });

  it('stake scales P&L linearly', () => {
    expect(ahPnl('FULL_WIN', 2.0, 10)).toBeCloseTo(10, 10);
    expect(ahPnl('HALF_LOSS', 2.0, 10)).toBeCloseTo(-5, 10);
  });

  it('settlement fraction: +1 / +0.5 / 0 / -0.5 / -1', () => {
    expect(settleAhBet({ side: H, line: -0.5, ...score(1, 0), odds: 2 }).settlementFraction).toBe(1);
    expect(settleAhBet({ side: H, line: -0.25, ...score(0, 0), odds: 2 }).settlementFraction).toBe(-0.5);
    expect(settleAhBet({ side: H, line: 0, ...score(1, 1), odds: 2 }).settlementFraction).toBe(0);
    expect(settleAhBet({ side: A, line: 0.25, ...score(0, 0), odds: 2 }).settlementFraction).toBe(0.5);
  });

  it('quarter component lines are the adjacent half lines', () => {
    expect(quarterComponents(-0.25)).toEqual([-0.5, 0]);
    expect(quarterComponents(-0.75)).toEqual([-1, -0.5]);
    expect(quarterComponents(0.25)).toEqual([0, 0.5]);
    expect(quarterComponents(0.75)).toEqual([0.5, 1]);
    expect(quarterComponents(-1.25)).toEqual([-1.5, -1]);
    expect(quarterComponents(1.25)).toEqual([1, 1.5]);
  });

  it('exposes the two component outcomes for a quarter bet', () => {
    const r = settleAhBet({ side: H, line: -0.75, ...score(1, 0), odds: 1.9 });
    expect(r.isQuarterLine).toBe(true);
    expect(r.componentLines).toEqual([-1, -0.5]);
    expect(r.componentOutcomes).toEqual(['PUSH', 'FULL_WIN']);
  });
});

describe('AH settlement — line validation and adversarial inputs (spec §26)', () => {
  it('accepts every quarter multiple, rejects impossible lines', () => {
    for (let l = -5; l <= 5.0001; l += 0.25) {
      expect(isValidHandicapLine(Math.round(l * 100) / 100)).toBe(true);
    }
    expect(isValidHandicapLine(0.1)).toBe(false);
    expect(isValidHandicapLine(0.3)).toBe(false);
    expect(isValidHandicapLine(Number.NaN)).toBe(false);
    expect(isValidHandicapLine(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isValidHandicapLine(null)).toBe(false);
    expect(isValidHandicapLine('0.25')).toBe(false);
  });

  it('quarter detection', () => {
    expect(isQuarterHandicap(-0.25)).toBe(true);
    expect(isQuarterHandicap(0.75)).toBe(true);
    expect(isQuarterHandicap(-1.25)).toBe(true);
    expect(isQuarterHandicap(-0.5)).toBe(false);
    expect(isQuarterHandicap(0)).toBe(false);
    expect(isQuarterHandicap(-1)).toBe(false);
  });

  it('throws on impossible handicap, bad scores, odds = 1.00, negative odds, extreme odds', () => {
    expect(() => settleAhBet({ side: H, line: 0.1, ...score(1, 0), odds: 1.9 })).toThrow();
    expect(() => settleAhBet({ side: H, line: -0.5, homeScore: -1, awayScore: 0, odds: 1.9 })).toThrow();
    expect(() => settleAhBet({ side: H, line: -0.5, homeScore: 1.5, awayScore: 0, odds: 1.9 })).toThrow();
    expect(() => settleAhBet({ side: H, line: -0.5, ...score(1, 0), odds: 1.0 })).toThrow();
    expect(() => settleAhBet({ side: H, line: -0.5, ...score(1, 0), odds: 0.5 })).toThrow();
    expect(() => settleAhBet({ side: H, line: -0.5, ...score(1, 0), odds: -2 })).toThrow();
    expect(() => settleAhBet({ side: H, line: -0.5, ...score(1, 0), odds: Number.NaN })).toThrow();
    // Extreme but structurally valid odds must settle (no hidden cap).
    expect(settleAhBet({ side: H, line: -0.5, ...score(1, 0), odds: 1001 }).outcome).toBe('FULL_WIN');
    expect(ahPnl('FULL_LOSS', 1001)).toBe(-1);
  });

  it('VOID is flat for explicit voiding and missing scores', () => {
    const r = settleAhBet({ side: H, line: -0.5, ...score(1, 0), odds: 1.9, voided: true });
    expect(r.outcome).toBe('VOID');
    expect(r.pnl).toBe(0);
    expect(r.returnAmount).toBe(1);
    expect(r.settlementFraction).toBe(0);
  });

  it('symmetry: home side at line L mirrors away side at -L', () => {
    for (let l = -3; l <= 3.0001; l += 0.25) {
      const line = Math.round(l * 100) / 100;
      for (let h = 0; h <= 4; h++) {
        for (let a = 0; a <= 4; a++) {
          const home = settleAhBet({ side: 'home', line, homeScore: h, awayScore: a, odds: 1.9 });
          const away = settleAhBet({ side: 'away', line: -line, homeScore: h, awayScore: a, odds: 1.9 });
          const mirror: Record<string, string> = {
            FULL_WIN: 'FULL_LOSS',
            HALF_WIN: 'HALF_LOSS',
            PUSH: 'PUSH',
            HALF_LOSS: 'HALF_WIN',
            FULL_LOSS: 'FULL_WIN',
          };
          expect(away.outcome).toBe(mirror[home.outcome]);
        }
      }
    }
  });

  it('independent brute-force invariants pass across the full grid', () => {
    const result = runSettlementInvariants({ maxGoals: 5, maxLine: 4 });
    expect(result.failed).toBe(0);
    expect(result.checked).toBeGreaterThan(2000);
  });
});
