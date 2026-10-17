import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TheOddsApiQuotaManager } from '@/lib/providers/theOddsApiQuotaManager';
import { TheOddsApiProvider } from '@/lib/providers/theOddsApiProvider';
import { calculateTheOddsApiCost } from '@/lib/providers/quotaManagerV4';
import { isUnmeteredEndpoint } from '@/lib/providers/quotaPolicy';
import { TheOddsApiNormalizer, type TheOddsApiEvent } from '@/lib/data/providers/odds/theOddsApiNormalizer';
import { DailyPicksEngine } from '@/lib/daily-picks/engine';

describe('EPIC: The Odds API Fallback, Atomic Quota Safety & Normalization', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    TheOddsApiQuotaManager.resetStateForTest();
  });

  describe('1. Quota Policy & Conservative Cost Estimation', () => {
    it('correctly classifies sports, events, and health as 0-credit unmetered endpoints', () => {
      expect(isUnmeteredEndpoint('the-odds-api', 'sports')).toBe(true);
      expect(isUnmeteredEndpoint('the-odds-api', 'events')).toBe(true);
      expect(isUnmeteredEndpoint('the-odds-api', 'health')).toBe(true);
      expect(isUnmeteredEndpoint('the-odds-api', 'odds')).toBe(false);
    });

    it('calculates conservative cost: regions count * markets count', () => {
      // 1 region, 2 markets (spreads, totals) = 2 credits
      expect(calculateTheOddsApiCost('eu', 'spreads,totals')).toBe(2);

      // 2 regions (eu,uk), 2 markets (spreads,totals) = 4 credits
      expect(calculateTheOddsApiCost('eu,uk', 'spreads,totals')).toBe(4);

      // 1 region (eu), 1 market (spreads) = 1 credit
      expect(calculateTheOddsApiCost('eu', 'spreads')).toBe(1);

      // Default fallback handles empty gracefully
      expect(calculateTheOddsApiCost('', '')).toBe(1);
    });
  });

  describe('2. Quota Safety Limits & Reserve Floor Protection', () => {
    it('allows unmetered /events request even with standard priority', () => {
      const res = TheOddsApiQuotaManager.authorizeRequest('events', 50, 0);
      expect(res.allowed).toBe(true);
    });

    it('blocks metered requests if expected cost would breach into the 150-credit reserve floor for non-P0 calls', () => {
      // Set remaining to exactly 151 credits (usable remaining = 1)
      TheOddsApiQuotaManager.resetStateForTest({
        totalMonthlyBudget: 500,
        used: 349,
        remaining: 151,
        usableRemaining: 1,
        reserveFloor: 150,
      });

      // A 2-credit call would breach the 150 floor (151 - 2 = 149 < 150)
      const res = TheOddsApiQuotaManager.authorizeRequest('odds', 70, 2);
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('RESERVE_FLOOR_BREACH');

      // However, a P0 critical call (priority 90) is allowed to access reserve
      const p0Res = TheOddsApiQuotaManager.authorizeRequest('odds', 90, 2);
      expect(p0Res.allowed).toBe(true);
    });

    it('enforces hard stop when remaining credits <= 5 regardless of priority', () => {
      TheOddsApiQuotaManager.resetStateForTest({
        totalMonthlyBudget: 500,
        used: 496,
        remaining: 4,
        usableRemaining: 0,
        reserveFloor: 150,
      });

      const res = TheOddsApiQuotaManager.authorizeRequest('odds', 99, 1);
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('HARD_STOP_ACTIVE');
    });

    it('enforces MONTHLY_QUOTA_EXHAUSTED when remaining is 0', () => {
      TheOddsApiQuotaManager.resetStateForTest({
        totalMonthlyBudget: 500,
        used: 500,
        remaining: 0,
        usableRemaining: 0,
        reserveFloor: 150,
      });

      const res = TheOddsApiQuotaManager.authorizeRequest('odds', 99, 1);
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('MONTHLY_QUOTA_EXHAUSTED');
    });

    it('updates status to ECONOMY when 300 credits are consumed (warning threshold)', () => {
      const state = TheOddsApiQuotaManager.recordExecution({
        requestId: 'test_req',
        endpoint: 'odds',
        method: 'GET',
        cost: 2,
        httpStatus: 200,
        success: true,
        latencyMs: 50,
        headers: {
          'x-requests-used': '302',
          'x-requests-remaining': '198',
        },
      });

      expect(state.used).toBe(302);
      expect(state.remaining).toBe(198);
      expect(state.status).toBe('ECONOMY');
    });
  });

  describe('3. Odds Reconciliation with Canonical Fixtures', () => {
    it('correctly maps AH and OU quarter-lines into fixture.markets', () => {
      const mockFixtures = [
        {
          fixtureId: 'epl_2026_everton_chelsea',
          homeTeam: 'Everton',
          awayTeam: 'Chelsea',
          kickoffUtc: '2026-10-17T11:30:00Z',
          markets: {
            asianHandicap: { available: false, line: null, homeOdds: null, awayOdds: null },
            overUnder: { available: false, line: null, overOdds: null, underOdds: null },
            btts: { available: false, line: null, yesOdds: null, noOdds: null },
          },
        },
      ];

      const mockOddsRecords = [
        {
          recordId: 'toa_ah_1',
          canonicalMatchId: null,
          providerMatchId: 'toa_evt_1',
          provider: 'the-odds-api' as const,
          sportKey: 'soccer_epl',
          homeTeam: 'Everton',
          awayTeam: 'Chelsea',
          kickoffUtc: '2026-10-17T11:30:00Z',
          bookmaker: 'pinnacle',
          market: 'AH' as const,
          line: -0.25,
          lineType: 'QUARTER_LINE' as any,
          selection: 'HOME',
          oddsDecimal: 1.92,
          homeOdds: 1.92,
          awayOdds: 1.96,
          providerTimestamp: '2026-10-16T12:00:00Z',
          capturedAtUtc: '2026-10-16T12:00:00Z',
          isResolvedMatch: false,
        },
        {
          recordId: 'toa_ou_1',
          canonicalMatchId: null,
          providerMatchId: 'toa_evt_1',
          provider: 'the-odds-api' as const,
          sportKey: 'soccer_epl',
          homeTeam: 'Everton',
          awayTeam: 'Chelsea',
          kickoffUtc: '2026-10-17T11:30:00Z',
          bookmaker: 'pinnacle',
          market: 'OU' as const,
          line: 2.75,
          lineType: 'QUARTER_LINE' as any,
          selection: 'Over 2.75',
          oddsDecimal: 1.85,
          overOdds: 1.85,
          underOdds: 2.05,
          providerTimestamp: '2026-10-16T12:00:00Z',
          capturedAtUtc: '2026-10-16T12:00:00Z',
          isResolvedMatch: false,
        },
      ];

      const { fixtures, matchedCount } = TheOddsApiProvider.reconcileOddsWithFixtures(
        mockFixtures,
        mockOddsRecords
      );

      expect(matchedCount).toBe(1);
      const f = fixtures[0];

      // AH assertions
      expect(f.markets.asianHandicap.available).toBe(true);
      expect(f.markets.asianHandicap.line).toBe(-0.25);
      expect(f.markets.asianHandicap.homeOdds).toBe(1.92);
      expect(f.markets.asianHandicap.awayOdds).toBe(1.96);
      expect(f.hasPinnacleOdds).toBe(true);

      // OU assertions
      expect(f.markets.overUnder.available).toBe(true);
      expect(f.markets.overUnder.line).toBe(2.75);
      expect(f.markets.overUnder.overOdds).toBe(1.85);
      expect(f.markets.overUnder.underOdds).toBe(2.05);
    });

    it('rejects match reconciliation if kickoff times diverge by more than 3 hours', () => {
      const mockFixtures = [
        {
          fixtureId: 'epl_2026_everton_chelsea',
          homeTeam: 'Everton',
          awayTeam: 'Chelsea',
          kickoffUtc: '2026-10-17T11:30:00Z',
          markets: {
            asianHandicap: { available: false, line: null, homeOdds: null, awayOdds: null },
          },
        },
      ];

      const staleOddsRecords = [
        {
          recordId: 'toa_ah_stale',
          canonicalMatchId: null,
          providerMatchId: 'toa_evt_stale',
          provider: 'the-odds-api' as const,
          sportKey: 'soccer_epl',
          homeTeam: 'Everton',
          awayTeam: 'Chelsea',
          kickoffUtc: '2026-10-17T18:00:00Z', // 6.5 hours later!
          bookmaker: 'pinnacle',
          market: 'AH' as const,
          line: -0.25,
          lineType: 'QUARTER_LINE' as any,
          selection: 'HOME',
          oddsDecimal: 1.92,
          providerTimestamp: '2026-10-16T12:00:00Z',
          capturedAtUtc: '2026-10-16T12:00:00Z',
          isResolvedMatch: false,
        },
      ];

      const { matchedCount } = TheOddsApiProvider.reconcileOddsWithFixtures(
        mockFixtures,
        staleOddsRecords
      );

      expect(matchedCount).toBe(0);
      expect(mockFixtures[0].markets.asianHandicap.available).toBe(false);
    });
  });

  describe('4. Quota Exhaustion & Hard Stop Enforcement', () => {
    it('rejects metered requests when remaining < expectedCost (INSUFFICIENT_CREDITS)', () => {
      TheOddsApiQuotaManager.resetStateForTest({
        totalMonthlyBudget: 500,
        used: 499,
        remaining: 1,
        usableRemaining: 0,
        reserveFloor: 150,
      });

      // Requesting 2 credits with only 1 credit remaining
      const res = TheOddsApiQuotaManager.authorizeRequest('odds', 90, 2);
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('INSUFFICIENT_CREDITS');
    });

    it('rejects metered requests when remaining <= 5 even for P0 / priority 100 (HARD_STOP_ACTIVE)', () => {
      TheOddsApiQuotaManager.resetStateForTest({
        totalMonthlyBudget: 500,
        used: 495,
        remaining: 5,
        usableRemaining: 0,
        reserveFloor: 150,
      });

      const res = TheOddsApiQuotaManager.authorizeRequest('odds', 100, 1);
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('HARD_STOP_ACTIVE');
    });

    it('allows P0 critical calls (priority >= 90) to use reserve credits down to hard stop (> 5)', () => {
      TheOddsApiQuotaManager.resetStateForTest({
        totalMonthlyBudget: 500,
        used: 400,
        remaining: 100,
        usableRemaining: 0,
        reserveFloor: 150,
      });

      // 100 credits remaining is inside reserve floor (< 150)
      // Standard priority 50 must be blocked
      const p50 = TheOddsApiQuotaManager.authorizeRequest('odds', 50, 2);
      expect(p50.allowed).toBe(false);
      expect(p50.reason).toContain('RESERVE_FLOOR_PROTECTED');

      // P0 critical priority 90 is authorized to access reserve
      const p90 = TheOddsApiQuotaManager.authorizeRequest('odds', 90, 2);
      expect(p90.allowed).toBe(true);
    });
  });

  describe('5. Concurrent Reservations & Atomic Quota Protection', () => {
    it('prevents quota over-subscription under concurrent requests', () => {
      // 154 remaining, reserve floor 150 -> exactly 4 usable credits
      TheOddsApiQuotaManager.resetStateForTest({
        totalMonthlyBudget: 500,
        used: 346,
        remaining: 154,
        usableRemaining: 4,
        reserveFloor: 150,
      });

      // Simulate 4 concurrent requests, each asking for 2 credits (total 8 credits requested)
      const results: boolean[] = [];
      for (let i = 0; i < 4; i++) {
        const auth = TheOddsApiQuotaManager.authorizeRequest('odds', 50, 2);
        if (auth.allowed) {
          results.push(true);
          // Deduct simulated reservation
          const cur = TheOddsApiQuotaManager.loadState();
          TheOddsApiQuotaManager.resetStateForTest({
            ...cur,
            remaining: cur.remaining - 2,
            usableRemaining: Math.max(0, cur.usableRemaining - 2),
            used: cur.used + 2,
          });
        } else {
          results.push(false);
        }
      }

      // Exactly 2 should succeed (2 * 2 = 4 usable credits), and 2 should fail
      const allowedCount = results.filter((r) => r === true).length;
      const rejectedCount = results.filter((r) => r === false).length;
      expect(allowedCount).toBe(2);
      expect(rejectedCount).toBe(2);
    });
  });

  describe('6. Safe Fallback Behavior in DailyPicksEngine', () => {
    it('engages The Odds API fallback when ODDSPAPI_PAUSED=true and formats Pinnacle-compatible fixtures', async () => {
      const originalEnv = process.env.ODDSPAPI_PAUSED;
      const originalKey = process.env.ODDS_API_KEY;
      process.env.ODDSPAPI_PAUSED = 'true';
      process.env.ODDS_API_KEY = 'test_key_dummy_1234567890';

      const mockRecords = [
        {
          recordId: 'toa_ah_1',
          canonicalMatchId: 'epl_2026_everton_chelsea',
          providerMatchId: 'evt_1',
          provider: 'the-odds-api' as const,
          sportKey: 'soccer_epl',
          homeTeam: 'Everton',
          awayTeam: 'Chelsea',
          kickoffUtc: '2026-10-17T11:30:00Z',
          bookmaker: 'pinnacle',
          market: 'AH' as const,
          line: -0.25,
          lineType: 'QUARTER_LINE' as any,
          selection: 'HOME',
          oddsDecimal: 1.95,
          homeOdds: 1.95,
          awayOdds: 1.93,
          providerTimestamp: '2026-10-16T12:00:00Z',
          capturedAtUtc: '2026-10-16T12:00:00Z',
          isResolvedMatch: true,
        },
        {
          recordId: 'toa_ou_1',
          canonicalMatchId: 'epl_2026_everton_chelsea',
          providerMatchId: 'evt_1',
          provider: 'the-odds-api' as const,
          sportKey: 'soccer_epl',
          homeTeam: 'Everton',
          awayTeam: 'Chelsea',
          kickoffUtc: '2026-10-17T11:30:00Z',
          bookmaker: 'pinnacle',
          market: 'OU' as const,
          line: 2.5,
          lineType: 'HALF_LINE' as any,
          selection: 'Over 2.5',
          oddsDecimal: 1.90,
          overOdds: 1.90,
          underOdds: 2.00,
          providerTimestamp: '2026-10-16T12:00:00Z',
          capturedAtUtc: '2026-10-16T12:00:00Z',
          isResolvedMatch: true,
        },
      ];

      vi.spyOn(TheOddsApiProvider, 'getOdds').mockResolvedValueOnce({
        success: true,
        records: mockRecords,
        snapshots: [],
        eventsCount: 1,
      });

      try {
        const result = await DailyPicksEngine.retrieveOddsPapiPinnacle([
          { homeTeam: 'Everton', awayTeam: 'Chelsea', kickoffUtc: '2026-10-17T11:30:00Z' },
        ]);

        expect(result.ok).toBe(true);
        expect(result.fixtures.length).toBe(1);
        const fix = result.fixtures[0];
        expect(fix.participant1Name).toBe('Everton');
        expect(fix.participant2Name).toBe('Chelsea');
        expect(fix.bookmakerOdds?.pinnacle).toBeDefined();

        // Pinnacle AH market 1070
        expect(fix.bookmakerOdds.pinnacle.markets['1070']?.outcomes?.['1070']?.players?.['0']?.price).toBe(1.95);
        // Pinnacle OU market 1010
        expect(fix.bookmakerOdds.pinnacle.markets['1010']?.outcomes?.['1010']?.players?.['0']?.price).toBe(1.90);
      } finally {
        process.env.ODDSPAPI_PAUSED = originalEnv;
        if (originalKey === undefined) {
          delete process.env.ODDS_API_KEY;
        } else {
          process.env.ODDS_API_KEY = originalKey;
        }
      }
    });

    it('fails closed with ok: false when both OddsPapi and The Odds API return empty/error', async () => {
      const originalEnv = process.env.ODDSPAPI_PAUSED;
      const originalKey = process.env.ODDS_API_KEY;
      process.env.ODDSPAPI_PAUSED = 'true';
      process.env.ODDS_API_KEY = 'test_key_dummy_1234567890';

      vi.spyOn(TheOddsApiProvider, 'getOdds').mockResolvedValueOnce({
        success: false,
        records: [],
        snapshots: [],
        eventsCount: 0,
        error: 'QUOTA_EXHAUSTED',
      });

      try {
        const result = await DailyPicksEngine.retrieveOddsPapiPinnacle([
          { homeTeam: 'Everton', awayTeam: 'Chelsea', kickoffUtc: '2026-10-17T11:30:00Z' },
        ]);

        expect(result.ok).toBe(false);
        expect(result.fixtures).toEqual([]);
        expect(result.errorCode).toBe('FALLBACK_EMPTY');
      } finally {
        process.env.ODDSPAPI_PAUSED = originalEnv;
        if (originalKey === undefined) {
          delete process.env.ODDS_API_KEY;
        } else {
          process.env.ODDS_API_KEY = originalKey;
        }
      }
    });
  });

  describe('7. Malformed Odds & Corrupted Input Handling', () => {
    it('discards non-positive, sub-1.0, and NaN odds without crashing', () => {
      const malformedEvent: TheOddsApiEvent = {
        id: 'evt_malformed',
        sport_key: 'soccer_epl',
        commence_time: '2026-10-17T11:30:00Z',
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
                  { name: 'Arsenal', price: 0.95, point: -0.5 }, // Sub-1.0 price
                  { name: 'Chelsea', price: -1.5, point: 0.5 }, // Negative price
                ],
              },
              {
                key: 'totals',
                outcomes: [
                  { name: 'Over', price: NaN as any, point: 2.5 }, // NaN price
                  { name: 'Under', price: 1.95, point: NaN as any }, // NaN point
                ],
              },
              {
                key: 'btts',
                outcomes: [
                  { name: 'Yes', price: 'invalid' as any }, // Non-numeric string price
                ],
              },
            ],
          },
        ],
      };

      const normalized = TheOddsApiNormalizer.normalizeEvent(malformedEvent);
      // All invalid outcomes must be filtered out
      expect(normalized.length).toBe(0);
    });

    it('leaves fixture market unavailable when all provided odds for that market are malformed', () => {
      const mockFixtures = [
        {
          fixtureId: 'epl_2026_arsenal_chelsea',
          homeTeam: 'Arsenal',
          awayTeam: 'Chelsea',
          kickoffUtc: '2026-10-17T11:30:00Z',
          markets: {
            asianHandicap: { available: false, line: null, homeOdds: null, awayOdds: null },
            overUnder: { available: false, line: null, overOdds: null, underOdds: null },
          },
        },
      ];

      // Empty / invalid odds records
      const { fixtures, matchedCount } = TheOddsApiProvider.reconcileOddsWithFixtures(
        mockFixtures,
        []
      );

      expect(matchedCount).toBe(0);
      expect(fixtures[0].markets.asianHandicap.available).toBe(false);
      expect(fixtures[0].markets.overUnder.available).toBe(false);
    });
  });

  describe('8. Duplicate Fixture & Odds Ingestion Deduplication', () => {
    it('prioritizes Pinnacle odds when multiple bookmakers quote the same market', () => {
      const mockFixtures = [
        {
          fixtureId: 'epl_2026_everton_chelsea',
          homeTeam: 'Everton',
          awayTeam: 'Chelsea',
          kickoffUtc: '2026-10-17T11:30:00Z',
          markets: {
            asianHandicap: { available: false, line: null, homeOdds: null, awayOdds: null },
          },
        },
      ];

      const multiBookmakerOdds = [
        {
          recordId: 'toa_ah_bet365',
          canonicalMatchId: null,
          providerMatchId: 'evt_1',
          provider: 'the-odds-api' as const,
          sportKey: 'soccer_epl',
          homeTeam: 'Everton',
          awayTeam: 'Chelsea',
          kickoffUtc: '2026-10-17T11:30:00Z',
          bookmaker: 'bet365',
          market: 'AH' as const,
          line: -0.25,
          lineType: 'QUARTER_LINE' as any,
          selection: 'HOME',
          oddsDecimal: 1.88,
          homeOdds: 1.88,
          awayOdds: 2.02,
          providerTimestamp: '2026-10-16T12:00:00Z',
          capturedAtUtc: '2026-10-16T12:00:00Z',
          isResolvedMatch: false,
        },
        {
          recordId: 'toa_ah_pinnacle',
          canonicalMatchId: null,
          providerMatchId: 'evt_1',
          provider: 'the-odds-api' as const,
          sportKey: 'soccer_epl',
          homeTeam: 'Everton',
          awayTeam: 'Chelsea',
          kickoffUtc: '2026-10-17T11:30:00Z',
          bookmaker: 'pinnacle',
          market: 'AH' as const,
          line: -0.25,
          lineType: 'QUARTER_LINE' as any,
          selection: 'HOME',
          oddsDecimal: 1.95,
          homeOdds: 1.95,
          awayOdds: 1.93,
          providerTimestamp: '2026-10-16T12:00:00Z',
          capturedAtUtc: '2026-10-16T12:00:00Z',
          isResolvedMatch: false,
        },
      ];

      const { fixtures } = TheOddsApiProvider.reconcileOddsWithFixtures(
        mockFixtures,
        multiBookmakerOdds
      );

      const f = fixtures[0];
      expect(f.markets.asianHandicap.available).toBe(true);
      // Pinnacle odds (1.95) must be chosen over bet365 (1.88)
      expect(f.markets.asianHandicap.homeOdds).toBe(1.95);
      expect(f.hasPinnacleOdds).toBe(true);
    });
  });
});
