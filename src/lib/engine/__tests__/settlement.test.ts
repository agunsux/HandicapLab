import { describe, it, expect } from 'vitest';
import { settleAsianHandicap } from '../settlement';

describe('Asian Handicap Settlement Engine', () => {

  // Test 1: AH -0.75: win by 1 goal = HALF_WIN
  it('should settle AH -0.75 Home selection with 1-goal win as HALF_WIN', () => {
    // 2-1 win, diff = +1
    // dAdj = 1 + (-0.75) = 0.25 -> HALF_WIN
    const res = settleAsianHandicap(2, 1, -0.75, 'home', 2.0);
    expect(res.status).toBe('HALF_WIN');
    expect(res.profit_units).toBe(0.5); // 0.5 * (2.0 - 1) = 0.5
  });

  // Test 2: AH -0.75: win by 2 goals = WON
  it('should settle AH -0.75 Home selection with 2-goal win as WON', () => {
    // 3-1 win, diff = +2
    // dAdj = 2 + (-0.75) = 1.25 -> WON
    const res = settleAsianHandicap(3, 1, -0.75, 'home', 2.0);
    expect(res.status).toBe('WON');
    expect(res.profit_units).toBe(1.0); // 2.0 - 1 = 1.0
  });

  // Test 3: AH -0.5: draw = LOST
  it('should settle AH -0.5 Home selection with draw as LOST', () => {
    // 1-1 draw, diff = 0
    // dAdj = 0 + (-0.5) = -0.5 -> LOST
    const res = settleAsianHandicap(1, 1, -0.5, 'home', 2.0);
    expect(res.status).toBe('LOST');
    expect(res.profit_units).toBe(-1.0);
  });

  // Test 4: AH 0: draw = PUSH
  it('should settle AH 0.0 Home selection with draw as PUSH', () => {
    // 1-1 draw, diff = 0
    // dAdj = 0 + 0 = 0.0 -> PUSH
    const res = settleAsianHandicap(1, 1, 0.0, 'home', 2.0);
    expect(res.status).toBe('PUSH');
    expect(res.profit_units).toBe(0.0);
  });

  // Test 5: Additional scenarios for WIN, LOSS, HALF_WIN, HALF_LOSS, PUSH (both Home & Away)
  describe('Specific Payouts and Edge Cases', () => {
    it('should handle HALF_LOSS for home selecting -0.25 on a draw', () => {
      // 0-0 draw, diff = 0
      // dAdj = 0 + (-0.25) = -0.25 -> HALF_LOSS
      const res = settleAsianHandicap(0, 0, -0.25, 'home', 1.90);
      expect(res.status).toBe('HALF_LOSS');
      expect(res.profit_units).toBe(-0.5);
    });

    it('should handle HALF_WIN for away selecting +0.25 on a draw', () => {
      // 0-0 draw, diff = 0
      // Home handicap was -0.25, so Away handicap was +0.25
      // dAdj = 0 - (-0.25) = 0.25 -> HALF_WIN (for away)
      const res = settleAsianHandicap(0, 0, -0.25, 'away', 1.90);
      expect(res.status).toBe('HALF_WIN');
      expect(res.profit_units).toBe(0.45); // 0.5 * (1.90 - 1) = 0.45
    });

    it('should handle HALF_LOSS for away selecting +0.75 when home wins by 1', () => {
      // 2-1 win for Home, diff = 1 (Home - Away)
      // Away perspective: diff = -1
      // Home handicap was -0.75, so Away handicap was +0.75
      // dAdj = (1 - 2) - (-0.75) = -1 + 0.75 = -0.25 -> HALF_LOSS (for away)
      const res = settleAsianHandicap(2, 1, -0.75, 'away', 2.0);
      expect(res.status).toBe('HALF_LOSS');
      expect(res.profit_units).toBe(-0.5);
    });

    it('should handle WON for away selecting +0.5 on a draw', () => {
      // 1-1 draw, diff = 0 (Home - Away)
      // Away perspective: diff = 0
      // Home handicap was -0.5, so Away handicap was +0.5
      // dAdj = (1 - 1) - (-0.5) = 0.5 -> WON
      const res = settleAsianHandicap(1, 1, -0.5, 'away', 1.80);
      expect(res.status).toBe('WON');
      expect(res.profit_units).toBe(0.80);
    });
  });
});
