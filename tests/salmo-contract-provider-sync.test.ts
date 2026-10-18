import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiFootballProvider } from '@/lib/warehouse/ingestion/apiFootballProvider';
import { AuthenticationError } from '@/lib/warehouse/ingestion/errors';
import { FootyStatsAPI } from '@/services/footystats.api';
import { OddsPapiQuotaAllocator } from '@/lib/providers/oddspapiQuotaAllocator';
import { SalmoProductionSyncService } from '@/lib/salmo/salmoProductionSyncService';
import { CanonicalBetLedgerService } from '@/lib/ledger/canonicalBetLedger';
import { CanonicalFixtureFreshnessGate } from '@/lib/services/canonicalFixtureFreshnessGate';

describe('SALMO Contract & Provider Sync Verification Suite', () => {
  beforeEach(() => {
    CanonicalFixtureFreshnessGate.clearForTesting();
    CanonicalBetLedgerService.clearForTesting();
  });

  describe('1. API-Football Provider Hard Failure on Suspended Account', () => {
    it('throws AuthenticationError when API-Football returns 200 with access suspended error', async () => {
      const provider = new ApiFootballProvider({ apiKey: 'mock-key', baseUrl: 'https://mock.api' });

      // Mock fetch to simulate API-Football suspended account response
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({
          get: 'status',
          parameters: [],
          errors: {
            access: 'Your account is suspended, check on https://dashboard.api-football.com.',
          },
          results: 0,
          paging: { current: 1, total: 1 },
          response: [],
        }),
      } as any);

      await expect(provider.getCompetitions()).rejects.toThrow(AuthenticationError);
    });

    it('healthCheck returns false when account is suspended or has errors', async () => {
      const provider = new ApiFootballProvider({ apiKey: 'mock-key', baseUrl: 'https://mock.api' });

      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({
          errors: { access: 'Your account is suspended' },
          response: [],
        }),
      } as any);

      const isHealthy = await provider.healthCheck();
      expect(isHealthy).toBe(false);
    });
  });

  describe('2. FootyStats Demo Key Hard Rejection', () => {
    it('rejects demo key test85g57 and prevents unauthenticated live ingestion', async () => {
      const originalEnv = process.env.FOOTYSTATS_API_KEY;
      try {
        process.env.FOOTYSTATS_API_KEY = 'test85g57';
        const footyApi = new FootyStatsAPI();
        await expect(footyApi.getMatchesForToday()).rejects.toThrow(/demo key/i);
      } finally {
        process.env.FOOTYSTATS_API_KEY = originalEnv;
      }
    });
  });

  describe('3. OddsPapi Protected Reserve & Quota Invariants', () => {
    it('blocks operational requests when quota reaches reserve floor or is paused', () => {
      const originalPaused = process.env.ODDSPAPI_PAUSED;
      try {
        process.env.ODDSPAPI_PAUSED = 'true';
        const decision = OddsPapiQuotaAllocator.canAcquire({
          leagueId: 'epl',
          tier: 'A',
          priority: 'NORMAL',
        });
        expect(decision.allowed).toBe(false);
        expect(decision.reason).toContain('ODDSPAPI_PAUSED');
      } finally {
        process.env.ODDSPAPI_PAUSED = originalPaused;
      }
    });
  });

  describe('4. SALMO Contract DTOs: Upcoming Fixtures, Results, Provider Status & CLV', () => {
    it('emits comprehensive versioned contract payload with upcomingFixtures, verifiedResults, and providerStatus', () => {
      const nowMs = new Date('2026-10-18T12:00:00Z').getTime();

      // Seed an upcoming fixture (Tomorrow: 24h away)
      CanonicalFixtureFreshnessGate.upsertFixture({
        providerMatchId: 'af_tomorrow_01',
        homeTeam: 'Arsenal',
        awayTeam: 'Liverpool',
        competition: 'Premier League',
        season: '2026',
        kickoffUtc: '2026-10-19T15:00:00Z',
        status: 'NS',
        provider: 'api-football',
      });

      // Seed a finished fixture with verified score
      CanonicalFixtureFreshnessGate.upsertFixture({
        providerMatchId: 'af_finished_01',
        homeTeam: 'Chelsea',
        awayTeam: 'Tottenham',
        competition: 'Premier League',
        season: '2026',
        kickoffUtc: '2026-10-17T15:00:00Z',
        status: 'FT',
        provider: 'api-football',
        homeGoals: 2,
        awayGoals: 1,
      });

      // Seed a prediction for Arsenal vs Liverpool
      CanonicalBetLedgerService.recordPrediction({
        canonicalFixtureId: 'cm_sync_test_01',
        fixture: 'Arsenal vs Liverpool',
        competition: 'Premier League',
        league: 'Premier League',
        homeTeam: 'Arsenal',
        awayTeam: 'Liverpool',
        kickoffTimestamp: '2026-10-19T15:00:00Z',
        market: 'AH',
        selection: 'HOME',
        line: -0.25,
        provider: 'OddsPapi',
        bookmaker: 'Pinnacle',
        marketOdds: 1.95,
        oddsTimestamp: '2026-10-18T10:00:00Z',
        modelProbability: 0.55,
        fairOdds: 1.818,
        expectedValue: 0.072,
        edge: 0.035,
        confidence: 'HIGH',
        confidenceScore: 82,
        valueStatus: 'VALUE',
        predictionTimestamp: '2026-10-18T10:00:00Z',
        featureTimestamp: '2026-10-18T09:00:00Z',
        modelVersion: 'dixon-coles-v1.0',
        pipelineVersion: 'v1.0',
        dataVersion: 'v1.0',
      });

      const payload = SalmoProductionSyncService.generateSyncPayload({ nowMs });

      expect(payload.success).toBe(true);
      expect(payload.dataState).toBe('REAL');
      expect(payload.dailyPicks.length).toBe(1);
      expect(payload.dailyPicks[0].targetWindow).toBe('TOMORROW');

      // Verify upcoming fixtures
      expect(payload.upcomingFixtures).toBeDefined();
      expect(payload.upcomingFixtures!.length).toBeGreaterThanOrEqual(1);
      const upcoming = payload.upcomingFixtures!.find((f) => f.homeTeam === 'Arsenal');
      expect(upcoming).toBeDefined();
      expect(upcoming?.targetWindow).toBe('TOMORROW');
      expect(upcoming?.marketsAvailable).toEqual(['AH', 'OU', 'BTTS']);

      // Verify verified results
      expect(payload.verifiedResults).toBeDefined();
      expect(payload.verifiedResults!.length).toBeGreaterThanOrEqual(1);
      const finished = payload.verifiedResults!.find((f) => f.homeTeam === 'Chelsea');
      expect(finished).toBeDefined();
      expect(finished?.homeGoals).toBe(2);
      expect(finished?.awayGoals).toBe(1);
      expect(finished?.totalGoals).toBe(3);

      // Verify provider status
      expect(payload.providerStatus).toBeDefined();
      expect(payload.providerStatus?.apiFootball.status).toBe('AUTH_FAILED');
      expect(payload.providerStatus?.apiFootball.liveIngestion).toBe('BLOCKED');
      expect(payload.providerStatus?.footyStats.status).toBe('AUTH_FAILED');
      expect(payload.providerStatus?.footyStats.liveIngestion).toBe('BLOCKED');
      expect(payload.providerStatus?.oddsPapi.status).toBe('QUOTA_BLOCKED');
      expect(payload.providerStatus?.oddsPapi.liveIngestion).toBe('BLOCKED');

      // Verify missing data reasons
      expect(payload.missingDataReasons).toBeDefined();
      expect(payload.missingDataReasons!.length).toBeGreaterThan(0);

      // Verify counts
      expect(payload.counts.upcomingFixtures).toBe(payload.upcomingFixtures!.length);
      expect(payload.counts.verifiedResults).toBe(payload.verifiedResults!.length);
    });

    it('supports pagination on dailyPicks feed', () => {
      const nowMs = new Date('2026-10-18T12:00:00Z').getTime();

      // Seed 2 predictions
      CanonicalBetLedgerService.recordPrediction({
        canonicalFixtureId: 'cm_page_01',
        fixture: 'Team 1 vs Team 2',
        competition: 'Premier League',
        league: 'Premier League',
        homeTeam: 'Team 1',
        awayTeam: 'Team 2',
        kickoffTimestamp: '2026-10-19T15:00:00Z',
        market: 'AH',
        selection: 'HOME',
        line: -0.25,
        provider: 'OddsPapi',
        bookmaker: 'Pinnacle',
        marketOdds: 1.95,
        oddsTimestamp: '2026-10-18T10:00:00Z',
        modelProbability: 0.55,
        fairOdds: 1.818,
        expectedValue: 0.072,
        edge: 0.035,
        confidence: 'HIGH',
        confidenceScore: 82,
        valueStatus: 'VALUE',
        predictionTimestamp: '2026-10-18T10:00:00Z',
        featureTimestamp: '2026-10-18T09:00:00Z',
        modelVersion: 'dixon-coles-v1.0',
        pipelineVersion: 'v1.0',
        dataVersion: 'v1.0',
      });

      CanonicalBetLedgerService.recordPrediction({
        canonicalFixtureId: 'cm_page_02',
        fixture: 'Team 3 vs Team 4',
        competition: 'Premier League',
        league: 'Premier League',
        homeTeam: 'Team 3',
        awayTeam: 'Team 4',
        kickoffTimestamp: '2026-10-19T18:00:00Z',
        market: 'OU',
        selection: 'OVER',
        line: 2.5,
        provider: 'OddsPapi',
        bookmaker: 'Pinnacle',
        marketOdds: 1.90,
        oddsTimestamp: '2026-10-18T10:00:00Z',
        modelProbability: 0.58,
        fairOdds: 1.724,
        expectedValue: 0.10,
        edge: 0.05,
        confidence: 'HIGH',
        confidenceScore: 85,
        valueStatus: 'VALUE',
        predictionTimestamp: '2026-10-18T10:00:00Z',
        featureTimestamp: '2026-10-18T09:00:00Z',
        modelVersion: 'dixon-coles-v1.0',
        pipelineVersion: 'v1.0',
        dataVersion: 'v1.0',
      });

      const page1 = SalmoProductionSyncService.generateSyncPayload({
        nowMs,
        page: 1,
        limit: 1,
      });

      expect(page1.dailyPicks.length).toBe(1);
      expect(page1.pagination).toBeDefined();
      expect(page1.pagination?.page).toBe(1);
      expect(page1.pagination?.limit).toBe(1);
      expect(page1.pagination?.total).toBe(2);
      expect(page1.pagination?.totalPages).toBe(2);

      const page2 = SalmoProductionSyncService.generateSyncPayload({
        nowMs,
        page: 2,
        limit: 1,
      });

      expect(page2.dailyPicks.length).toBe(1);
      expect(page2.pagination?.page).toBe(2);
      expect(page2.dailyPicks[0].predictionId).not.toBe(page1.dailyPicks[0].predictionId);
    });
  });
});
