import { describe, it, expect } from 'vitest';
import { CohortSelector } from '../src/lib/validation/cohort-selector';

describe('Sprint 10: Cohort Segregation and Tracking', () => {
  describe('Cohort Resolution', () => {
    it('should map Premier League and La Liga to elite_europe', () => {
      expect(CohortSelector.resolve('Premier League')).toBe('elite_europe');
      expect(CohortSelector.resolve('La Liga')).toBe('elite_europe');
    });

    it('should map qualification leagues to europe_qualification', () => {
      expect(CohortSelector.resolve('UEFA Champions League Qualification')).toBe('europe_qualification');
      expect(CohortSelector.resolve('UEFA Europa League Qualification')).toBe('europe_qualification');
    });

    it('should map Latin American leagues to latin_america', () => {
      expect(CohortSelector.resolve('Brazil Serie A')).toBe('latin_america');
      expect(CohortSelector.resolve('Argentina Primera Division')).toBe('latin_america');
    });

    it('should map Asian leagues to asia', () => {
      expect(CohortSelector.resolve('Japan J1 League')).toBe('asia');
      expect(CohortSelector.resolve('K League')).toBe('asia');
    });

    it('should fall back to other for unknown leagues', () => {
      expect(CohortSelector.resolve('MLS')).toBe('other'); // USA is in North America, falls back to other
      // Let's test a completely unknown name:
      expect(CohortSelector.resolve('Unknown League')).toBe('other');
    });
  });
});
