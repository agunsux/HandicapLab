import { describe, it, expect } from 'vitest';
import {
  normalizeAhLine,
  normalizeOuLine,
  normalizeBttsSelection,
  isValidAhLine,
} from '../../scripts/epic66_market_normalizer';
import {
  classifyCatalogMarket,
  outcomeSide,
  type CatalogMarket,
} from '../../src/historical/oddspapi/marketCatalog';

describe('Phase 1: Odds Normalization & Catalog Classification Tests', () => {
  it('1. Normalizes Asian Handicap lines across all fractional quarter lines', () => {
    expect(normalizeAhLine(-0.25)).toBe(-0.25);
    expect(normalizeAhLine('-0.25')).toBe(-0.25);
    expect(normalizeAhLine('0, -0.5')).toBe(-0.25);
    expect(normalizeAhLine('+0.75')).toBe(0.75);
    expect(normalizeAhLine('-1.50')).toBe(-1.5);
    expect(normalizeAhLine('0')).toBe(0);
    expect(isValidAhLine(-0.25)).toBe(true);
    expect(isValidAhLine(0.75)).toBe(true);
    expect(isValidAhLine(-1.5)).toBe(true);
  });

  it('2. Normalizes Over/Under lines across whole, half, and quarter totals', () => {
    expect(normalizeOuLine(2.5)).toBe(2.5);
    expect(normalizeOuLine('2.5')).toBe(2.5);
    expect(normalizeOuLine('Over 2.25')).toBe(2.25);
    expect(normalizeOuLine('Under 2.75')).toBe(2.75);
    expect(normalizeOuLine('2.0, 2.5')).toBe(2.25);
    expect(normalizeOuLine('3.0')).toBe(3.0);
  });

  it('3. Normalizes BTTS selections deterministically', () => {
    expect(normalizeBttsSelection('yes')).toBe('yes');
    expect(normalizeBttsSelection('Yes')).toBe('yes');
    expect(normalizeBttsSelection('btts_yes')).toBe('yes');
    expect(normalizeBttsSelection('no')).toBe('no');
    expect(normalizeBttsSelection('No')).toBe('no');
    expect(normalizeBttsSelection('btts_no')).toBe('no');
    expect(() => normalizeBttsSelection('draw')).toThrow();
  });

  it('4. Classifies OddsPapi market catalog entries correctly', () => {
    const mlMarket: CatalogMarket = {
      marketId: 101,
      marketName: 'Full Time Result',
      marketType: '1x2',
      handicap: 0,
      outcomes: [
        { outcomeId: 101, outcomeName: '1' },
        { outcomeId: 102, outcomeName: 'X' },
        { outcomeId: 103, outcomeName: '2' },
      ],
    };
    expect(classifyCatalogMarket(mlMarket)).toEqual({ market: 'ML', line: null });

    const ahMarket: CatalogMarket = {
      marketId: 1058,
      marketName: 'Asian Handicap',
      marketType: 'spreads',
      handicap: -0.75,
      outcomes: [
        { outcomeId: 201, outcomeName: '1' },
        { outcomeId: 202, outcomeName: '2' },
      ],
    };
    expect(classifyCatalogMarket(ahMarket)).toEqual({ market: 'AH', line: -0.75 });

    const bttsMarket: CatalogMarket = {
      marketId: 104,
      marketName: 'Both Teams To Score',
      marketType: 'bothteamsscore',
      handicap: 0,
      outcomes: [
        { outcomeId: 301, outcomeName: 'Yes' },
        { outcomeId: 302, outcomeName: 'No' },
      ],
    };
    expect(classifyCatalogMarket(bttsMarket)).toEqual({ market: 'BTTS', line: null });
  });

  it('5. Correctly maps outcome names to canonical sides', () => {
    expect(outcomeSide('ML', '1')).toBe('home');
    expect(outcomeSide('ML', 'X')).toBe('draw');
    expect(outcomeSide('ML', '2')).toBe('away');
    expect(outcomeSide('AH', '1')).toBe('home');
    expect(outcomeSide('AH', '2')).toBe('away');
    expect(outcomeSide('OU', 'Over')).toBe('over');
    expect(outcomeSide('OU', 'Under')).toBe('under');
    expect(outcomeSide('BTTS', 'Yes')).toBe('yes');
    expect(outcomeSide('BTTS', 'No')).toBe('no');
  });
});

