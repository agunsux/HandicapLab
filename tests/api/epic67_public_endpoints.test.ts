import { describe, it, expect } from 'vitest';
import { GET as getUpcoming } from '@/app/api/public/fixtures/upcoming/route';
import { GET as getHistoricalSummary } from '@/app/api/public/historical/summary/route';
import { GET as getMarketDiscovery } from '@/app/api/public/research/market-discovery/route';

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
      const req = new Request('http://localhost/api/public/fixtures/upcoming?window=7days&league=ENG-PL&limit=10');
      const res = await getUpcoming(req as any);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json).toBeDefined();
      for (const f of json.fixtures) {
        expect(f.leagueCode).toBe('ENG-PL');
      }
    });
  });

  describe('GET /api/public/historical/summary', () => {
    it('should return 200 with real dataset metrics', async () => {
      const res = await getHistoricalSummary();
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.completedMatches).toBeGreaterThanOrEqual(17000);
      expect(json.leaguesCount).toBeGreaterThanOrEqual(30);
      expect(json.pinnacleOddsRecords).toBeGreaterThanOrEqual(100000);
      expect(json.pinnacleCoveragePct).toBe(100);
    });
  });

  describe('GET /api/public/research/market-discovery', () => {
    it('should return 200 with market discovery rankings', async () => {
      const req = new Request('http://localhost/api/public/research/market-discovery?market=AH&tier=GOLD');
      const res = await getMarketDiscovery(req as any);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.count).toBeGreaterThan(0);
      expect(Array.isArray(json.rankings)).toBe(true);
      for (const r of json.rankings) {
        expect(r.market).toBe('AH');
        expect(r.tier).toBe('GOLD');
      }
    });

    it('should return summary format when requested', async () => {
      const req = new Request('http://localhost/api/public/research/market-discovery?format=summary');
      const res = await getMarketDiscovery(req as any);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.version).toBe('epic66-v1.0');
      expect(json.asianHandicap).toBeDefined();
      expect(json.overUnder).toBeDefined();
      expect(json.btts).toBeDefined();
    });
  });
});
