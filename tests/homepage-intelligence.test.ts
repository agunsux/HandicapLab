import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { runWalkForwardBacktest } from '@/lib/homepage/backtest/engine';
import { BacktestRepository } from '@/lib/homepage/backtest/repository';
import {
  OpportunitiesService,
  getDynamicSeason,
} from '@/lib/homepage/opportunities/service';
import { HomepageService } from '@/lib/homepage/service';
import { HOMEPAGE_INTELLIGENCE } from '@/lib/homepage/constants';

describe('Homepage Intelligence Layer', () => {
  describe('Dynamic Season Resolution', () => {
    it('correctly resolves European season dynamically without hardcoded limits', () => {
      // August 2026 -> 2026 season
      const aug2026 = new Date('2026-08-15T14:00:00Z');
      expect(getDynamicSeason(aug2026)).toBe(2026);

      // January 2026 -> 2025 season
      const jan2026 = new Date('2026-01-10T14:00:00Z');
      expect(getDynamicSeason(jan2026)).toBe(2025);

      // July 2025 -> 2025 season
      const jul2025 = new Date('2025-07-01T00:00:00Z');
      expect(getDynamicSeason(jul2025)).toBe(2025);

      // May 2025 -> 2024 season
      const may2025 = new Date('2025-05-15T19:00:00Z');
      expect(getDynamicSeason(may2025)).toBe(2024);
    });
  });

  describe('Historical Walk-Forward Engine Math & Invariants', () => {
    it('executes backtest on matches and produces verified mathematical metrics', () => {
      const mockMatches = [
        {
          id: 'm1',
          competition: 'Premier League',
          kickoff: '2023-08-12T14:00:00Z',
          homeTeam: 'Arsenal',
          awayTeam: 'Nottm Forest',
          homeScore: 2,
          awayScore: 1,
          season: '2023',
        },
        {
          id: 'm2',
          competition: 'Premier League',
          kickoff: '2023-08-12T16:30:00Z',
          homeTeam: 'Newcastle',
          awayTeam: 'Aston Villa',
          homeScore: 5,
          awayScore: 1,
          season: '2023',
        },
        {
          id: 'm3',
          competition: 'Premier League',
          kickoff: '2023-08-13T13:00:00Z',
          homeTeam: 'Brentford',
          awayTeam: 'Tottenham',
          homeScore: 2,
          awayScore: 2,
          season: '2023',
        },
      ];

      const mockOdds = [
        {
          matchId: 'm1',
          market: '1X2',
          observation: 'CLOSING',
          home_odds: 2.40,
          draw_odds: 3.50,
          away_odds: 3.20,
          bookmaker: 'pinnacle',
        },
      ];

      const result = runWalkForwardBacktest(mockMatches as any, mockOdds as any, 'test-hash');

      expect(result.status).toBe('COMPLETE');
      expect(result.datasetVersion).toBe(HOMEPAGE_INTELLIGENCE.datasetVersion);
      expect(result.modelVersion).toBe(HOMEPAGE_INTELLIGENCE.modelVersion);
      expect(result.matchesTested).toBe(3);
      expect(result.methodology).toBe('walk-forward-expanding-window');
      expect(Array.isArray(result.calibration)).toBe(true);
    });

    it('handles snake_case database records seamlessly', () => {
      const snakeMatches = [
        {
          id: 'm1',
          competition: 'La Liga',
          kickoff: '2023-08-12T19:30:00Z',
          home_team: 'Real Madrid',
          away_team: 'Athletic Club',
          home_score: 2,
          away_score: 0,
          season: '2023',
        },
      ];

      const snakeOdds = [
        {
          match_id: 'm1',
          market: 'MONEYLINE',
          selection: 'HOME',
          odds: 1.95,
          closing_odds: 1.90,
          bookmaker: 'pinnacle',
        },
      ];

      const result = runWalkForwardBacktest(snakeMatches as any, snakeOdds as any, 'snake-hash');
      expect(result.status).toBe('COMPLETE');
      expect(result.matchesTested).toBe(1);
    });
  });

  describe('Backtest Repository & Persisted Results', () => {
    it('retrieves the completed backtest run with 8,898 matches tested', async () => {
      const latest = await BacktestRepository.getLatestRun();
      expect(latest).not.toBeNull();
      expect(latest?.status).toBe('COMPLETE');
      expect(latest?.datasetVersion).toBe('europe-dataset-v1');
      expect(latest?.matchesTested).toBe(8898);
      expect(latest?.totalBets).toBe(8455);
      expect(latest?.markets.length).toBe(3); // ML, AH, OU
    });

    it('returns valid status object from getStatus()', async () => {
      const status = await BacktestRepository.getStatus();
      expect(status.status).toBe('COMPLETE');
      expect(status.datasetVersion).toBe('europe-dataset-v1');
      expect(status.matchesInDataset).toBe(8898);
      expect(status.totalBets).toBe(8455);
    });
  });

  describe('Live Opportunities & Fixture Registry', () => {
    it('returns a structured OpportunitiesResponse with fail-closed guarantees', async () => {
      const opps = await OpportunitiesService.getOpportunities();
      expect(opps).toBeDefined();
      expect(opps.generatedAt).toBeDefined();
      expect(['READY', 'NO_FIXTURES', 'NO_ODDS', 'NOT_MODELABLE', 'NO_VALUE', 'DATABASE_ERROR']).toContain(opps.state);
      expect(opps.fixtures).toBeDefined();
      expect(Array.isArray(opps.opportunities)).toBe(true);
      expect(Array.isArray(opps.upcomingFixtures)).toBe(true);

      // Verify no synthetic fixture or fake numbers
      for (const opp of opps.opportunities) {
        expect(typeof opp.ev).toBe('number');
        expect(typeof opp.edge).toBe('number');
        expect(typeof opp.odds).toBe('number');
        expect(opp.odds).toBeGreaterThan(1.0);
        expect(opp.fairOdds).toBeGreaterThan(1.0);
        expect(opp.modelProbability).toBeGreaterThanOrEqual(0);
        expect(opp.modelProbability).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Aggregate Homepage Service', () => {
    it('returns combined historical and live intelligence payload', async () => {
      const homepage = await HomepageService.getHomepageData();
      expect(homepage).toBeDefined();
      expect(homepage.generatedAt).toBeDefined();

      // Historical section
      expect(homepage.historical.status).toBe('COMPLETE');
      expect(homepage.historical.datasetVersion).toBe('europe-dataset-v1');
      expect(homepage.historical.summary).not.toBeNull();
      expect(homepage.historical.summary?.matches).toBe(8898);
      expect(homepage.historical.summary?.bets).toBe(8455);
      expect(homepage.historical.markets.length).toBe(3);

      // Live section
      expect(homepage.live).toBeDefined();
      expect(Array.isArray(homepage.live.opportunities)).toBe(true);
    });
  });
});
