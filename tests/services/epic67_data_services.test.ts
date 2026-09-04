import { describe, it, expect } from 'vitest';
import { UpcomingFixturesService } from '@/lib/services/upcomingFixturesService';
import { HistoricalDataService } from '@/lib/services/historicalDataService';
import { MarketIntelligenceService } from '@/lib/services/marketIntelligenceService';

describe('EPIC-67: Data Services Unit Tests', () => {
  describe('UpcomingFixturesService', () => {
    it('should return fixtures from cache or provider without throwing', async () => {
      const result = await UpcomingFixturesService.getUpcomingFixtures({ daysAhead: 3, limit: 10 });
      expect(result).toBeDefined();
      expect(result.source).toBe('api-football');
      expect(Array.isArray(result.fixtures)).toBe(true);
      expect(typeof result.coverage.leagues).toBe('number');
      expect(typeof result.coverage.fixtures).toBe('number');

      if (result.fixtures.length > 0) {
        const first = result.fixtures[0];
        expect(first.homeTeam).toBeDefined();
        expect(first.awayTeam).toBeDefined();
        expect(first.kickoff).toBeDefined();
        expect(first.markets).toBeDefined();
        expect(first.markets.asianHandicap.available).toBe(true);
        expect(first.markets.overUnder.available).toBe(true);
        expect(first.markets.btts.available).toBe(true);
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
    it('should return real aggregate metrics without synthetic numbers', () => {
      const summary = HistoricalDataService.getHistoricalSummary();
      expect(summary.completedMatches).toBeGreaterThanOrEqual(17000);
      expect(summary.leaguesCount).toBeGreaterThanOrEqual(30);
      expect(summary.pinnacleOddsRecords).toBeGreaterThanOrEqual(100000);
      expect(summary.pinnacleCoveragePct).toBe(100);
      expect(summary.marketCoverage.asianHandicap.available).toBe(true);
      expect(summary.marketCoverage.asianHandicap.linesEvaluated).toBe(17);
      expect(summary.marketCoverage.btts.available).toBe(true);
      expect(summary.marketCoverage.btts.leaguesEvaluated).toBe(30);
      expect(summary.regionalBreakdown.europe.matches).toBeGreaterThan(0);
      expect(summary.regionalBreakdown.americas.matches).toBeGreaterThan(0);
      expect(summary.regionalBreakdown.asia.matches).toBeGreaterThan(0);
    });
  });

  describe('MarketIntelligenceService', () => {
    it('should load EPIC-66 discovery rankings correctly', () => {
      const summary = MarketIntelligenceService.getIntelligenceSummary();
      expect(summary.totalEvaluated).toBeGreaterThan(0);
      expect(summary.version).toBe('epic66-v1.0');
      expect(summary.topRankings.length).toBeGreaterThan(0);

      // Verify AH best line is present
      const ahItems = MarketIntelligenceService.getMarketDiscovery({ market: 'AH', tier: 'GOLD' });
      expect(ahItems.length).toBeGreaterThan(0);
      const ah025 = ahItems.find((i) => i.identifier === 'AH +0.25 Away');
      expect(ah025).toBeDefined();
      if (ah025) {
        expect(ah025.roiPct).toBeGreaterThan(20);
        expect(ah025.bets).toBeGreaterThanOrEqual(1000);
        expect(ah025.tier).toBe('GOLD');
      }
    });

    it('should return correct high scoring and BTTS league facts', () => {
      const summary = MarketIntelligenceService.getIntelligenceSummary();
      expect(summary.overUnder.highScoringLeagues.length).toBeGreaterThan(0);
      expect(summary.btts.topLeagues.length).toBeGreaterThan(0);
      expect(summary.btts.topLeagues[0].ratePct).toBeGreaterThan(60);
    });
  });
});
