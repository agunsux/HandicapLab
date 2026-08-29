import { describe, it, expect } from 'vitest';
import {
  settleAsianHandicap,
  isQuarterLine,
  getQuarterComponents,
} from '../src/lib/research/ah-solo/ahSettlementEngine';

describe('EPIC 56: Asian Handicap Settlement Engine', () => {
  it('identifies quarter lines correctly', () => {
    expect(isQuarterLine(-0.75)).toBe(true);
    expect(isQuarterLine(-0.25)).toBe(true);
    expect(isQuarterLine(0.25)).toBe(true);
    expect(isQuarterLine(0.75)).toBe(true);
    expect(isQuarterLine(-1.0)).toBe(false);
    expect(isQuarterLine(-0.5)).toBe(false);
    expect(isQuarterLine(0.0)).toBe(false);
    expect(isQuarterLine(0.5)).toBe(false);
  });

  it('decomposes quarter lines into two sub-lines', () => {
    expect(getQuarterComponents(-0.75)).toEqual([-1.0, -0.5]);
    expect(getQuarterComponents(-0.25)).toEqual([-0.5, 0.0]);
    expect(getQuarterComponents(0.25)).toEqual([0.0, 0.5]);
    expect(getQuarterComponents(0.75)).toEqual([0.5, 1.0]);
  });

  it('settles whole line pushes and wins correctly', () => {
    // 2-1 with Home -1.0 -> Diff = 1 -> Diff + Line = 0 -> PUSH
    const pushRes = settleAsianHandicap('home', -1.0, 2, 1, 1.95, 1.0);
    expect(pushRes.outcome).toBe('PUSH');
    expect(pushRes.profit).toBe(0);
    expect(pushRes.payoffMultiplier).toBe(0);

    // 3-1 with Home -1.0 -> Diff = 2 -> Diff + Line = 1 -> FULL_WIN
    const winRes = settleAsianHandicap('home', -1.0, 3, 1, 1.95, 1.0);
    expect(winRes.outcome).toBe('FULL_WIN');
    expect(winRes.profit).toBe(0.95);
    expect(winRes.payoffMultiplier).toBe(0.95);
  });

  it('settles quarter lines (half-win and half-loss) correctly', () => {
    // 2-1 with Home -0.75:
    // Sub-line -1.0 -> PUSH (0 profit)
    // Sub-line -0.5 -> WIN ((1.95 - 1) = 0.95 profit on 0.5 stake = 0.475)
    // Combined -> HALF_WIN
    const hwRes = settleAsianHandicap('home', -0.75, 2, 1, 1.95, 1.0);
    expect(hwRes.outcome).toBe('HALF_WIN');
    expect(hwRes.profit).toBe(0.475);
    expect(hwRes.payoffMultiplier).toBe(0.475);

    // 1-1 with Home -0.25:
    // Sub-line -0.5 -> LOSS (-0.5 stake lost)
    // Sub-line 0.0 -> PUSH (0 profit)
    // Combined -> HALF_LOSS
    const hlRes = settleAsianHandicap('home', -0.25, 1, 1, 1.95, 1.0);
    expect(hlRes.outcome).toBe('HALF_LOSS');
    expect(hlRes.profit).toBe(-0.5);
    expect(hlRes.payoffMultiplier).toBe(-0.5);
  });

  it('handles VOID matches strictly without P&L distortion', () => {
    const voidRes = settleAsianHandicap('home', -0.5, 0, 0, 1.95, 1.0, true);
    expect(voidRes.outcome).toBe('VOID');
    expect(voidRes.profit).toBe(0);
    expect(voidRes.payoffMultiplier).toBe(0);
    expect(voidRes.isVoid).toBe(true);
  });
});
