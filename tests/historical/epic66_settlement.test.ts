import { describe, it, expect } from 'vitest';
import {
  settleAsianHandicap,
  settleAsianTotal,
  settleBtts,
  profitOfOutcome
} from '../../src/historical/settlement/settlement';
import { normalizeAhLine, normalizeOuLine, normalizeBttsSelection } from '../../scripts/epic66_market_normalizer';

describe('EPIC-66 Market Normalizer', () => {
  it('normalizes string and numeric AH lines correctly', () => {
    expect(normalizeAhLine('-0.25')).toBe(-0.25);
    expect(normalizeAhLine('+0.25')).toBe(0.25);
    expect(normalizeAhLine('0.0, -0.5')).toBe(-0.25);
    expect(normalizeAhLine('-0.5 / -1.0')).toBe(-0.75);
    expect(normalizeAhLine(0.5)).toBe(0.5);
  });

  it('normalizes OU lines correctly', () => {
    expect(normalizeOuLine('2.5')).toBe(2.5);
    expect(normalizeOuLine('Over 2.25')).toBe(2.25);
    expect(normalizeOuLine('2.0, 2.5')).toBe(2.25);
  });

  it('normalizes BTTS selection correctly', () => {
    expect(normalizeBttsSelection('Yes')).toBe('yes');
    expect(normalizeBttsSelection('no')).toBe('no');
    expect(normalizeBttsSelection('BTTS_YES')).toBe('yes');
  });
});

describe('EPIC-66 Deterministic Settlement Engine', () => {
  it('correctly handles AH -0.25 quarter split stake', () => {
    // 2-1 Home Win -> Full Win
    expect(settleAsianHandicap('home', -0.25, 2, 1)).toBe('WIN');
    // 1-1 Draw -> Half Loss
    expect(settleAsianHandicap('home', -0.25, 1, 1)).toBe('HALF_LOSS');
    expect(profitOfOutcome('HALF_LOSS', 2.0)).toBe(-0.5);
    // 0-1 Away Win -> Full Loss
    expect(settleAsianHandicap('home', -0.25, 0, 1)).toBe('LOSS');
  });

  it('correctly handles AH +0.25 quarter split stake', () => {
    // 1-1 Draw -> Half Win
    expect(settleAsianHandicap('home', 0.25, 1, 1)).toBe('HALF_WIN');
    expect(profitOfOutcome('HALF_WIN', 2.0)).toBe(0.5);
  });

  it('correctly handles OU 2.25 quarter totals', () => {
    // 2 goals on Over 2.25 -> Half Loss
    expect(settleAsianTotal('over', 2.25, 2)).toBe('HALF_LOSS');
    expect(profitOfOutcome('HALF_LOSS', 1.95)).toBe(-0.5);
    // 2 goals on Under 2.25 -> Half Win
    expect(settleAsianTotal('under', 2.25, 2)).toBe('HALF_WIN');
    expect(profitOfOutcome('HALF_WIN', 1.95)).toBeCloseTo((1.95 - 1) / 2);
  });

  it('correctly handles BTTS deterministic outcomes', () => {
    expect(settleBtts('yes', 1, 1)).toBe('WIN');
    expect(settleBtts('yes', 2, 0)).toBe('LOSS');
    expect(settleBtts('no', 2, 0)).toBe('WIN');
  });
});
