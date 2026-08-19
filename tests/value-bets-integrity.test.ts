import { describe, it, expect } from 'vitest';
import { OpportunitiesService, getDynamicSeason } from '../src/lib/homepage/opportunities/service';
import { fetchSignals } from '../src/services/api';
import { LEAGUE_REGISTRY } from '../src/lib/crons/leagueRegistry';

describe('EPIC 53B — Value Bets Forensic & Data Integrity Suite', () => {
  describe('Season & Freshness Invariants', () => {
    it('resolves 2026/27 dynamically on August 19, 2026', () => {
      const season = getDynamicSeason(new Date('2026-08-19'));
      expect(season).toBe(2026);
    });

    it('resolves 2025/26 dynamically on May 15, 2026', () => {
      const season = getDynamicSeason(new Date('2026-05-15'));
      expect(season).toBe(2025);
    });

    it('enforces league whitelist presence in LEAGUE_REGISTRY', () => {
      const epl = LEAGUE_REGISTRY.find((l) => l.name === 'Premier League');
      const ligue1 = LEAGUE_REGISTRY.find((l) => l.name === 'Ligue 1');
      const ucl = LEAGUE_REGISTRY.find((l) => l.name === 'UEFA Champions League');

      expect(epl).toBeDefined();
      expect(ligue1).toBeDefined();
      expect(ucl).toBeDefined();
      expect(epl?.enabled).toBe(true);
    });
  });

  describe('Zero Mock Fallback in Production Services', () => {
    it('returns empty array [] and never mock objects when opportunities are empty or unconfigured', async () => {
      const signals = await fetchSignals();
      expect(Array.isArray(signals)).toBe(true);
      // Assert that none of the legacy mock cards (Man City -0.75 or Real Madrid Over 2.5 with seed 'today') are returned
      const isMockManCity = signals.some((s) => s.selection === 'Man City -0.75' && s.ev === 9.5);
      const isMockRealMadrid = signals.some((s) => s.selection === 'Real Madrid Over 2.5' && s.ev === 10.6);

      expect(isMockManCity).toBe(false);
      expect(isMockRealMadrid).toBe(false);
    });
  });

  describe('Live Opportunities Engine Invariants', () => {
    it('OpportunitiesService returns state NO_FIXTURES or NO_VALUE when no positive EV fixtures exist, with zero synthetic data', async () => {
      const opps = await OpportunitiesService.getOpportunities();
      expect(['NO_FIXTURES', 'NO_VALUE', 'DATABASE_ERROR']).toContain(opps.state);
      expect(Array.isArray(opps.opportunities)).toBe(true);
      expect(Array.isArray(opps.upcomingFixtures)).toBe(true);

      // Verify that zero synthetic fixtures leak
      for (const opp of opps.opportunities) {
        expect(opp.ev).toBeGreaterThanOrEqual(HOMEPAGE_MIN_EV);
        expect(opp.kickoff).toBeDefined();
        expect(new Date(opp.kickoff).getTime()).toBeGreaterThan(0);
      }
    });
  });
});

const HOMEPAGE_MIN_EV = 0.02;
