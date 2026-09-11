import { describe, it, expect } from 'vitest';
import { buildEdgeDataset, PINNACLE_CLOSING_COHORT, PINNACLE_OPENING_COHORT } from '../../src/lib/research/ah-edge/edgeData';
import { isValidHandicapLine } from '../../src/lib/research/ah-yield/ahSettlement';

const dataset = buildEdgeDataset(PINNACLE_CLOSING_COHORT);
const openingDataset = buildEdgeDataset(PINNACLE_OPENING_COHORT);

describe('Edge dataset — frozen real data integration', () => {
  it('includes every match with a genuine Pinnacle closing AH quote plus ML/OU context', () => {
    expect(dataset.coverage.eligibleMatches).toBe(3040);
    expect(dataset.coverage.withMlClosing).toBe(3040);
    expect(dataset.coverage.withOuClosing).toBe(3040);
    expect(dataset.coverage.withAhOpening).toBe(3037);
    expect(dataset.coverage.seasons).toEqual([
      '2019-2020',
      '2020-2021',
      '2021-2022',
      '2022-2023',
      '2023-2024',
      '2024-2025',
      '2025-2026',
    ]);
    expect(dataset.coverage.leagues.sort()).toEqual(['ENG-PL', 'ESP-LALIGA']);
  });

  it('the opening cohort excludes legacy mislabeled BetBrain rows (provenance filter)', () => {
    // 3,039 genuine Pinnacle opening quotes exist; 2 have missing prices.
    expect(openingDataset.coverage.eligibleMatches).toBe(3037);
    expect(openingDataset.coverage.leagues.sort()).toEqual(['ENG-PL', 'ESP-LALIGA']);
    // No closing snapshot may leak into opening evaluation.
    for (const m of openingDataset.matches) {
      expect(m.ahOpening).toBeNull();
      expect(m.features.eloHome).toBeGreaterThan(1000);
    }
  });

  it('rows are chronologically sorted and carry valid quotes and probabilities', () => {
    let prev = '';
    for (const m of dataset.matches) {
      expect(m.matchDate >= prev).toBe(true);
      prev = m.matchDate;
      expect(isValidHandicapLine(m.ah.line)).toBe(true);
      expect(m.ah.homeOdds).toBeGreaterThan(1);
      expect(m.ah.awayOdds).toBeGreaterThan(1);
      if (m.mlClosing) {
        const sum = m.mlClosing.pHome + m.mlClosing.pDraw + m.mlClosing.pAway;
        expect(sum).toBeCloseTo(1, 9);
      }
    }
  });

  it('features are populated, finite, and in plausible ranges', () => {
    for (const m of dataset.matches) {
      const f = m.features;
      for (const v of Object.values(f)) expect(Number.isFinite(v as number)).toBe(true);
      expect(f.eloHome).toBeGreaterThan(1000);
      expect(f.eloHome).toBeLessThan(2200);
      expect(f.homePpg5).toBeGreaterThanOrEqual(0);
      expect(f.homePpg5).toBeLessThanOrEqual(3);
      expect(f.leagueHomeGoalsPerMatch).toBeGreaterThan(0.5);
      expect(f.homeRestDays).toBeGreaterThanOrEqual(0);
      expect(f.homeRestDays).toBeLessThanOrEqual(30);
    }
  });

  it('records expected first-observation missingness only', () => {
    expect(dataset.missingness.formFallbackHome).toBeGreaterThan(0);
    expect(dataset.missingness.formFallbackHome).toBeLessThan(dataset.matches.length * 0.12);
    expect(dataset.missingness.leagueFallback).toBeLessThan(dataset.matches.length * 0.05);
  });
});
