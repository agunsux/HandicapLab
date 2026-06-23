import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hasTierAccess, TIER_DEFINITIONS } from '../src/lib/monetization/tiers';
import { checkEntitlement, setCachedUserTier, redisMock } from '../src/lib/monetization/entitlements';
import { Paywall } from '../src/lib/monetization/paywall';
import {
  StripeBillingAdapter,
  LemonSqueezyBillingAdapter,
  CryptoBillingAdapter,
  RegionalBillingAdapter
} from '../src/lib/monetization/billing-adapters';
import { supabase } from '../src/lib/supabase.server';
import { EdgePick } from '../src/lib/engines/edge-scanner/types';

// Mock Supabase client
vi.mock('../src/lib/supabase.server', () => {
  const mockSingle = vi.fn();
  const mockMaybeSingle = vi.fn();
  const mockEq = vi.fn(() => ({ single: mockSingle, maybeSingle: mockMaybeSingle }));
  const mockSelect = vi.fn(() => ({ eq: mockEq }));
  return {
    supabase: {
      from: vi.fn(() => ({
        select: mockSelect
      })),
      rpc: vi.fn()
    }
  };
});

describe('Monetization Modules', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    redisMock.clear();
  });

  describe('Tiers configuration', () => {
    it('should correctly evaluate tier access rights', () => {
      // FREE users
      expect(hasTierAccess('FREE', 'FREE')).toBe(true);
      expect(hasTierAccess('FREE', 'PRO')).toBe(false);
      expect(hasTierAccess('FREE', 'ELITE')).toBe(false);

      // PRO users
      expect(hasTierAccess('PRO', 'FREE')).toBe(true);
      expect(hasTierAccess('PRO', 'PRO')).toBe(true);
      expect(hasTierAccess('PRO', 'ELITE')).toBe(false);

      // ELITE users
      expect(hasTierAccess('ELITE', 'FREE')).toBe(true);
      expect(hasTierAccess('ELITE', 'PRO')).toBe(true);
      expect(hasTierAccess('ELITE', 'ELITE')).toBe(true);

      // LIFETIME users
      expect(hasTierAccess('LIFETIME', 'FREE')).toBe(true);
      expect(hasTierAccess('LIFETIME', 'PRO')).toBe(true);
      expect(hasTierAccess('LIFETIME', 'ELITE')).toBe(true);
    });
  });

  describe('Entitlements checking with caching', () => {
    const userId = 'user-abc';

    it('should allow FREE picks without querying DB or cache', async () => {
      const allowed = await checkEntitlement(userId, 'FREE');
      expect(allowed).toBe(true);
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('should query DB and cache the user tier when cache is empty', async () => {
      // Mock DB return value
      const mockMaybeSingle = vi.fn().mockResolvedValue({
        data: { tier: 'PRO', status: 'active', expires_at: null },
        error: null
      });
      const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
      const mockSelect = vi.fn(() => ({ eq: mockEq }));
      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

      // First check (triggers DB lookup)
      const allowed = await checkEntitlement(userId, 'PRO');
      expect(allowed).toBe(true);
      expect(supabase.from).toHaveBeenCalledTimes(1);

      // Second check (reads from cache, no DB lookup)
      const allowedCached = await checkEntitlement(userId, 'PRO');
      expect(allowedCached).toBe(true);
      expect(supabase.from).toHaveBeenCalledTimes(1);
    });

    it('should handle expired subscriptions by falling back to FREE', async () => {
      const pastDate = new Date(Date.now() - 10000).toISOString();
      const mockMaybeSingle = vi.fn().mockResolvedValue({
        data: { tier: 'PRO', status: 'active', expires_at: pastDate },
        error: null
      });
      const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
      const mockSelect = vi.fn(() => ({ eq: mockEq }));
      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

      const allowed = await checkEntitlement(userId, 'PRO');
      expect(allowed).toBe(false); // Expired -> FREE -> cannot view PRO
    });

    it('should allow overriding cached tiers', async () => {
      await setCachedUserTier(userId, 'ELITE');
      
      // Should allow ELITE access without DB query
      const allowed = await checkEntitlement(userId, 'ELITE');
      expect(allowed).toBe(true);
      expect(supabase.from).not.toHaveBeenCalled();
    });
  });

  describe('Paywall gating', () => {
    const pick: EdgePick = {
      matchId: 'match-1',
      marketType: 'ML',
      line: '1X2',
      outcome: 'home',
      modelProbability: 0.65,
      marketOdds: 2.0,
      impliedProbability: 0.50,
      expectedValue: 0.30,
      kellyStake: 0.05,
      clv: 0.10,
      confidence: 'HIGH',
      tier: 'PRO'
    };

    it('should return the pick unchanged if user has entitlement', () => {
      const gated = Paywall.gateEdgePick(pick, true);
      expect(gated.isLocked).toBe(false);
      expect(gated.outcome).toBe('home');
      expect(gated.expectedValue).toBe(0.30);
    });

    it('should hide sensitive fields if user does not have entitlement', () => {
      const gated = Paywall.gateEdgePick(pick, false);
      expect(gated.isLocked).toBe(true);
      expect(gated.line).toBe('Locked');
      expect(gated.outcome).toBe('locked');
      expect(gated.expectedValue).toBeNull();
      expect(gated.modelProbability).toBeNull();
      expect(gated.kellyStake).toBeNull();
      expect(gated.clv).toBeNull();
      expect(gated.marketOdds).toBe(2.0); // Odds remain public
      expect(gated.confidence).toBe('HIGH');
    });

    it('should gate a list of picks based on an evaluator function', () => {
      const picks: EdgePick[] = [
        { ...pick, tier: 'FREE', outcome: 'home' },
        { ...pick, tier: 'PRO', outcome: 'draw' },
        { ...pick, tier: 'ELITE', outcome: 'away' }
      ];

      // Evaluator grants access to FREE and PRO only
      const evaluator = (tier: 'FREE' | 'PRO' | 'ELITE') => tier === 'FREE' || tier === 'PRO';
      const gatedList = Paywall.gateEdgePicks(picks, evaluator);

      expect(gatedList[0].isLocked).toBe(false);
      expect(gatedList[1].isLocked).toBe(false);
      expect(gatedList[2].isLocked).toBe(true);
    });
  });

  describe('Billing adapters', () => {
    const opts = {
      userId: 'user-123',
      tier: 'PRO' as const,
      successUrl: 'https://success',
      cancelUrl: 'https://cancel'
    };

    it('should generate Stripe checkout links', async () => {
      const adapter = new StripeBillingAdapter();
      const res = await adapter.createCheckoutSession(opts);
      expect(res.sessionId).toContain('stripe_mock_sess_');
      expect(res.checkoutUrl).toBe('https://checkout.stripe.com/pay/mock_pro');
    });

    it('should generate LemonSqueezy checkout links', async () => {
      const adapter = new LemonSqueezyBillingAdapter();
      const res = await adapter.createCheckoutSession(opts);
      expect(res.sessionId).toContain('ls_mock_sess_');
      expect(res.checkoutUrl).toBe('https://handicaplab.lemonsqueezy.com/checkout/mock_pro');
    });

    it('should generate Crypto deposit session details', async () => {
      const adapter = new CryptoBillingAdapter();
      const res = await adapter.createCheckoutSession(opts);
      expect(res.sessionId).toContain('crypto_mock_payment_');
      expect(res.checkoutUrl).toBe('https://handicaplab.io/payment/crypto/mock_pro');
    });

    it('should generate Regional billing links', async () => {
      const adapter = new RegionalBillingAdapter();
      const res = await adapter.createCheckoutSession(opts);
      expect(res.sessionId).toContain('regional_mock_sess_');
      expect(res.checkoutUrl).toBe('https://handicaplab.com/billing/regional/mock_pro');
    });
  });
});
