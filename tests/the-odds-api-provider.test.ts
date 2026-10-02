import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TheOddsApiProvider } from '@/lib/providers/theOddsApiProvider';
import { TheOddsApiQuotaManager } from '@/lib/providers/theOddsApiQuotaManager';
import { TheOddsApiNormalizer, type TheOddsApiEvent } from '@/lib/data/providers/odds/theOddsApiNormalizer';
import { CanonicalFixtureFreshnessGate } from '@/lib/services/canonicalFixtureFreshnessGate';
import { globalGateway } from '@/lib/providers/providerGateway';
import { getOddsApiKey, hasOddsApiKey } from '@/lib/providers/providerKey';

describe('The Odds API Provider — Comprehensive Integration & Invariants (Section 12)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    TheOddsApiQuotaManager.resetStateForTest({
      totalMonthlyBudget: 500,
      used: 0,
      remaining: 500,
      reserveFloor: 50,
      usableRemaining: 450,
      status: 'NORMAL',
    });
    CanonicalFixtureFreshnessGate.saveRegistry({});
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // ==========================================================================
  // 1. AUTHENTICATION & KEY RESOLUTION
  // ==========================================================================
  describe('Authentication & Key Handling', () => {
    it('detects missing key properly', () => {
      delete process.env.ODDS_API_KEY;
      delete process.env.THE_ODDS_API_KEY;
      expect(hasOddsApiKey()).toBe(false);
      expect(getOddsApiKey()).toBe('');
    });

    it('resolves canonical ODDS_API_KEY first', () => {
      process.env.ODDS_API_KEY = 'canonical_key_12345';
      process.env.THE_ODDS_API_KEY = 'legacy_key_67890';
      expect(hasOddsApiKey()).toBe(true);
      expect(getOddsApiKey()).toBe('canonical_key_12345');
    });

    it('falls back to legacy THE_ODDS_API_KEY when canonical is unset', () => {
      delete process.env.ODDS_API_KEY;
      process.env.THE_ODDS_API_KEY = 'legacy_key_67890';
      expect(hasOddsApiKey()).toBe(true);
      expect(getOddsApiKey()).toBe('legacy_key_67890');
    });

    it('handles unauthorized (401/403) response gracefully without leaking secret', async () => {
      process.env.ODDS_API_KEY = 'invalid_test_key';
      process.env.RUN_LIVE_PROVIDER_TESTS = 'true';

      vi.spyOn(globalGateway, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Invalid API key' }), { status: 401 })
      );

      const res = await TheOddsApiProvider.healthCheck();
      expect(res.healthy).toBe(false);
      expect(res.configured).toBe(true);
      expect(res.error?.toLowerCase()).toContain('unauthorized');
      expect(res.error).not.toContain('invalid_test_key'); // Zero secret leak
    });
  });

  // ==========================================================================
  // 2. PROVIDER RESPONSE HANDLING
  // ==========================================================================
  describe('Provider Response Handling', () => {
    it('handles rate limit (429) correctly', async () => {
      process.env.ODDS_API_KEY = 'valid_test_key';
      process.env.RUN_LIVE_PROVIDER_TESTS = 'true';

      vi.spyOn(globalGateway, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Rate limit exceeded' }), { status: 429 })
      );

      const res = await TheOddsApiProvider.getOdds('soccer_epl');
      expect(res.success).toBe(false);
      expect(res.error).toContain('429');
    });

    it('handles timeout / network error without crashing', async () => {
      process.env.ODDS_API_KEY = 'valid_test_key';
      process.env.RUN_LIVE_PROVIDER_TESTS = 'true';

      vi.spyOn(globalGateway, 'fetch').mockRejectedValueOnce(new Error('Fetch timeout'));

      const res = await TheOddsApiProvider.getOdds('soccer_epl');
      expect(res.success).toBe(false);
      expect(res.error).toContain('Fetch timeout');
    });

    it('handles empty response gracefully', async () => {
      process.env.ODDS_API_KEY = 'valid_test_key';
      process.env.RUN_LIVE_PROVIDER_TESTS = 'true';

      vi.spyOn(globalGateway, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify([]), { status: 200 })
      );

      const res = await TheOddsApiProvider.getOdds('soccer_epl');
      expect(res.success).toBe(true);
      expect(res.records.length).toBe(0);
      expect(res.eventsCount).toBe(0);
    });
  });

  // ==========================================================================
  // 3. MARKET MAPPING: AH, OU LINE FAMILY, BTTS
  // ==========================================================================
  describe('Market Mapping & Line Categorization', () => {
    const sampleEvent: TheOddsApiEvent = {
      id: 'event_test_001',
      sport_key: 'soccer_epl',
      commence_time: '2026-10-10T15:00:00Z',
      home_team: 'Arsenal FC',
      away_team: 'Chelsea FC',
      bookmakers: [
        {
          key: 'pinnacle',
          title: 'Pinnacle',
          last_update: '2026-10-10T12:00:00Z',
          markets: [
            // Asian Handicap: Home -0.75, Away +0.75 (quarter line)
            {
              key: 'spreads',
              outcomes: [
                { name: 'Arsenal FC', price: 1.95, point: -0.75 },
                { name: 'Chelsea FC', price: 1.91, point: 0.75 },
              ],
            },
            // Over/Under Line Family: 2.25 (quarter), 2.5 (half), 3.0 (full)
            {
              key: 'totals',
              outcomes: [
                { name: 'Over', price: 1.80, point: 2.25 },
                { name: 'Under', price: 2.05, point: 2.25 },
                { name: 'Over', price: 1.95, point: 2.5 },
                { name: 'Under', price: 1.91, point: 2.5 },
                { name: 'Over', price: 2.40, point: 3.0 },
                { name: 'Under', price: 1.60, point: 3.0 },
              ],
            },
            // BTTS: Yes / No
            {
              key: 'btts',
              outcomes: [
                { name: 'Yes', price: 1.75 },
                { name: 'No', price: 2.10 },
              ],
            },
            // Unsupported market (e.g. h2h moneyline) - must not pollute strict SALMO scope
            {
              key: 'h2h',
              outcomes: [
                { name: 'Arsenal FC', price: 1.65 },
                { name: 'Chelsea FC', price: 5.00 },
                { name: 'Draw', price: 3.80 },
              ],
            },
          ],
        },
      ],
    };

    it('normalizes Asian Handicap quarter lines (-0.75 / +0.75) and preserves lines', () => {
      const records = TheOddsApiNormalizer.normalizeEvent(sampleEvent);
      const ahRecords = records.filter((r) => r.market === 'AH');

      expect(ahRecords.length).toBe(2);
      const homeAH = ahRecords.find((r) => r.selection === 'HOME')!;
      expect(homeAH.line).toBe(-0.75);
      expect(homeAH.lineType).toBe('QUARTER');
      expect(homeAH.oddsDecimal).toBe(1.95);
      expect(homeAH.bookmaker).toBe('pinnacle');

      const awayAH = ahRecords.find((r) => r.selection === 'AWAY')!;
      expect(awayAH.line).toBe(0.75);
      expect(awayAH.lineType).toBe('QUARTER');
      expect(awayAH.oddsDecimal).toBe(1.91);
    });

    it('treats Over/Under as a line family and distinguishes FULL, HALF, and QUARTER lines', () => {
      const records = TheOddsApiNormalizer.normalizeEvent(sampleEvent);
      const ouRecords = records.filter((r) => r.market === 'OU');

      // 3 line families (2.25, 2.5, 3.0) * 2 sides (over, under) = 6 records
      expect(ouRecords.length).toBe(6);

      const quarterOU = ouRecords.filter((r) => r.line === 2.25);
      expect(quarterOU.length).toBe(2);
      expect(quarterOU[0].lineType).toBe('QUARTER');

      const halfOU = ouRecords.filter((r) => r.line === 2.5);
      expect(halfOU.length).toBe(2);
      expect(halfOU[0].lineType).toBe('HALF');

      const fullOU = ouRecords.filter((r) => r.line === 3.0);
      expect(fullOU.length).toBe(2);
      expect(fullOU[0].lineType).toBe('FULL');
    });

    it('normalizes BTTS Yes/No without confusing with Moneyline 1X2', () => {
      const records = TheOddsApiNormalizer.normalizeEvent(sampleEvent);
      const bttsRecords = records.filter((r) => r.market === 'BTTS');

      expect(bttsRecords.length).toBe(2);
      const yes = bttsRecords.find((r) => r.selection === 'Yes')!;
      const no = bttsRecords.find((r) => r.selection === 'No')!;

      expect(yes.oddsDecimal).toBe(1.75);
      expect(no.oddsDecimal).toBe(2.10);
      expect(yes.line).toBeNull();
      expect(yes.lineType).toBe('NONE');

      // Assert h2h (moneyline) was excluded from SALMO scope
      expect(records.some((r) => (r.market as any) === 'h2h' || (r.market as any) === 'ML')).toBe(false);
    });
  });

  // ==========================================================================
  // 4. HISTORICAL ODDS & CAPABILITY HANDLING
  // ==========================================================================
  describe('Historical Odds & Capability Gating', () => {
    it('returns structured CAPABILITY_UNAVAILABLE when endpoint is not permitted on plan', async () => {
      process.env.ODDS_API_KEY = 'valid_test_key';
      process.env.RUN_LIVE_PROVIDER_TESTS = 'true';

      vi.spyOn(globalGateway, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            message: 'Historical odds requires an active paid plan with the historical add-on.',
          }),
          { status: 403 }
        )
      );

      const res = await TheOddsApiProvider.getHistoricalOdds('soccer_epl', '2026-09-20T12:00:00Z');
      expect(res.success).toBe(false);
      expect(res.error).toBe('CAPABILITY_UNAVAILABLE');
      expect(res.message).toContain('historical add-on');
    });

    it('preserves timestamps and returns verified data when historical response succeeds', async () => {
      process.env.ODDS_API_KEY = 'valid_test_key';
      process.env.RUN_LIVE_PROVIDER_TESTS = 'true';

      const mockHistoricalPayload = {
        timestamp: '2026-09-20T12:00:00Z',
        data: [{ id: 'hist_001', commence_time: '2026-09-20T14:00:00Z' }],
      };

      vi.spyOn(globalGateway, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockHistoricalPayload), { status: 200 })
      );

      const res = await TheOddsApiProvider.getHistoricalOdds('soccer_epl', '2026-09-20T12:00:00Z');
      expect(res.success).toBe(true);
      expect(res.timestamp).toBe('2026-09-20T12:00:00Z');
      expect(res.data?.length).toBe(1);
    });
  });

  // ==========================================================================
  // 5. CREDIT & QUOTA MANAGEMENT
  // ==========================================================================
  describe('Credit / Quota Discipline', () => {
    it('permits unmetered endpoints (sports, health) even when remaining is low', () => {
      TheOddsApiQuotaManager.resetStateForTest({ remaining: 10, reserveFloor: 50 });
      const auth = TheOddsApiQuotaManager.authorizeRequest('sports', 10);
      expect(auth.allowed).toBe(true);
    });

    it('protects reserve floor: blocks normal requests when remaining <= 50', () => {
      TheOddsApiQuotaManager.resetStateForTest({ remaining: 45, reserveFloor: 50 });
      const normalAuth = TheOddsApiQuotaManager.authorizeRequest('odds', 50);
      expect(normalAuth.allowed).toBe(false);
      expect(normalAuth.reason).toContain('RESERVE_FLOOR_PROTECTED');

      // Critical P0 request (priority >= 90) still allowed
      const criticalAuth = TheOddsApiQuotaManager.authorizeRequest('odds', 95);
      expect(criticalAuth.allowed).toBe(true);
    });

    it('enforces HARD_STOP when remaining <= 5', () => {
      TheOddsApiQuotaManager.resetStateForTest({ remaining: 3 });
      const auth = TheOddsApiQuotaManager.authorizeRequest('odds', 100);
      expect(auth.allowed).toBe(false);
      expect(auth.reason).toBe('HARD_STOP_ACTIVE');
    });

    it('synchronizes live quota state honestly from provider response headers', () => {
      TheOddsApiQuotaManager.resetStateForTest({ totalMonthlyBudget: 500, used: 0, remaining: 500 });

      TheOddsApiQuotaManager.recordExecution({
        requestId: 'req_live_sync_01',
        endpoint: 'odds',
        method: 'GET',
        cost: 1,
        httpStatus: 200,
        success: true,
        latencyMs: 120,
        headers: {
          'x-requests-remaining': '482',
          'x-requests-used': '18',
        },
      });

      const updated = TheOddsApiQuotaManager.getStatus();
      expect(updated.remaining).toBe(482);
      expect(updated.used).toBe(18);
      expect(updated.usableRemaining).toBe(432); // 482 - 50 reserve
    });
  });

  // ==========================================================================
  // 6. MATCH IDENTITY RESOLUTION
  // ==========================================================================
  describe('Match Identity Resolution', () => {
    it('resolves provider event to Canonical Match Registry without overwriting canonical ID', () => {
      // 1. Seed canonical match
      CanonicalFixtureFreshnessGate.upsertFixture({
        canonicalMatchId: 'cm_canonical_arsenal_chelsea',
        providerMatchId: 'apifootball_99182',
        homeTeam: 'Arsenal FC',
        awayTeam: 'Chelsea FC',
        competition: 'Premier League',
        season: '2026',
        kickoffUtc: '2026-10-10T15:00:00Z',
        status: 'SCHEDULED',
        provider: 'api-football',
      });

      const event: TheOddsApiEvent = {
        id: 'toa_external_event_999',
        sport_key: 'soccer_epl',
        commence_time: '2026-10-10T15:00:00Z',
        home_team: 'Arsenal',
        away_team: 'Chelsea',
        bookmakers: [
          {
            key: 'pinnacle',
            title: 'Pinnacle',
            markets: [
              {
                key: 'spreads',
                outcomes: [
                  { name: 'Arsenal', price: 1.95, point: -0.5 },
                  { name: 'Chelsea', price: 1.91, point: 0.5 },
                ],
              },
            ],
          },
        ],
      };

      const records = TheOddsApiNormalizer.normalizeEvent(event);
      expect(records.length).toBe(2);

      const record = records[0];
      // Mapped to canonical ID
      expect(record.canonicalMatchId).toBe('cm_canonical_arsenal_chelsea');
      // Preserved provider event ID separately
      expect(record.providerMatchId).toBe('toa_external_event_999');
      expect(record.isResolvedMatch).toBe(true);
    });

    it('handles unmatched fixture gracefully without corrupting match UUID', () => {
      const unmatchedEvent: TheOddsApiEvent = {
        id: 'toa_unknown_event_888',
        sport_key: 'soccer_epl',
        commence_time: '2026-10-15T15:00:00Z',
        home_team: 'Unknown Team A',
        away_team: 'Unknown Team B',
        bookmakers: [
          {
            key: 'pinnacle',
            title: 'Pinnacle',
            markets: [
              {
                key: 'spreads',
                outcomes: [
                  { name: 'Unknown Team A', price: 1.95, point: 0 },
                  { name: 'Unknown Team B', price: 1.95, point: 0 },
                ],
              },
            ],
          },
        ],
      };

      const records = TheOddsApiNormalizer.normalizeEvent(unmatchedEvent);
      expect(records.length).toBe(2);
      expect(records[0].canonicalMatchId).toBeNull();
      expect(records[0].providerMatchId).toBe('toa_unknown_event_888');
      expect(records[0].isResolvedMatch).toBe(false);
    });
  });
});
