import { describe, it, expect, vi, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

import { UpcomingFixturesService } from '@/lib/services/upcomingFixturesService';
import { HistoricalDataService } from '@/lib/services/historicalDataService';
import { MarketIntelligenceService } from '@/lib/services/marketIntelligenceService';

// Deterministic provider stub: one upcoming ENG-PL fixture. No network calls.
vi.mock('@/lib/apis/apifootball', () => {
  const kickoff = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  return {
    apiFootballClient: {
      getFixturesRange: vi.fn().mockResolvedValue({
        response: [
          {
            fixture: {
              id: 999001,
              date: kickoff,
              status: { short: 'NS' },
              venue: { name: 'Test Stadium', city: 'London' },
            },
            league: { id: 39, name: 'Premier League', logo: '' },
            teams: {
              home: { id: 1, name: 'Home FC', logo: '' },
              away: { id: 2, name: 'Away FC', logo: '' },
            },
          },
        ],
      }),
    },
  };
});

const DATA_STATES = [
  'REAL',
  'CACHED',
  'STALE',
  'INSUFFICIENT_DATA',
  'DATA_UNAVAILABLE',
  'DATA_UPDATE_PAUSED',
];

afterAll(() => {
  try {
    const cacheFile = path.resolve('data/cache/upcoming_fixtures.json');
    if (fs.existsSync(cacheFile)) fs.unlinkSync(cacheFile);
  } catch {
    // best-effort cleanup
  }
});

describe('Data Services — real-data-only contracts', () => {
  describe('UpcomingFixturesService', () => {
    it('never advertises market availability without real odds', async () => {
      const result = await UpcomingFixturesService.getUpcomingFixtures({
        daysAhead: 3,
        limit: 10,
        forceRefresh: true,
      });
      expect(result).toBeDefined();
      expect(result.source).toBe('api-football');
      expect(Array.isArray(result.fixtures)).toBe(true);
      expect(DATA_STATES).toContain(result.dataState);

      for (const f of result.fixtures) {
        expect(f.markets.asianHandicap.available).toBe(false);
        expect(f.markets.overUnder.available).toBe(false);
        expect(f.markets.btts.available).toBe(false);
      }
    });

    it('should filter fixtures by league code when requested', async () => {
      const plResult = await UpcomingFixturesService.getUpcomingFixtures({
        daysAhead: 7,
        leagueCode: 'ENG-PL',
      });
      expect(plResult).toBeDefined();
      for (const f of plResult.fixtures) {
        expect(f.leagueCode).toBe('ENG-PL');
      }
    });

    it('should respect the limit parameter', async () => {
      const limited = await UpcomingFixturesService.getUpcomingFixtures({ daysAhead: 7, limit: 5 });
      expect(limited.fixtures.length).toBeLessThanOrEqual(5);
    });
  });

  describe('HistoricalDataService', () => {
    it('returns persisted-artifact metrics with honest nulls (no fabricated fallbacks)', () => {
      const summary = HistoricalDataService.getHistoricalSummary();

      // The persisted walk-forward artifact exists in the repo and must load.
      expect(summary.backtest).not.toBeNull();
      expect(summary.backtest!.totalBets).toBeGreaterThan(0);
      expect(summary.backtest!.roiPct).not.toBeNull();

      // The old hardcoded fabrication (110,394 Pinnacle rows / 100% coverage /
      // +77.96% best strategy) must never appear.
      expect(summary.marketCoverage.asianHandicap.bestStrategyRoiPct).toBeNull();
      expect(summary.pinnacleCoveragePct).not.toBe(100);

      expect(DATA_STATES).toContain(summary.dataState);
    });
  });

  describe('MarketIntelligenceService', () => {
    it('serves only walk-forward evidence and quarantines EPIC-66 rankings', () => {
      const summary = MarketIntelligenceService.getIntelligenceSummary();

      expect(summary.discoveryStatus).toBe('QUARANTINED_PENDING_AUDIT');
      expect(summary.version).toBe('walkforward-v1');
      expect(summary.topRankings.length).toBeGreaterThan(0);

      // Nothing from the quarantined discovery is promoted.
      expect(summary.asianHandicap.promotedLines).toHaveLength(0);
      expect(summary.overUnder.highScoringLeagues).toHaveLength(0);
      expect(summary.btts.topLeagues).toHaveLength(0);

      // Real backtest rows are marked inconclusive (no market-level CI).
      const ah = summary.topRankings.find((r) => r.market === 'AH');
      if (ah) expect(ah.tier).toBe('GREY');
    });
  });
});
