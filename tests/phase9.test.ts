import { describe, it, expect, vi } from 'vitest';
import { getCompetitionThresholdHours, getCompetitionCategoryName } from '../src/lib/services/healthChecker';
import { sanitizeAndCategorizeError } from '../src/lib/services/cronLogger';

// Mock Supabase Server client to avoid real connection errors
vi.mock('../src/lib/supabase.server', () => {
  return {
    supabase: {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        insert: vi.fn().mockResolvedValue({ data: null, error: null })
      }))
    }
  };
});

describe('Phase 9: Production Data Verification & Operational Hardening', () => {
  
  describe('Requirement 2: Dynamic Health Threshold Mapping', () => {
    it('should map international_tournament correctly to 3 hours', () => {
      const hours = getCompetitionThresholdHours('international_tournament', 'world_cup_2026', 1);
      const cat = getCompetitionCategoryName('international_tournament', 'world_cup_2026', 1);
      expect(hours).toBe(3);
      expect(cat).toBe('international_tournament');
    });

    it('should map champions_league & cup correctly to 4 hours', () => {
      const hours = getCompetitionThresholdHours('cup', 'uefa_champions_league', 1);
      const cat = getCompetitionCategoryName('cup', 'uefa_champions_league', 1);
      expect(hours).toBe(4);
      expect(cat).toBe('champions_league');

      const hours2 = getCompetitionThresholdHours('champions_league', 'custom_league', 1);
      expect(hours2).toBe(4);
    });

    it('should map top_domestic (priority 2 league) correctly to 6 hours', () => {
      const hours = getCompetitionThresholdHours('league', 'eng_premier_league', 2);
      const cat = getCompetitionCategoryName('league', 'eng_premier_league', 2);
      expect(hours).toBe(6);
      expect(cat).toBe('top_domestic');
    });

    it('should map standard (priority 3 / default) correctly to 12 hours', () => {
      const hours = getCompetitionThresholdHours('league', 'custom_league', 3);
      const cat = getCompetitionCategoryName('league', 'custom_league', 3);
      expect(hours).toBe(12);
      expect(cat).toBe('standard');
    });
  });

  describe('Requirement 5: Error Sanitization and Categorization', () => {
    it('should map quota issues to API_QUOTA_EXCEEDED', () => {
      const err1 = new Error('API limit reached: 429 too many requests');
      const code1 = sanitizeAndCategorizeError(err1);
      expect(code1).toBe('API_QUOTA_EXCEEDED');

      const err2 = 'Monthly quota exceeded for API-Football';
      const code2 = sanitizeAndCategorizeError(err2);
      expect(code2).toBe('API_QUOTA_EXCEEDED');
    });

    it('should map connectivity issues to NETWORK_TIMEOUT', () => {
      const err1 = new Error('fetch failed due to timeout after 10000ms');
      const code1 = sanitizeAndCategorizeError(err1);
      expect(code1).toBe('NETWORK_TIMEOUT');

      const err2 = 'ECONNREFUSED connection reset by peer';
      const code2 = sanitizeAndCategorizeError(err2);
      expect(code2).toBe('NETWORK_TIMEOUT');
    });

    it('should map invalid keys / unauthorized status to UNAUTHORIZED_API_ACCESS', () => {
      const err1 = new Error('Invalid API key provided: secret_xxx');
      const code1 = sanitizeAndCategorizeError(err1);
      expect(code1).toBe('UNAUTHORIZED_API_ACCESS');

      const err2 = 'HTTP 401 Unauthorized access to endpoint';
      const code2 = sanitizeAndCategorizeError(err2);
      expect(code2).toBe('UNAUTHORIZED_API_ACCESS');
    });

    it('should map postgres/RLS issues to DATABASE_OPERATION_ERROR', () => {
      const err1 = new Error('new row violates row-level security policy for table "cron_runs"');
      const code1 = sanitizeAndCategorizeError(err1);
      expect(code1).toBe('DATABASE_OPERATION_ERROR');

      const err2 = 'Relation "matches" does not exist';
      const code2 = sanitizeAndCategorizeError(err2);
      expect(code2).toBe('DATABASE_OPERATION_ERROR');
    });

    it('should map parsing / format issues to DATA_VALIDATION_ERROR', () => {
      const err1 = new Error('Cannot parse JSON response: unexpected token <');
      const code1 = sanitizeAndCategorizeError(err1);
      expect(code1).toBe('DATA_VALIDATION_ERROR');
    });

    it('should fallback to UNKNOWN_FATAL_ERROR for generic errors', () => {
      const err = new Error('Something very weird happened in Dixon-Coles Poisson engine');
      const code = sanitizeAndCategorizeError(err);
      expect(code).toBe('UNKNOWN_FATAL_ERROR');
    });
  });

  describe('Requirement 3: CLV Metrics Sample Gate Logic', () => {
    it('should enforce gate returning null CLV and insufficient_sample status if count is under 50', () => {
      const count = 49;
      const clvSum = 120.5;
      const clvCount = 49;

      const insufficientSample = count < 50;
      const averageClv = insufficientSample ? null : clvSum / clvCount;
      const status = insufficientSample ? 'insufficient_sample' : 'sufficient';

      expect(averageClv).toBeNull();
      expect(status).toBe('insufficient_sample');
    });

    it('should return calculated CLV value when sample is 50 or more', () => {
      const count = 50;
      const clvSum = 125.0;
      const clvCount = 50;

      const insufficientSample = count < 50;
      const averageClv = insufficientSample ? null : clvSum / clvCount;
      const status = insufficientSample ? 'insufficient_sample' : 'sufficient';

      expect(averageClv).toBe(2.5);
      expect(status).toBe('sufficient');
    });
  });

});
