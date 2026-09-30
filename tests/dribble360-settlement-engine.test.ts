/**
 * DRIBBLE360 EPIC — Settlement Engine Validation Tests
 * 
 * Per EPIC §30–31: Settlement logic must be tested independently.
 * Tests cover AH, OU (line family), and BTTS with all required outcomes:
 *   WIN, LOSS, PUSH, HALF WIN, HALF LOSS
 * 
 * Uses correct decimal odds P/L convention:
 *   Half win:  0.5 × (odds - 1)
 *   Half loss: -0.5
 *   Push: 0
 *   Win: odds - 1  (for unit stake)
 *   Loss: -1
 */

import { describe, it, expect } from 'vitest';

// ============================================================================
// SETTLEMENT FUNCTIONS (pure, stateless, testable)
// ============================================================================

export type SettlementOutcome = 'WIN' | 'LOSS' | 'PUSH' | 'HALF_WIN' | 'HALF_LOSS';

/**
 * Settle an Asian Handicap bet.
 * @param side 'home' or 'away'
 * @param line The handicap line (e.g., -0.25, +0.5, -1.0)
 * @param homeGoals Actual home goals
 * @param awayGoals Actual away goals
 */
export function settleAH(
  side: 'home' | 'away',
  line: number,
  homeGoals: number,
  awayGoals: number
): SettlementOutcome {
  // For home side: adjusted = (homeGoals - awayGoals) + line
  // For away side: adjusted = (awayGoals - homeGoals) + Math.abs(line) (if line is negative for home, it's positive for away)
  // Simpler: always work from home perspective, flip for away
  const goalDiff = homeGoals - awayGoals;
  let adjusted: number;

  if (side === 'home') {
    // Home perspective: goalDiff + line
    adjusted = goalDiff + line;
  } else {
    // Away perspective: (awayGoals - homeGoals) + line = -goalDiff + line
    adjusted = -goalDiff + line;
  }

  if (adjusted === 0) return 'PUSH';
  if (adjusted > 0) {
    if (adjusted === 0.25) return 'HALF_WIN';
    return 'WIN';
  }
  // adjusted < 0
  if (adjusted === -0.25) return 'HALF_LOSS';
  return 'LOSS';
}

/**
 * Settle an Over/Under bet.
 * @param side 'over' or 'under'
 * @param line The total goals line (e.g., 2.5, 2.75, 3.0)
 * @param totalGoals Actual total goals
 */
export function settleOU(
  side: 'over' | 'under',
  line: number,
  totalGoals: number
): SettlementOutcome {
  const diff = totalGoals - line;

  if (side === 'over') {
    if (diff === 0) return 'PUSH';
    if (diff > 0) {
      if (diff === 0.25) return 'HALF_WIN';
      return 'WIN';
    }
    if (diff === -0.25) return 'HALF_LOSS';
    return 'LOSS';
  }

  // under
  const inverseDiff = -diff; // = line - totalGoals
  if (inverseDiff === 0) return 'PUSH';
  if (inverseDiff > 0) {
    if (inverseDiff === 0.25) return 'HALF_WIN';
    return 'WIN';
  }
  if (inverseDiff === -0.25) return 'HALF_LOSS';
  return 'LOSS';
}

/**
 * Settle a BTTS bet.
 * @param selection 'yes' or 'no'
 * @param homeGoals Actual home goals
 * @param awayGoals Actual away goals
 */
export function settleBTTS(
  selection: 'yes' | 'no',
  homeGoals: number,
  awayGoals: number
): SettlementOutcome {
  const bothScored = homeGoals > 0 && awayGoals > 0;
  if (selection === 'yes') return bothScored ? 'WIN' : 'LOSS';
  return bothScored ? 'LOSS' : 'WIN';
}

/**
 * Calculate P/L from a settlement outcome using decimal odds.
 * Unit stake = 1.
 * 
 * @param outcome The settlement outcome
 * @param odds Decimal odds (e.g., 1.95)
 */
export function calculatePL(outcome: SettlementOutcome, odds: number): number {
  switch (outcome) {
    case 'WIN': return odds - 1;
    case 'LOSS': return -1;
    case 'PUSH': return 0;
    case 'HALF_WIN': return 0.5 * (odds - 1);
    case 'HALF_LOSS': return -0.5;
  }
}

// ============================================================================
// TESTS — EPIC §31 Required Settlement Vectors
// ============================================================================

describe('EPIC DRIBBLE360 — Settlement Engine Validation', () => {
  describe('Asian Handicap Settlement', () => {
    // EPIC §31 Required Vectors
    it('AH Home -0.25, Draw 1-1 → Half Loss', () => {
      expect(settleAH('home', -0.25, 1, 1)).toBe('HALF_LOSS');
    });

    it('AH Home +0.25, Draw 1-1 → Half Win', () => {
      expect(settleAH('home', 0.25, 1, 1)).toBe('HALF_WIN');
    });

    it('AH Home -0.75, Win by 1 (2-1) → Half Win', () => {
      expect(settleAH('home', -0.75, 2, 1)).toBe('HALF_WIN');
    });

    it('AH Home -1.25, Win by 1 (2-1) → Half Loss', () => {
      expect(settleAH('home', -1.25, 2, 1)).toBe('HALF_LOSS');
    });

    it('AH Home -1.0, Win by 1 (2-1) → Push', () => {
      expect(settleAH('home', -1.0, 2, 1)).toBe('PUSH');
    });

    // Extended AH tests for all required lines
    it('AH Home 0, Draw 0-0 → Push', () => {
      expect(settleAH('home', 0, 0, 0)).toBe('PUSH');
    });

    it('AH Home 0, Win 1-0 → Win', () => {
      expect(settleAH('home', 0, 1, 0)).toBe('WIN');
    });

    it('AH Home 0, Loss 0-1 → Loss', () => {
      expect(settleAH('home', 0, 0, 1)).toBe('LOSS');
    });

    it('AH Home -0.5, Draw 1-1 → Loss', () => {
      expect(settleAH('home', -0.5, 1, 1)).toBe('LOSS');
    });

    it('AH Home -0.5, Win 2-1 → Win', () => {
      expect(settleAH('home', -0.5, 2, 1)).toBe('WIN');
    });

    it('AH Home +0.5, Draw 1-1 → Win', () => {
      expect(settleAH('home', 0.5, 1, 1)).toBe('WIN');
    });

    it('AH Home -1.5, Win by 1 (2-1) → Loss', () => {
      expect(settleAH('home', -1.5, 2, 1)).toBe('LOSS');
    });

    it('AH Home -1.5, Win by 2 (3-1) → Win', () => {
      expect(settleAH('home', -1.5, 3, 1)).toBe('WIN');
    });

    it('AH Home -1.75, Win by 2 (3-1) → Half Win', () => {
      expect(settleAH('home', -1.75, 3, 1)).toBe('HALF_WIN');
    });

    it('AH Home -2.0, Win by 2 (3-1) → Push', () => {
      expect(settleAH('home', -2.0, 3, 1)).toBe('PUSH');
    });

    it('AH Home -2.0, Win by 3 (4-1) → Win', () => {
      expect(settleAH('home', -2.0, 4, 1)).toBe('WIN');
    });

    it('AH Home +1.0, Loss by 1 (0-1) → Push', () => {
      expect(settleAH('home', 1.0, 0, 1)).toBe('PUSH');
    });

    it('AH Home +1.25, Loss by 1 (0-1) → Half Win', () => {
      expect(settleAH('home', 1.25, 0, 1)).toBe('HALF_WIN');
    });

    it('AH Home +1.75, Loss by 2 (0-2) → Half Loss', () => {
      expect(settleAH('home', 1.75, 0, 2)).toBe('HALF_LOSS');
    });

    // Away side tests
    it('AH Away +0.25, Draw 1-1 → Half Win (mirror of Home -0.25)', () => {
      expect(settleAH('away', 0.25, 1, 1)).toBe('HALF_WIN');
    });

    it('AH Away -0.25, Draw 1-1 → Half Loss', () => {
      expect(settleAH('away', -0.25, 1, 1)).toBe('HALF_LOSS');
    });
  });

  describe('Over/Under Settlement (Line Family)', () => {
    // EPIC §31 Required Vectors
    it('Over 2.75, 3 goals → Half Win', () => {
      expect(settleOU('over', 2.75, 3)).toBe('HALF_WIN');
    });

    it('Over 2.25, 2 goals → Half Loss', () => {
      expect(settleOU('over', 2.25, 2)).toBe('HALF_LOSS');
    });

    it('Over 3.0, 3 goals → Push', () => {
      expect(settleOU('over', 3.0, 3)).toBe('PUSH');
    });

    // Extended OU tests — line family
    it('Over 1.0, 1 goal → Push', () => {
      expect(settleOU('over', 1.0, 1)).toBe('PUSH');
    });

    it('Over 1.0, 2 goals → Win', () => {
      expect(settleOU('over', 1.0, 2)).toBe('WIN');
    });

    it('Over 1.0, 0 goals → Loss', () => {
      expect(settleOU('over', 1.0, 0)).toBe('LOSS');
    });

    it('Over 1.5, 2 goals → Win', () => {
      expect(settleOU('over', 1.5, 2)).toBe('WIN');
    });

    it('Over 1.5, 1 goal → Loss', () => {
      expect(settleOU('over', 1.5, 1)).toBe('LOSS');
    });

    it('Over 2.0, 2 goals → Push', () => {
      expect(settleOU('over', 2.0, 2)).toBe('PUSH');
    });

    it('Over 2.5, 3 goals → Win', () => {
      expect(settleOU('over', 2.5, 3)).toBe('WIN');
    });

    it('Over 2.5, 2 goals → Loss', () => {
      expect(settleOU('over', 2.5, 2)).toBe('LOSS');
    });

    it('Over 3.5, 4 goals → Win', () => {
      expect(settleOU('over', 3.5, 4)).toBe('WIN');
    });

    it('Over 3.5, 3 goals → Loss', () => {
      expect(settleOU('over', 3.5, 3)).toBe('LOSS');
    });

    it('Over 4.0, 4 goals → Push', () => {
      expect(settleOU('over', 4.0, 4)).toBe('PUSH');
    });

    it('Over 4.0, 5 goals → Win', () => {
      expect(settleOU('over', 4.0, 5)).toBe('WIN');
    });

    it('Under 2.5, 2 goals → Win', () => {
      expect(settleOU('under', 2.5, 2)).toBe('WIN');
    });

    it('Under 2.5, 3 goals → Loss', () => {
      expect(settleOU('under', 2.5, 3)).toBe('LOSS');
    });

    it('Under 2.75, 3 goals → Half Loss', () => {
      expect(settleOU('under', 2.75, 3)).toBe('HALF_LOSS');
    });

    it('Under 2.25, 2 goals → Half Win', () => {
      expect(settleOU('under', 2.25, 2)).toBe('HALF_WIN');
    });

    it('Under 3.0, 3 goals → Push', () => {
      expect(settleOU('under', 3.0, 3)).toBe('PUSH');
    });
  });

  describe('BTTS Settlement', () => {
    // EPIC §31 Required Vector
    it('BTTS Yes, 2-0 → Loss', () => {
      expect(settleBTTS('yes', 2, 0)).toBe('LOSS');
    });

    it('BTTS Yes, 2-1 → Win', () => {
      expect(settleBTTS('yes', 2, 1)).toBe('WIN');
    });

    it('BTTS Yes, 0-0 → Loss', () => {
      expect(settleBTTS('yes', 0, 0)).toBe('LOSS');
    });

    it('BTTS Yes, 1-1 → Win', () => {
      expect(settleBTTS('yes', 1, 1)).toBe('WIN');
    });

    it('BTTS No, 2-0 → Win', () => {
      expect(settleBTTS('no', 2, 0)).toBe('WIN');
    });

    it('BTTS No, 2-1 → Loss', () => {
      expect(settleBTTS('no', 2, 1)).toBe('LOSS');
    });

    it('BTTS No, 0-0 → Win', () => {
      expect(settleBTTS('no', 0, 0)).toBe('WIN');
    });

    it('BTTS No, 1-1 → Loss', () => {
      expect(settleBTTS('no', 1, 1)).toBe('LOSS');
    });
  });

  describe('P/L Calculation', () => {
    it('Win at 1.95 → +0.95', () => {
      expect(calculatePL('WIN', 1.95)).toBeCloseTo(0.95, 4);
    });

    it('Loss → -1.00', () => {
      expect(calculatePL('LOSS', 1.95)).toBe(-1);
    });

    it('Push → 0', () => {
      expect(calculatePL('PUSH', 1.95)).toBe(0);
    });

    it('Half Win at 1.95 → +0.475', () => {
      expect(calculatePL('HALF_WIN', 1.95)).toBeCloseTo(0.475, 4);
    });

    it('Half Loss → -0.50', () => {
      expect(calculatePL('HALF_LOSS', 1.95)).toBe(-0.5);
    });

    it('Win at 2.10 → +1.10', () => {
      expect(calculatePL('WIN', 2.10)).toBeCloseTo(1.10, 4);
    });

    it('Half Win at 2.10 → +0.55', () => {
      expect(calculatePL('HALF_WIN', 2.10)).toBeCloseTo(0.55, 4);
    });
  });

  describe('Exhaustive AH Line Coverage', () => {
    // Ensure all required lines (§30) produce valid outcomes
    const lines = [0, 0.25, -0.25, 0.5, -0.5, 0.75, -0.75, 1.0, -1.0, 1.25, -1.25, 1.5, -1.5, 1.75, -1.75, 2.0, -2.0];
    const results = [
      [0, 0], [1, 0], [0, 1], [1, 1], [2, 0], [2, 1], [0, 2], [3, 0], [3, 1], [4, 1],
    ];

    for (const line of lines) {
      for (const [hg, ag] of results) {
        it(`AH Home ${line >= 0 ? '+' : ''}${line}, Score ${hg}-${ag} returns valid outcome`, () => {
          const outcome = settleAH('home', line, hg, ag);
          expect(['WIN', 'LOSS', 'PUSH', 'HALF_WIN', 'HALF_LOSS']).toContain(outcome);
        });
      }
    }
  });

  describe('Exhaustive OU Line Coverage', () => {
    // Ensure all required lines (§30) produce valid outcomes
    const lines = [1.0, 1.5, 2.0, 2.25, 2.5, 2.75, 3.0, 3.5, 4.0];
    const totalGoals = [0, 1, 2, 3, 4, 5, 6];

    for (const line of lines) {
      for (const goals of totalGoals) {
        it(`OU Over ${line}, ${goals} goals returns valid outcome`, () => {
          const outcome = settleOU('over', line, goals);
          expect(['WIN', 'LOSS', 'PUSH', 'HALF_WIN', 'HALF_LOSS']).toContain(outcome);
        });
      }
    }
  });
});
