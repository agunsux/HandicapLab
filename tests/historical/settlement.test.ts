import { describe, it, expect } from 'vitest';
import {
  settleAsianHandicap,
  settleAsianTotal,
  settleMoneyline,
  settleBtts,
  profitOfOutcome,
  type SettlementOutcome,
} from '../../src/historical/settlement/settlement';

describe('settlement: moneyline', () => {
  it('home/draw/away win and lose correctly', () => {
    expect(settleMoneyline('home', 2, 1)).toBe('WIN');
    expect(settleMoneyline('home', 1, 1)).toBe('LOSS');
    expect(settleMoneyline('draw', 1, 1)).toBe('WIN');
    expect(settleMoneyline('away', 0, 3)).toBe('WIN');
    expect(settleMoneyline('away', 2, 1)).toBe('LOSS');
  });
});

describe('settlement: BTTS', () => {
  it('yes wins only when both score', () => {
    expect(settleBtts('yes', 1, 1)).toBe('WIN');
    expect(settleBtts('yes', 2, 0)).toBe('LOSS');
    expect(settleBtts('no', 2, 0)).toBe('WIN');
    expect(settleBtts('no', 1, 1)).toBe('LOSS');
  });
});

describe('settlement: Asian Handicap half lines', () => {
  it('home -0.5: win by 1 = WIN, draw = LOSS (no push)', () => {
    expect(settleAsianHandicap('home', -0.5, 1, 0)).toBe('WIN');
    expect(settleAsianHandicap('home', -0.5, 0, 0)).toBe('LOSS');
    expect(settleAsianHandicap('home', -0.5, 0, 2)).toBe('LOSS');
  });
  it('away +0.5: draw = WIN', () => {
    expect(settleAsianHandicap('away', 0.5, 1, 1)).toBe('WIN');
    expect(settleAsianHandicap('away', 0.5, 2, 1)).toBe('LOSS');
  });
  it('home -1.5: win by 2 = WIN, win by 1 = LOSS', () => {
    expect(settleAsianHandicap('home', -1.5, 3, 1)).toBe('WIN');
    expect(settleAsianHandicap('home', -1.5, 2, 1)).toBe('LOSS');
  });
});

describe('settlement: Asian Handicap integer lines (push)', () => {
  it('home -1.0: win by 1 = PUSH, win by 2 = WIN, draw = LOSS', () => {
    expect(settleAsianHandicap('home', -1.0, 2, 1)).toBe('PUSH');
    expect(settleAsianHandicap('home', -1.0, 3, 1)).toBe('WIN');
    expect(settleAsianHandicap('home', -1.0, 0, 0)).toBe('LOSS');
  });
});

describe('settlement: Asian Handicap quarter lines', () => {
  it('home -0.25: win = WIN, draw = HALF_LOSS, loss = LOSS', () => {
    expect(settleAsianHandicap('home', -0.25, 1, 0)).toBe('WIN');
    expect(settleAsianHandicap('home', -0.25, 0, 0)).toBe('HALF_LOSS');
    expect(settleAsianHandicap('home', -0.25, 0, 1)).toBe('LOSS');
  });
  it('home -0.75: win by 2 = WIN, win by 1 = HALF_WIN, draw = LOSS, loss = LOSS', () => {
    expect(settleAsianHandicap('home', -0.75, 2, 0)).toBe('WIN');
    expect(settleAsianHandicap('home', -0.75, 1, 0)).toBe('HALF_WIN');
    expect(settleAsianHandicap('home', -0.75, 0, 0)).toBe('LOSS');
    expect(settleAsianHandicap('home', -0.75, 0, 1)).toBe('LOSS');
  });
  it('away +0.25: draw = HALF_WIN, loss = LOSS, win = WIN', () => {
    expect(settleAsianHandicap('away', 0.25, 0, 0)).toBe('HALF_WIN');
    expect(settleAsianHandicap('away', 0.25, 1, 0)).toBe('LOSS');
    expect(settleAsianHandicap('away', 0.25, 0, 1)).toBe('WIN');
  });
  it('away +0.75: draw = WIN, loss by 1 = HALF_LOSS, loss by 2 = LOSS', () => {
    expect(settleAsianHandicap('away', 0.75, 0, 0)).toBe('WIN');
    expect(settleAsianHandicap('away', 0.75, 1, 0)).toBe('HALF_LOSS');
    expect(settleAsianHandicap('away', 0.75, 2, 0)).toBe('LOSS');
  });
  it('home -1.25: win by 2 = WIN, win by 1 = HALF_LOSS, win by 3 = WIN', () => {
    expect(settleAsianHandicap('home', -1.25, 3, 1)).toBe('WIN');
    expect(settleAsianHandicap('home', -1.25, 2, 1)).toBe('HALF_LOSS');
    expect(settleAsianHandicap('home', -1.25, 4, 1)).toBe('WIN');
  });
  it('home -1.75: win by 2 = HALF_WIN, win by 3 = WIN', () => {
    expect(settleAsianHandicap('home', -1.75, 3, 1)).toBe('HALF_WIN');
    expect(settleAsianHandicap('home', -1.75, 4, 1)).toBe('WIN');
  });
});

describe('settlement: Asian totals', () => {
  it('over 2.5: 3 goals = WIN, 2 goals = LOSS', () => {
    expect(settleAsianTotal('over', 2.5, 3)).toBe('WIN');
    expect(settleAsianTotal('over', 2.5, 2)).toBe('LOSS');
    expect(settleAsianTotal('under', 2.5, 2)).toBe('WIN');
  });
  it('over 3.0: exactly 3 = PUSH', () => {
    expect(settleAsianTotal('over', 3.0, 3)).toBe('PUSH');
    expect(settleAsianTotal('over', 3.0, 4)).toBe('WIN');
    expect(settleAsianTotal('under', 3.0, 3)).toBe('PUSH');
  });
  it('over 2.25: 2 goals = HALF_LOSS, 3 goals = WIN', () => {
    expect(settleAsianTotal('over', 2.25, 2)).toBe('HALF_LOSS');
    expect(settleAsianTotal('over', 2.25, 3)).toBe('WIN');
    expect(settleAsianTotal('over', 2.25, 1)).toBe('LOSS');
  });
  it('under 2.75: 3 goals = HALF_LOSS, 2 goals = WIN, 4 goals = LOSS', () => {
    expect(settleAsianTotal('under', 2.75, 3)).toBe('HALF_LOSS');
    expect(settleAsianTotal('under', 2.75, 2)).toBe('WIN');
    expect(settleAsianTotal('under', 2.75, 4)).toBe('LOSS');
  });
});

describe('settlement: profit mapping', () => {
  it('maps all five outcomes to P/L at odds 2.00, stake 1', () => {
    expect(profitOfOutcome('WIN', 2.0)).toBe(1);
    expect(profitOfOutcome('HALF_WIN', 2.0)).toBe(0.5);
    expect(profitOfOutcome('PUSH', 2.0)).toBe(0);
    expect(profitOfOutcome('HALF_LOSS', 2.0)).toBe(-0.5);
    expect(profitOfOutcome('LOSS', 2.0)).toBe(-1);
  });
});

describe('settlement: consistency with walk-forward outcomes (no push for -0.5)', () => {
  it('AH home -0.5 never returns PUSH across all scorelines', () => {
    const outcomes = new Set<SettlementOutcome>();
    for (let h = 0; h <= 5; h++) {
      for (let a = 0; a <= 5; a++) {
        outcomes.add(settleAsianHandicap('home', -0.5, h, a));
      }
    }
    expect(outcomes.has('PUSH')).toBe(false);
    expect(outcomes.has('HALF_WIN')).toBe(false);
    expect(outcomes.has('HALF_LOSS')).toBe(false);
    expect(outcomes.has('WIN')).toBe(true);
    expect(outcomes.has('LOSS')).toBe(true);
  });
});
