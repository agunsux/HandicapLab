import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TheOddsApiQuotaManager } from '@/lib/providers/theOddsApiQuotaManager';
import { TheOddsApiProvider } from '@/lib/providers/theOddsApiProvider';
import { calculateTheOddsApiCost } from '@/lib/providers/quotaManagerV4';
import { isUnmeteredEndpoint } from '@/lib/providers/quotaPolicy';

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
});
