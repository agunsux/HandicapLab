import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PLANS } from '../src/lib/pricing/plans';
import { getTierEntitlements } from '../src/lib/pricing/entitlement';

describe('Phase 5B-1 Monetization Foundation Tests', () => {
  let isRateLimited: any;
  let getUserDailyReveals: any;
  let hashString: any;

  beforeEach(async () => {
    vi.resetModules();
    
    vi.doMock('../src/lib/supabase.server', () => {
      const chain = {
        delete: vi.fn().mockReturnThis(),
        lt: vi.fn().mockImplementation(() => ({
          then: vi.fn((cb) => {
            cb({ error: null });
            return { catch: vi.fn() };
          })
        })),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockImplementation(() => Promise.resolve({
          count: 5,
          data: [{ signal_id: 'sig-1' }, { signal_id: 'sig-2' }],
          error: null
        })),
        insert: vi.fn().mockResolvedValue({ error: null })
      };

      return {
        supabase: {
          from: vi.fn(() => chain)
        }
      };
    });

    // Dynamically import the modules to capture the local mock
    const rateLimitMod = await import('../src/lib/pricing/rate-limit');
    isRateLimited = rateLimitMod.isRateLimited;

    const accessLogsMod = await import('../src/lib/pricing/access-logs');
    getUserDailyReveals = accessLogsMod.getUserDailyReveals;
    hashString = accessLogsMod.hashString;
  });

  describe('Founder Tier Definition', () => {
    it('should verify founder plan details exist and have expected features', () => {
      const founderPlan = PLANS.founder;
      expect(founderPlan).toBeDefined();
      expect(founderPlan.tier).toBe('founder');
      expect(founderPlan.priceUSD).toBe(199);
      expect(founderPlan.maxSignalsPerDay).toBe(Infinity);
      expect(founderPlan.hasScanner).toBe(true);
      expect(founderPlan.hasFullEdgeData).toBe(true);
      expect(founderPlan.hasApiAccess).toBe(true);
    });

    it('should return correct entitlements for founder tier', () => {
      const entitlements = getTierEntitlements('founder');
      expect(entitlements.tier).toBe('founder');
      expect(entitlements.hasScanner).toBe(true);
      expect(entitlements.hasFullEdgeData).toBe(true);
      expect(entitlements.hasApiAccess).toBe(true);
    });
  });

  describe('Rate Limiting Logic', () => {
    it('should identify when rate limit is exceeded', async () => {
      const result = await isRateLimited('test-user', 5);
      expect(result).toBe(true);
    });
  });

  describe('Daily Reveal Logic', () => {
    it('should return the correct revealed signal IDs for the user today', async () => {
      const reveals = await getUserDailyReveals('user-1');
      expect(reveals).toEqual(['sig-1', 'sig-2']);
    });
  });

  describe('Hash Salting', () => {
    it('should produce deterministic sha256 output using salt env value', () => {
      process.env.ACCESS_LOG_HASH_SECRET = 'test-salt-secret';
      const hash1 = hashString('192.168.1.1');
      const hash2 = hashString('192.168.1.1');
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex output is 64 chars
    });
  });
});
