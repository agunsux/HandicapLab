import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { FreeResultsAdapter, NormalizedMatchResult } from '@/lib/results/freeResultsAdapter';
import { settleAsianHandicap } from '@/lib/engine/settlement';
import { CLVCalculator } from '@/lib/settlement/clv-calculator';

// Protected benchmark hashes
const PROTECTED_BENCHMARK_HASHES = {
  handicapLabLedger: 'F610A1CD6C2BFE01F224BBC10D950EB306E774261B5F72E15D424C4AA3BB5377',
  salmoLedger: '317FC037A63B811420400EA9DE094092EC7D68B119AD6ABC57743BE12D568527',
  salmoResearchLedger: 'EAE8F364A5393255D276FCA2650056951FB601BA829C1710B26AC673DFFB967B',
  salmoMultiLeague: '0128616A43968BE5FDDAB76EA5C57DA731955E22B1BF27BCA3F886938187A12F',
};

describe('EPIC 89: Free Football Results Provider & Automated Settlement Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Free Results Adapter - CSV Parsing & Normalization', () => {
    it('parses CSV dates correctly from dd/mm/yyyy and dd/mm/yy to ISO YYYY-MM-DD', () => {
      expect(FreeResultsAdapter.parseCsvDate('21/08/2026')).toBe('2026-08-21');
      expect(FreeResultsAdapter.parseCsvDate('05/01/26')).toBe('2026-01-05');
      expect(FreeResultsAdapter.parseCsvDate('19/10/2026')).toBe('2026-10-19');
      expect(FreeResultsAdapter.parseCsvDate('invalid')).toBe('invalid');
    });

    it('generates correct 4-digit season codes', () => {
      expect(FreeResultsAdapter.getSeasonCode(2026)).toBe('2627');
      expect(FreeResultsAdapter.getSeasonCode(2025)).toBe('2526');
      expect(FreeResultsAdapter.getSeasonCode(2024)).toBe('2425');
    });

    it('normalizes team names with canonical alias resolution', () => {
      // EPL teams with abbreviations / aliases
      expect(FreeResultsAdapter.normalizeTeamName('Nott\'m Forest')).toBe('nottinghamforest');
      expect(FreeResultsAdapter.normalizeTeamName('Nottingham Forest')).toBe('nottinghamforest');
      expect(FreeResultsAdapter.normalizeTeamName('Man United')).toBe('manchesterunited');
      expect(FreeResultsAdapter.normalizeTeamName('Manchester United')).toBe('manchesterunited');
      expect(FreeResultsAdapter.normalizeTeamName('Man City')).toBe('manchestercity');
      expect(FreeResultsAdapter.normalizeTeamName('Manchester City')).toBe('manchestercity');
      expect(FreeResultsAdapter.normalizeTeamName('Wolves')).toBe('wolves');
      expect(FreeResultsAdapter.normalizeTeamName('Wolverhampton')).toBe('wolves');
      expect(FreeResultsAdapter.normalizeTeamName('Tottenham Hotspur')).toBe('tottenham');
      expect(FreeResultsAdapter.normalizeTeamName('Spurs')).toBe('tottenham');
      expect(FreeResultsAdapter.normalizeTeamName('AFC Bournemouth')).toBe('bournemouth');
      expect(FreeResultsAdapter.normalizeTeamName('Bournemouth')).toBe('bournemouth');
      expect(FreeResultsAdapter.normalizeTeamName('Arsenal FC')).toBe('arsenal');
      expect(FreeResultsAdapter.normalizeTeamName('Arsenal')).toBe('arsenal');
    });

    it('translates normalized results to API-Football compatible schema', () => {
      const mockResults: NormalizedMatchResult[] = [
        {
          provider: 'football-data.co.uk',
          division: 'E0',
          league: 'Premier League',
          kickoffDate: '2026-10-19',
          kickoffTime: '20:00',
          homeTeam: 'Arsenal',
          awayTeam: 'Leeds',
          canonicalHomeId: 'arsenal',
          canonicalAwayId: 'leeds',
          homeGoals: 2,
          awayGoals: 1,
          htHomeGoals: 1,
          htAwayGoals: 0,
          status: 'FINISHED',
          sourceStatus: 'FT',
          retrievedAt: new Date().toISOString(),
        },
      ];

      const fixtures = FreeResultsAdapter.toApiFootballFixtures(mockResults, 39);
      expect(fixtures).toHaveLength(1);
      const f = fixtures[0];
      expect(f.fixture.id).toContain('fd_E0_2026-10-19');
      expect(f.fixture.date).toBe('2026-10-19T20:00:00Z');
      expect(f.fixture.status.short).toBe('FT');
      expect(f.fixture.status.elapsed).toBe(90);
      expect(f.league.id).toBe(39);
      expect(f.teams.home.name).toBe('Arsenal');
      expect(f.teams.away.name).toBe('Leeds');
      expect(f.goals.home).toBe(2);
      expect(f.goals.away).toBe(1);
      expect(f.score.fulltime.home).toBe(2);
      expect(f.score.fulltime.away).toBe(1);
      expect(f.score.halftime.home).toBe(1);
      expect(f.score.halftime.away).toBe(0);
    });

    it('matches results deterministically within date tolerance window', () => {
      const mockResults: NormalizedMatchResult[] = [
        {
          provider: 'football-data.co.uk',
          division: 'E0',
          league: 'Premier League',
          kickoffDate: '2026-10-18',
          homeTeam: 'Arsenal',
          awayTeam: 'Leeds',
          canonicalHomeId: 'arsenal',
          canonicalAwayId: 'leeds',
          homeGoals: 2,
          awayGoals: 1,
          htHomeGoals: null,
          htAwayGoals: null,
          status: 'FINISHED',
          sourceStatus: 'FT',
          retrievedAt: new Date().toISOString(),
        },
      ];

      // Exact match
      const m1 = FreeResultsAdapter.matchResult(mockResults, 'Arsenal', 'Leeds', '2026-10-18T15:00:00Z');
      expect(m1).not.toBeNull();
      expect(m1?.homeGoals).toBe(2);
      expect(m1?.awayGoals).toBe(1);

      // Within 2-day tolerance (e.g. signal date 2026-10-19, played 2026-10-18)
      const m2 = FreeResultsAdapter.matchResult(mockResults, 'Arsenal FC', 'Leeds United', '2026-10-19T20:00:00Z');
      expect(m2).not.toBeNull();

      // Outside tolerance (> 2 days)
      const m3 = FreeResultsAdapter.matchResult(mockResults, 'Arsenal', 'Leeds', '2026-10-25T15:00:00Z');
      expect(m3).toBeNull();
    });
  });

  describe('2. Settlement Mathematical Precision & Quarter-Line Outcomes', () => {
    it('settles Asian Handicap full win (+0.5 on win or draw)', () => {
      // Crystal Palace +0.5 vs Forest, score 3-1 -> home wins
      const res = settleAsianHandicap(3, 1, 0.5, 'home', 1.95);
      expect(res.status).toBe('WON');
      expect(res.profit_units).toBeCloseTo(0.95, 4);
    });

    it('settles Asian Handicap quarter-line half-win (+0.25 on draw)', () => {
      // Home +0.25, score 1-1 (draw)
      // dAdj = (1 - 1) + 0.25 = +0.25 -> HALF WIN
      const res = settleAsianHandicap(1, 1, 0.25, 'home', 2.00);
      expect(res.status).toBe('HALF_WIN');
      expect(res.profit_units).toBeCloseTo(0.50, 4);
    });

    it('settles Asian Handicap quarter-line half-loss (-0.25 on draw)', () => {
      // Home -0.25, score 1-1 (draw)
      // dAdj = (1 - 1) - 0.25 = -0.25 -> HALF LOSS
      const res = settleAsianHandicap(1, 1, -0.25, 'home', 1.90);
      expect(res.status).toBe('HALF_LOSS');
      expect(res.profit_units).toBeCloseTo(-0.50, 4);
    });

    it('settles Asian Handicap push (AH 0 on draw)', () => {
      // Home AH 0, score 1-1 -> PUSH
      const res = settleAsianHandicap(1, 1, 0, 'home', 1.92);
      expect(res.status).toBe('PUSH');
      expect(res.profit_units).toBe(0.0);
    });

    it('calculates CLV accurately with benchmark bookmaker Pinnacle', () => {
      const clv = CLVCalculator.calculateDetailed(
        'AH',
        'home',
        -0.5,
        1.95, // Opening odds
        -0.5,
        1.85  // Closing odds beat the line
      );
      expect(clv.clv_score).toBeGreaterThan(0);
      expect(clv.clv_category).toBe('Positive');
      expect(clv.price_clv).toBeGreaterThan(0);
    });
  });

  describe('3. Governed Fallback & Zero OddsPapi Consumption', () => {
    it('verifies FreeResultsAdapter never imports or calls OddsPapi', async () => {
      const code = fs.readFileSync(
        path.resolve(process.cwd(), 'src/lib/results/freeResultsAdapter.ts'),
        'utf8'
      );
      expect(code).not.toContain('oddspapi');
      expect(code).not.toContain('oddsPapiClient');
      expect(code).not.toContain('ODDSPAPI_KEY');
      expect(code).not.toContain('QuotaGuard');
    });

    it('verifies cron/settle never calls OddsPapi for results or scores', async () => {
      const code = fs.readFileSync(
        path.resolve(process.cwd(), 'src/app/api/cron/settle/route.ts'),
        'utf8'
      );
      expect(code).not.toContain('oddspapi');
      expect(code).not.toContain('oddsPapiClient');
    });

    it('verifies ResultProvider falls back to FreeResultsAdapter on api-football failure', async () => {
      const { resultProvider } = await import('@/lib/apis/results');
      const { apiFootballClient } = await import('@/lib/apis/apifootball');

      // Mock apiFootballClient to reject (simulating account suspension or network outage)
      vi.spyOn(apiFootballClient, 'getFixtures').mockRejectedValueOnce(
        new Error('Account suspended: Free tier quota exceeded')
      );

      // Mock FreeResultsAdapter.getResultsForLeague to return verified results
      vi.spyOn(FreeResultsAdapter, 'getResultsForLeague').mockResolvedValueOnce([
        {
          provider: 'football-data.co.uk',
          division: 'E0',
          league: 'Premier League',
          kickoffDate: '2026-10-19',
          kickoffTime: '20:00',
          homeTeam: 'Arsenal',
          awayTeam: 'Leeds',
          canonicalHomeId: 'arsenal',
          canonicalAwayId: 'leeds',
          homeGoals: 2,
          awayGoals: 1,
          htHomeGoals: 1,
          htAwayGoals: 0,
          status: 'FINISHED',
          sourceStatus: 'FT',
          retrievedAt: new Date().toISOString(),
        },
      ]);

      const results = await resultProvider.getResults(39, 2026);
      expect(results).toHaveLength(1);
      expect(results[0].homeTeam).toBe('Arsenal');
      expect(results[0].homeGoals).toBe(2);
      expect(results[0].awayGoals).toBe(1);
      expect(results[0].status).toBe('FT');
    });
  });

  describe('4. Protected Benchmark Ledger Immutability', () => {
    function computeSha256(filePath: string): string {
      const fileBuffer = fs.readFileSync(filePath);
      return crypto.createHash('sha256').update(fileBuffer).digest('hex').toUpperCase();
    }

    it('HandicapLab live_prediction_ledger.jsonl remains byte-identical', () => {
      const p = path.resolve(process.cwd(), 'data/verification/live_prediction_ledger.jsonl');
      expect(fs.existsSync(p)).toBe(true);
      const hash = computeSha256(p);
      expect(hash).toBe(PROTECTED_BENCHMARK_HASHES.handicapLabLedger);
    });

    it('SALMO live_prediction_ledger.jsonl remains byte-identical', () => {
      const p = path.resolve(process.cwd(), '../SALMO/data/verification/live_prediction_ledger.jsonl');
      expect(fs.existsSync(p)).toBe(true);
      const hash = computeSha256(p);
      expect(hash).toBe(PROTECTED_BENCHMARK_HASHES.salmoLedger);
    });

    it('SALMO all_leagues_research_ledger.jsonl remains byte-identical', () => {
      const p = path.resolve(process.cwd(), '../SALMO/data/verification/all_leagues_research_ledger.jsonl');
      expect(fs.existsSync(p)).toBe(true);
      const hash = computeSha256(p);
      expect(hash).toBe(PROTECTED_BENCHMARK_HASHES.salmoResearchLedger);
    });

    it('SALMO multi_league_research_predictions.jsonl remains byte-identical', () => {
      const p = path.resolve(process.cwd(), '../SALMO/data/research/multi_league_research_predictions.jsonl');
      expect(fs.existsSync(p)).toBe(true);
      const hash = computeSha256(p);
      expect(hash).toBe(PROTECTED_BENCHMARK_HASHES.salmoMultiLeague);
    });
  });

  describe('5. SALMO Production Sync Surface & Idempotency', () => {
    it('surfaces verified results in generateSyncPayloadAsync', async () => {
      const { SalmoProductionSyncService } = await import('@/lib/salmo/salmoProductionSyncService');
      const payload = await SalmoProductionSyncService.generateSyncPayloadAsync({
        nowMs: Date.now(),
        view: 'all',
      });

      expect(payload).toBeDefined();
      expect(payload.success).toBe(true);
      expect(payload.syncChecksum).toBeDefined();
      expect(typeof payload.syncChecksum).toBe('string');
      expect(Array.isArray(payload.verifiedResults)).toBe(true);
      expect(Array.isArray(payload.settledHistory)).toBe(true);
    });

    it('is strictly idempotent on successive calls', async () => {
      const { SalmoProductionSyncService } = await import('@/lib/salmo/salmoProductionSyncService');
      const fixedNow = 1792600000000;
      const p1 = await SalmoProductionSyncService.generateSyncPayloadAsync({ nowMs: fixedNow });
      const p2 = await SalmoProductionSyncService.generateSyncPayloadAsync({ nowMs: fixedNow });

      expect(p1.counts.totalArchived).toBe(p2.counts.totalArchived);
      expect(p1.counts.dailyPicks).toBe(p2.counts.dailyPicks);
      expect(p1.counts.settled).toBe(p2.counts.settled);
      expect(p1.dataState).toBe(p2.dataState);
    });
  });
});
