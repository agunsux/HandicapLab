import { describe, it, expect } from 'vitest';
import { SelectionSettlementEngine } from '../../src/lib/research/real-yield/selectionSettlement';

describe('Real Market Yield — Deterministic Settlement Engine', () => {
  const eps = 1e-4;

  describe('1X2 Settlement Tests', () => {
    it('0-0 Score', () => {
      expect(SelectionSettlementEngine.settle1X2(0, 0, 'HOME', 2.0).outcome).toBe('LOSS');
      expect(SelectionSettlementEngine.settle1X2(0, 0, 'DRAW', 3.4).outcome).toBe('WIN');
      expect(SelectionSettlementEngine.settle1X2(0, 0, 'DRAW', 3.4).pnl).toBeCloseTo(2.4, 4);
      expect(SelectionSettlementEngine.settle1X2(0, 0, 'AWAY', 3.8).outcome).toBe('LOSS');
    });

    it('1-0 Score', () => {
      expect(SelectionSettlementEngine.settle1X2(1, 0, 'HOME', 1.8).outcome).toBe('WIN');
      expect(SelectionSettlementEngine.settle1X2(1, 0, 'HOME', 1.8).pnl).toBeCloseTo(0.8, 4);
      expect(SelectionSettlementEngine.settle1X2(1, 0, 'DRAW', 3.5).outcome).toBe('LOSS');
      expect(SelectionSettlementEngine.settle1X2(1, 0, 'AWAY', 4.5).outcome).toBe('LOSS');
    });

    it('2-1 Score', () => {
      expect(SelectionSettlementEngine.settle1X2(2, 1, 'HOME', 2.1).outcome).toBe('WIN');
      expect(SelectionSettlementEngine.settle1X2(2, 1, 'HOME', 2.1).pnl).toBeCloseTo(1.1, 4);
      expect(SelectionSettlementEngine.settle1X2(2, 1, 'DRAW', 3.2).outcome).toBe('LOSS');
      expect(SelectionSettlementEngine.settle1X2(2, 1, 'AWAY', 3.6).outcome).toBe('LOSS');
    });

    it('3-3 Score', () => {
      expect(SelectionSettlementEngine.settle1X2(3, 3, 'HOME', 2.0).outcome).toBe('LOSS');
      expect(SelectionSettlementEngine.settle1X2(3, 3, 'DRAW', 3.6).outcome).toBe('WIN');
      expect(SelectionSettlementEngine.settle1X2(3, 3, 'DRAW', 3.6).pnl).toBeCloseTo(2.6, 4);
      expect(SelectionSettlementEngine.settle1X2(3, 3, 'AWAY', 3.5).outcome).toBe('LOSS');
    });
  });

  describe('OU 2.5 Settlement Tests', () => {
    it('0-0 Score (Total = 0 <= 2)', () => {
      expect(SelectionSettlementEngine.settleOU25(0, 0, 'OVER', 1.9).outcome).toBe('LOSS');
      expect(SelectionSettlementEngine.settleOU25(0, 0, 'UNDER', 1.95).outcome).toBe('WIN');
      expect(SelectionSettlementEngine.settleOU25(0, 0, 'UNDER', 1.95).pnl).toBeCloseTo(0.95, 4);
    });

    it('1-0 Score (Total = 1 <= 2)', () => {
      expect(SelectionSettlementEngine.settleOU25(1, 0, 'OVER', 2.0).outcome).toBe('LOSS');
      expect(SelectionSettlementEngine.settleOU25(1, 0, 'UNDER', 1.85).outcome).toBe('WIN');
      expect(SelectionSettlementEngine.settleOU25(1, 0, 'UNDER', 1.85).pnl).toBeCloseTo(0.85, 4);
    });

    it('2-1 Score (Total = 3 >= 3)', () => {
      expect(SelectionSettlementEngine.settleOU25(2, 1, 'OVER', 1.9).outcome).toBe('WIN');
      expect(SelectionSettlementEngine.settleOU25(2, 1, 'OVER', 1.9).pnl).toBeCloseTo(0.9, 4);
      expect(SelectionSettlementEngine.settleOU25(2, 1, 'UNDER', 1.95).outcome).toBe('LOSS');
    });

    it('3-3 Score (Total = 6 >= 3)', () => {
      expect(SelectionSettlementEngine.settleOU25(3, 3, 'OVER', 1.75).outcome).toBe('WIN');
      expect(SelectionSettlementEngine.settleOU25(3, 3, 'OVER', 1.75).pnl).toBeCloseTo(0.75, 4);
      expect(SelectionSettlementEngine.settleOU25(3, 3, 'UNDER', 2.1).outcome).toBe('LOSS');
    });
  });

  describe('AH Settlement Tests', () => {
    it('Line 0.00 (Pick / DNB) on 0-0, 1-0, 2-1, 3-3', () => {
      // 0-0 => PUSH
      expect(SelectionSettlementEngine.settleAH(0, 0, 0, 'HOME', 1.9).outcome).toBe('PUSH');
      expect(SelectionSettlementEngine.settleAH(0, 0, 0, 'HOME', 1.9).pnl).toBe(0);

      // 1-0 => WIN
      expect(SelectionSettlementEngine.settleAH(1, 0, 0, 'HOME', 1.95).outcome).toBe('WIN');
      expect(SelectionSettlementEngine.settleAH(1, 0, 0, 'HOME', 1.95).pnl).toBeCloseTo(0.95, 4);

      // 2-1 => WIN
      expect(SelectionSettlementEngine.settleAH(2, 1, 0, 'HOME', 1.9).outcome).toBe('WIN');

      // 3-3 => PUSH
      expect(SelectionSettlementEngine.settleAH(3, 3, 0, 'HOME', 1.9).outcome).toBe('PUSH');
      expect(SelectionSettlementEngine.settleAH(3, 3, 0, 'HOME', 1.9).pnl).toBe(0);
    });

    it('Line -0.25 (Quarter-ball Favorite) on 0-0, 1-0, 2-1, 3-3', () => {
      // 0-0: diff = -0.25 => HALF_LOSS (-0.5)
      const res00 = SelectionSettlementEngine.settleAH(0, 0, -0.25, 'HOME', 2.0);
      expect(res00.outcome).toBe('HALF_LOSS');
      expect(res00.pnl).toBeCloseTo(-0.5, 4);

      // 1-0: diff = +0.75 => WIN (+1.0)
      const res10 = SelectionSettlementEngine.settleAH(1, 0, -0.25, 'HOME', 2.0);
      expect(res10.outcome).toBe('WIN');
      expect(res10.pnl).toBeCloseTo(1.0, 4);

      // 2-1: diff = +0.75 => WIN (+1.0)
      const res21 = SelectionSettlementEngine.settleAH(2, 1, -0.25, 'HOME', 2.0);
      expect(res21.outcome).toBe('WIN');
      expect(res21.pnl).toBeCloseTo(1.0, 4);

      // 3-3: diff = -0.25 => HALF_LOSS (-0.5)
      const res33 = SelectionSettlementEngine.settleAH(3, 3, -0.25, 'HOME', 2.0);
      expect(res33.outcome).toBe('HALF_LOSS');
      expect(res33.pnl).toBeCloseTo(-0.5, 4);
    });

    it('Line +0.25 (Quarter-ball Underdog) on 0-0, 1-0, 2-1, 3-3', () => {
      // 0-0: diff = +0.25 => HALF_WIN ((odds - 1) / 2)
      const res00 = SelectionSettlementEngine.settleAH(0, 0, 0.25, 'HOME', 1.9);
      expect(res00.outcome).toBe('HALF_WIN');
      expect(res00.pnl).toBeCloseTo(0.45, 4);

      // 1-0: diff = +1.25 => WIN (odds - 1)
      const res10 = SelectionSettlementEngine.settleAH(1, 0, 0.25, 'HOME', 1.9);
      expect(res10.outcome).toBe('WIN');
      expect(res10.pnl).toBeCloseTo(0.9, 4);

      // 0-1 (Loss by 1): diff = -0.75 => LOSS (-1.0)
      const res01 = SelectionSettlementEngine.settleAH(0, 1, 0.25, 'HOME', 1.9);
      expect(res01.outcome).toBe('LOSS');
      expect(res01.pnl).toBeCloseTo(-1.0, 4);
    });
  });
});

