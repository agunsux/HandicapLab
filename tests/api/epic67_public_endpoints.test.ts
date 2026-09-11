import { describe, it, expect, vi, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

import { GET as getUpcoming } from '@/app/api/public/fixtures/upcoming/route';
import { GET as getHistoricalSummary } from '@/app/api/public/historical/summary/route';
import { GET as getMarketDiscovery } from '@/app/api/public/research/market-discovery/route';

// Deterministic provider stub: one upcoming ENG-PL fixture. No network calls.
vi.mock('@/lib/apis/apifootball', () => {
  const kickoff = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  return {
    apiFootballClient: {
      getFixturesRange: vi.fn().mockResolvedValue({
        response: [
          {
            fixture: {
              id: 999002,
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

afterAll(() => {
  try {
    const cacheFile = path.resolve('data/cache/upcoming_fixtures.json');
    if (fs.existsSync(cacheFile)) fs.unlinkSync(cacheFile);
  } catch {
    // best-effort cleanup
  }
});

describe('EPIC-67: Public API Endpoints Integration Tests', () => {
  describe('GET /api/public/fixtures/upcoming', () => {
    it('should return 200 with public fixture payload', async () => {
      const req = new Request('http://localhost/api/public/fixtures/upcoming?window=today&limit=5');
      const res = await getUpcoming(req as any);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json).toBeDefined();
      expect(json.source).toBe('api-football');
      expect(Array.isArray(json.fixtures)).toBe(true);
      expect(json.fixtures.length).toBeLessThanOrEqual(5);
      expect(json.coverage).toBeDefined();
    });

    it('should support 7days window and league filtering', async () => {
      const req = new Request(
        'http://localhost/api/public/fixtures/upcoming?window=7days&league=ENG-PL&limit=10'
      );
      const res = await getUpcoming(req as any);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json).toBeDefined();
      for (const f of json.fixtures) {
        expect(f.leagueCode).toBe('ENG-PL');
        // No market is advertised as available without real odds.
        expect(f.markets.asianHandicap.available).toBe(false);
      }
    });
  });

  describe('GET /api/public/historical/summary', () => {
    it('should return 200 with real persisted-artifact metrics (no fabricated coverage)', async () => {
      const res = await getHistoricalSummary();
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.completedMatches === null || typeof json.completedMatches === 'number').toBe(true);
      expect(json.leaguesCount === null || typeof json.leaguesCount === 'number').toBe(true);

      // The old hardcoded claim (110,394 Pinnacle rows / 100% coverage) must
      // not be served. The coverage artifact reports only a handful of rows.
      expect(json.pinnacleCoveragePct).not.toBe(100);
      expect(json.marketCoverage.asianHandicap.bestStrategyRoiPct).toBeNull();

      // Real walk-forward evidence must be present.
      expect(json.backtest).not.toBeNull();
      expect(typeof json.backtest.totalBets).toBe('number');
    });
  });

  describe('GET /api/public/research/market-discovery', () => {
    it('serves only verified walk-forward rows (no quarantined EPIC-66 GOLD claims)', async () => {
      const req = new Request('http://localhost/api/public/research/market-discovery?market=AH');
      const res = await getMarketDiscovery(req as any);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.count).toBeGreaterThan(0);
      expect(Array.isArray(json.rankings)).toBe(true);
      for (const r of json.rankings) {
        expect(r.market).toBe('AH');
        // Market-level CI is not available, so rows are inconclusive (GREY).
        expect(r.tier).toBe('GREY');
      }

      const goldReq = new Request(
        'http://localhost/api/public/research/market-discovery?market=AH&tier=GOLD'
      );
      const goldRes = await getMarketDiscovery(goldReq as any);
      const goldJson = await goldRes.json();
      expect(goldJson.count).toBe(0);
    });

    it('should return summary format when requested', async () => {
      const req = new Request('http://localhost/api/public/research/market-discovery?format=summary');
      const res = await getMarketDiscovery(req as any);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.version).toBe('walkforward-v1');
      expect(json.discoveryStatus).toBe('QUARANTINED_PENDING_AUDIT');
      expect(json.asianHandicap).toBeDefined();
      expect(json.overUnder).toBeDefined();
      expect(json.btts).toBeDefined();
    });
  });
});
