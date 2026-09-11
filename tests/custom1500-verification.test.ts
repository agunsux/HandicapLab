import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getProviderQuotaPolicy,
  evaluateQuotaPressure,
  isPriorityAllowed,
  CUSTOM1500_DAILY_HARD_LIMIT,
  CUSTOM1500_DAILY_SOFT_LIMIT,
  CUSTOM1500_SAFETY_RESERVE,
} from '@/lib/providers/quotaPolicy';
import { getFootballProvider } from '@/lib/api/providers/providerFactory';
import { ApiFootballClient } from '@/lib/api/apiFootball';
import { supabase } from '@/lib/supabase.server';
import { reserveQuota, confirmQuota, rollbackQuota } from '@/lib/providers/quotaManagerV4';

vi.mock('@/lib/supabase.server', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

describe('CHECKPOINT A — Custom1500 Provider & Quota Verification', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('1. Custom1500 Policy Constants & Defaults', () => {
    it('has theoretical daily limit of 1,500,000 with 10% safety reserve', () => {
      expect(CUSTOM1500_DAILY_HARD_LIMIT).toBe(1500000);
      expect(CUSTOM1500_DAILY_SOFT_LIMIT).toBe(1350000);
      expect(CUSTOM1500_SAFETY_RESERVE).toBe(150000);
      expect(CUSTOM1500_DAILY_HARD_LIMIT - CUSTOM1500_DAILY_SOFT_LIMIT).toBe(CUSTOM1500_SAFETY_RESERVE);
    });

    it('returns Custom1500 defaults when no env overrides are present', () => {
      vi.stubEnv('API_FOOTBALL_DAILY_HARD_LIMIT', '');
      vi.stubEnv('API_FOOTBALL_DAILY_SOFT_LIMIT', '');
      vi.stubEnv('QUOTA_APIFOOTBALL_DAILY', '');

      const policy = getProviderQuotaPolicy('apifootball');
      expect(policy.period).toBe('DAILY');
      expect(policy.hardLimit).toBe(1500000);
      expect(policy.softLimit).toBe(1350000);
      expect(policy.economyAtPctOfSoft).toBe(80);
    });

    it('supports configurable environment overrides for operational budget and hard limit', () => {
      vi.stubEnv('API_FOOTBALL_DAILY_HARD_LIMIT', '1200000');
      vi.stubEnv('API_FOOTBALL_DAILY_SOFT_LIMIT', '1000000');

      const policy = getProviderQuotaPolicy('apifootball');
      expect(policy.hardLimit).toBe(1200000);
      expect(policy.softLimit).toBe(1000000);
    });
  });

  describe('2. Pressure Thresholds & Priority Gating', () => {
    it('transitions through NORMAL -> ECONOMY -> CRITICAL -> QUOTA_EXHAUSTED at 1.5M scale', () => {
      const policy = getProviderQuotaPolicy('apifootball');

      // 0 to < 80% of soft (80% of 1,350,000 = 1,080,000)
      expect(evaluateQuotaPressure(policy, 0).mode).toBe('NORMAL');
      expect(evaluateQuotaPressure(policy, 1079999).mode).toBe('NORMAL');

      // >= 1,080,000: ECONOMY
      const economy = evaluateQuotaPressure(policy, 1080000);
      expect(economy.mode).toBe('ECONOMY');
      expect(isPriorityAllowed(economy.mode, 30)).toBe(false); // Reject P3 metadata
      expect(isPriorityAllowed(economy.mode, 50)).toBe(true);  // Allow P2 historical
      expect(isPriorityAllowed(economy.mode, 90)).toBe(true);  // Allow P0 predictions

      // >= 1,350,000: CRITICAL (only P0 allowed)
      const critical = evaluateQuotaPressure(policy, 1350000);
      expect(critical.mode).toBe('CRITICAL');
      expect(isPriorityAllowed(critical.mode, 70)).toBe(false); // Reject P1 snapshots
      expect(isPriorityAllowed(critical.mode, 90)).toBe(true);  // Allow P0 predictions
      expect(isPriorityAllowed(critical.mode, 100)).toBe(true); // Allow P0 settlement

      // >= 1,500,000: QUOTA_EXHAUSTED (hard stop)
      const exhausted = evaluateQuotaPressure(policy, 1500000);
      expect(exhausted.mode).toBe('QUOTA_EXHAUSTED');
      expect(exhausted.exhausted).toBe(true);
      expect(isPriorityAllowed(exhausted.mode, 100)).toBe(false); // All rejected
    });
  });

  describe('3. Active Provider & No-Mock Policy Verification', () => {
    it('recognizes API-Football as active provider and blocks unauthorized providers', () => {
      process.env.DATA_PROVIDER = 'api-football';
      const provider = getFootballProvider();
      expect(provider).toBeDefined();

      process.env.DATA_PROVIDER = 'fake-provider';
      expect(() => getFootballProvider()).toThrow(/PROVIDER_POLICY_VIOLATION/);
    });

    it('fails closed when API key is missing or mock — no fabricated responses permitted', async () => {
      process.env.APIFOOTBALL_KEY = '';
      process.env.API_FOOTBALL_KEY = '';
      const client = new ApiFootballClient();
      await expect(client.getFixtures(99999, 1900)).rejects.toThrow(/DATA_UNAVAILABLE/);
    });
  });

  describe('4. QuotaManagerV4 Atomic Accounting with Custom1500', () => {
    it('reserves and confirms quota accurately at Custom1500 capacity', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: {
          ok: true,
          reservation_id: 'res-custom-1',
          safe_limit: 1500000,
          consumed: 50,
          reserved: 1,
          safe_remaining: 1499949,
        },
        error: null,
      } as any);

      const receipt = await reserveQuota('apifootball', 'fixtures', 90);
      expect(receipt.ok).toBe(true);
      expect(receipt.hardLimit).toBe(1500000);
      expect(receipt.softLimit).toBe(1350000);
      expect(receipt.quotaRemaining).toBe(1499949);

      // Confirm quota
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: { ok: true },
        error: null,
      } as any);

      const confirm = await confirmQuota('res-custom-1', 1, 1499948);
      expect(confirm.ok).toBe(true);
    });
  });
});
