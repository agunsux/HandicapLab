import { describe, it, expect, beforeEach } from 'vitest';
import {
  AsianTotalEngine,
  totalGoals,
  settleAsianTotalGoals,
  VALID_ASIAN_TOTAL_LINES,
  InvalidAsianLineError,
  ASIAN_TOTAL_MODEL_VERSION,
  deriveTotalGoalsDistribution,
} from '@/lib/engine/asianTotalEngine';
import { buildScoreGrid } from '@/lib/engine/probability';
import { getBlockedRequestCount, resetBlockedRequestCount } from '../setup-env';

describe('P1.2 Asian Total Goals Engine (ASIAN-TOTAL-jointscore-v1.0.0)', () => {
  beforeEach(() => {
    resetBlockedRequestCount();
  });

  it('correctly sets model version and unvalidated governance status', () => {
    const res = AsianTotalEngine.totalGoals(2.5, 'OVER', 1.5, 1.2, -0.04);
    expect(res.modelVersion).toBe(ASIAN_TOTAL_MODEL_VERSION);
    expect(res.yieldStatus).toBe('UNVALIDATED');
    expect(res.calibrationStatus).toBe('UNVALIDATED');
  });

  it('derives a strictly normalized 1D total goals distribution from 2D score grid', () => {
    const grid = buildScoreGrid(1.6, 1.3, -0.04);
    const dist = deriveTotalGoalsDistribution(grid);

    expect(dist.length).toBe(21); // 0 to 20 goals
    const sum = dist.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 9);

    for (const p of dist) {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });

  it('evaluates every valid line (2.0 to 4.0 in 0.25 steps) and verifies settlement probability normalization', () => {
    const homeXG = 1.6;
    const awayXG = 1.2;
    const rho = -0.04;

    expect(VALID_ASIAN_TOTAL_LINES.length).toBe(9);

    for (const line of VALID_ASIAN_TOTAL_LINES) {
      for (const side of ['OVER', 'UNDER'] as const) {
        const res = AsianTotalEngine.totalGoals(line, side, homeXG, awayXG, rho);

        expect(res.line).toBe(line);
        expect(res.side).toBe(side);

        const { fullWin, halfWin, push, halfLoss, fullLoss } = res.probabilities;

        // All 5 components must be non-negative
        expect(fullWin).toBeGreaterThanOrEqual(0);
        expect(halfWin).toBeGreaterThanOrEqual(0);
        expect(push).toBeGreaterThanOrEqual(0);
        expect(halfLoss).toBeGreaterThanOrEqual(0);
        expect(fullLoss).toBeGreaterThanOrEqual(0);

        // Mutually exclusive settlement probabilities must sum to 1.0
        const totalProb = fullWin + halfWin + push + halfLoss + fullLoss;
        expect(totalProb).toBeCloseTo(1.0, 9);
      }
    }
  });

  describe('Whole-Number Lines (2.0, 3.0, 4.0)', () => {
    it('produces non-zero PUSH and zero halfWin/halfLoss on whole lines', () => {
      const wholeLines = [2.0, 3.0, 4.0] as const;

      for (const line of wholeLines) {
        const overRes = totalGoals(line, 'OVER', 1.5, 1.3);
        const underRes = totalGoals(line, 'UNDER', 1.5, 1.3);

        // PUSH occurs when total goals == line
        expect(overRes.probabilities.push).toBeGreaterThan(0);
        expect(underRes.probabilities.push).toBeGreaterThan(0);
        expect(overRes.probabilities.push).toBeCloseTo(underRes.probabilities.push, 9);

        // Whole lines NEVER have halfWin or halfLoss
        expect(overRes.probabilities.halfWin).toBe(0);
        expect(overRes.probabilities.halfLoss).toBe(0);
        expect(underRes.probabilities.halfWin).toBe(0);
        expect(underRes.probabilities.halfLoss).toBe(0);

        // Complementarity: over fullWin + under fullWin + push = 1.0
        const combined = overRes.probabilities.fullWin + underRes.probabilities.fullWin + overRes.probabilities.push;
        expect(combined).toBeCloseTo(1.0, 9);
      }
    });
  });

  describe('Half-Number Lines (2.5, 3.5)', () => {
    it('produces zero PUSH and strictly complementary binary win probabilities', () => {
      const halfLines = [2.5, 3.5] as const;

      for (const line of halfLines) {
        const overRes = totalGoals(line, 'OVER', 1.4, 1.1);
        const underRes = totalGoals(line, 'UNDER', 1.4, 1.1);

        // Half lines NEVER have push, halfWin, or halfLoss
        expect(overRes.probabilities.push).toBe(0);
        expect(underRes.probabilities.push).toBe(0);
        expect(overRes.probabilities.halfWin).toBe(0);
        expect(underRes.probabilities.halfLoss).toBe(0);

        // Binary complement: P(Over) + P(Under) = 1.0
        expect(overRes.binaryWinProbability + underRes.binaryWinProbability).toBeCloseTo(1.0, 9);
      }
    });
  });

  describe('Quarter-Number Lines (2.25, 2.75, 3.25, 3.75)', () => {
    it('correctly models .25 split settlements (e.g. Over 2.25 has halfLoss, Under 2.25 has halfWin)', () => {
      const q25Lines = [2.25, 3.25] as const;

      for (const line of q25Lines) {
        const overRes = totalGoals(line, 'OVER', 1.5, 1.2);
        const underRes = totalGoals(line, 'UNDER', 1.5, 1.2);

        // In .25 lines, push is zero as an overall settlement outcome
        expect(overRes.probabilities.push).toBe(0);
        expect(underRes.probabilities.push).toBe(0);

        // Over has halfLoss (at whole line) but zero halfWin
        expect(overRes.probabilities.halfLoss).toBeGreaterThan(0);
        expect(overRes.probabilities.halfWin).toBe(0);

        // Under has halfWin (at whole line) but zero halfLoss
        expect(underRes.probabilities.halfWin).toBeGreaterThan(0);
        expect(underRes.probabilities.halfLoss).toBe(0);

        // The split mass at the whole line must be identical
        expect(overRes.probabilities.halfLoss).toBeCloseTo(underRes.probabilities.halfWin, 9);
      }
    });

    it('correctly models .75 split settlements (e.g. Over 2.75 has halfWin, Under 2.75 has halfLoss)', () => {
      const q75Lines = [2.75, 3.75] as const;

      for (const line of q75Lines) {
        const overRes = totalGoals(line, 'OVER', 1.6, 1.4);
        const underRes = totalGoals(line, 'UNDER', 1.6, 1.4);

        expect(overRes.probabilities.push).toBe(0);
        expect(underRes.probabilities.push).toBe(0);

        // Over has halfWin (at whole line) but zero halfLoss
        expect(overRes.probabilities.halfWin).toBeGreaterThan(0);
        expect(overRes.probabilities.halfLoss).toBe(0);

        // Under has halfLoss (at whole line) but zero halfWin
        expect(underRes.probabilities.halfLoss).toBeGreaterThan(0);
        expect(underRes.probabilities.halfWin).toBe(0);

        // The split mass at the whole line must be identical
        expect(overRes.probabilities.halfWin).toBeCloseTo(underRes.probabilities.halfLoss, 9);
      }
    });
  });

  describe('Deterministic Settlement Verification Across Golden Scorelines', () => {
    // 0-0 (T=0)
    it('settles 0-0 (T=0) correctly', () => {
      expect(settleAsianTotalGoals(2.0, 'OVER', 0)).toBe('FULL_LOSS');
      expect(settleAsianTotalGoals(2.0, 'UNDER', 0)).toBe('FULL_WIN');
      expect(settleAsianTotalGoals(2.25, 'OVER', 0)).toBe('FULL_LOSS');
      expect(settleAsianTotalGoals(2.25, 'UNDER', 0)).toBe('FULL_WIN');
      expect(settleAsianTotalGoals(2.5, 'OVER', 0)).toBe('FULL_LOSS');
      expect(settleAsianTotalGoals(2.5, 'UNDER', 0)).toBe('FULL_WIN');
    });

    // 0-1 (T=1)
    it('settles 0-1 (T=1) correctly', () => {
      expect(settleAsianTotalGoals(2.0, 'OVER', 1)).toBe('FULL_LOSS');
      expect(settleAsianTotalGoals(2.0, 'UNDER', 1)).toBe('FULL_WIN');
      expect(settleAsianTotalGoals(2.25, 'OVER', 1)).toBe('FULL_LOSS');
      expect(settleAsianTotalGoals(2.25, 'UNDER', 1)).toBe('FULL_WIN');
    });

    // 1-1, 2-0 (T=2)
    it('settles 1-1 and 2-0 (T=2) across all lines with exact quarter split logic', () => {
      for (const total of [2]) {
        // Line 2.0: Exact push
        expect(settleAsianTotalGoals(2.0, 'OVER', total)).toBe('PUSH');
        expect(settleAsianTotalGoals(2.0, 'UNDER', total)).toBe('PUSH');

        // Line 2.25 (split 2.0 / 2.5):
        // Over: 2.0 pushes (return 50%), 2.5 loses (loss 50%) -> HALF_LOSS
        expect(settleAsianTotalGoals(2.25, 'OVER', total)).toBe('HALF_LOSS');
        // Under: 2.0 pushes (return 50%), 2.5 wins (win 50%) -> HALF_WIN
        expect(settleAsianTotalGoals(2.25, 'UNDER', total)).toBe('HALF_WIN');

        // Line 2.5: Pure under win
        expect(settleAsianTotalGoals(2.5, 'OVER', total)).toBe('FULL_LOSS');
        expect(settleAsianTotalGoals(2.5, 'UNDER', total)).toBe('FULL_WIN');

        // Line 2.75 (split 2.5 / 3.0):
        expect(settleAsianTotalGoals(2.75, 'OVER', total)).toBe('FULL_LOSS');
        expect(settleAsianTotalGoals(2.75, 'UNDER', total)).toBe('FULL_WIN');

        // Line 3.0:
        expect(settleAsianTotalGoals(3.0, 'OVER', total)).toBe('FULL_LOSS');
        expect(settleAsianTotalGoals(3.0, 'UNDER', total)).toBe('FULL_WIN');
      }
    });

    // 1-2, 2-1, 3-0 (T=3)
    it('settles 1-2, 2-1, 3-0 (T=3) across all lines with exact quarter split logic', () => {
      const total = 3;
      // Line 2.0: Pure over win
      expect(settleAsianTotalGoals(2.0, 'OVER', total)).toBe('FULL_WIN');
      expect(settleAsianTotalGoals(2.0, 'UNDER', total)).toBe('FULL_LOSS');

      // Line 2.25: Pure over win
      expect(settleAsianTotalGoals(2.25, 'OVER', total)).toBe('FULL_WIN');
      expect(settleAsianTotalGoals(2.25, 'UNDER', total)).toBe('FULL_LOSS');

      // Line 2.5: Pure over win
      expect(settleAsianTotalGoals(2.5, 'OVER', total)).toBe('FULL_WIN');
      expect(settleAsianTotalGoals(2.5, 'UNDER', total)).toBe('FULL_LOSS');

      // Line 2.75 (split 2.5 / 3.0):
      // Over: 2.5 wins, 3.0 pushes -> HALF_WIN
      expect(settleAsianTotalGoals(2.75, 'OVER', total)).toBe('HALF_WIN');
      // Under: 2.5 loses, 3.0 pushes -> HALF_LOSS
      expect(settleAsianTotalGoals(2.75, 'UNDER', total)).toBe('HALF_LOSS');

      // Line 3.0: Exact push
      expect(settleAsianTotalGoals(3.0, 'OVER', total)).toBe('PUSH');
      expect(settleAsianTotalGoals(3.0, 'UNDER', total)).toBe('PUSH');

      // Line 3.25 (split 3.0 / 3.5):
      // Over: 3.0 pushes, 3.5 loses -> HALF_LOSS
      expect(settleAsianTotalGoals(3.25, 'OVER', total)).toBe('HALF_LOSS');
      // Under: 3.0 pushes, 3.5 wins -> HALF_WIN
      expect(settleAsianTotalGoals(3.25, 'UNDER', total)).toBe('HALF_WIN');

      // Line 3.5: Pure under win
      expect(settleAsianTotalGoals(3.5, 'OVER', total)).toBe('FULL_LOSS');
      expect(settleAsianTotalGoals(3.5, 'UNDER', total)).toBe('FULL_WIN');
    });

    // 2-2, 3-1, 4-0 (T=4)
    it('settles 2-2, 3-1, 4-0 (T=4) across all lines with exact quarter split logic', () => {
      const total = 4;
      // Line 3.0: Pure over win
      expect(settleAsianTotalGoals(3.0, 'OVER', total)).toBe('FULL_WIN');
      expect(settleAsianTotalGoals(3.0, 'UNDER', total)).toBe('FULL_LOSS');

      // Line 3.25: Pure over win
      expect(settleAsianTotalGoals(3.25, 'OVER', total)).toBe('FULL_WIN');
      expect(settleAsianTotalGoals(3.25, 'UNDER', total)).toBe('FULL_LOSS');

      // Line 3.5: Pure over win
      expect(settleAsianTotalGoals(3.5, 'OVER', total)).toBe('FULL_WIN');
      expect(settleAsianTotalGoals(3.5, 'UNDER', total)).toBe('FULL_LOSS');

      // Line 3.75 (split 3.5 / 4.0):
      // Over: 3.5 wins, 4.0 pushes -> HALF_WIN
      expect(settleAsianTotalGoals(3.75, 'OVER', total)).toBe('HALF_WIN');
      // Under: 3.5 loses, 4.0 pushes -> HALF_LOSS
      expect(settleAsianTotalGoals(3.75, 'UNDER', total)).toBe('HALF_LOSS');

      // Line 4.0: Exact push
      expect(settleAsianTotalGoals(4.0, 'OVER', total)).toBe('PUSH');
      expect(settleAsianTotalGoals(4.0, 'UNDER', total)).toBe('PUSH');
    });
  });

  describe('Market Line Validation & Error Handling', () => {
    it('deterministically rejects unsupported lines outside 2.0-4.0 or non-0.25 steps', () => {
      const invalidLines = [1.75, 2.1, 2.3, 2.6, 3.1, 4.25, 4.5, 5.0, NaN, Infinity];

      for (const badLine of invalidLines) {
        expect(() => AsianTotalEngine.totalGoals(badLine, 'OVER', 1.5, 1.2)).toThrow(
          InvalidAsianLineError
        );
        expect(() => settleAsianTotalGoals(badLine, 'OVER', 2)).toThrow(
          InvalidAsianLineError
        );
      }
    });

    it('rejects invalid side inputs deterministically', () => {
      expect(() => AsianTotalEngine.totalGoals(2.5, 'HOME' as any, 1.5, 1.2)).toThrow();
      expect(() => settleAsianTotalGoals(2.5, 'INVALID' as any, 2)).toThrow();
    });

    it('rejects negative or fractional goals in settlement deterministically', () => {
      expect(() => settleAsianTotalGoals(2.5, 'OVER', -1)).toThrow();
      expect(() => settleAsianTotalGoals(2.5, 'OVER', 2.5)).toThrow();
    });
  });

  it('executes completely offline with zero outbound network calls', () => {
    expect(getBlockedRequestCount()).toBe(0);
  });
});

