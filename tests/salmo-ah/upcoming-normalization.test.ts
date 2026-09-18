import { describe, it, expect } from 'vitest';
import { AhUpcomingService } from '../../src/lib/services/ahUpcomingService';

describe('AhUpcomingService — Normalization & Zero-Synthetic Data Tests', () => {
  it('retrieves upcoming fixtures with canonical ID and valid freshness format', async () => {
    const res = await AhUpcomingService.getUpcomingAhFixtures({ daysAhead: 7, limit: 10 });

    expect(res).toBeDefined();
    expect(Array.isArray(res.fixtures)).toBe(true);
    expect(res.dataFreshness).toBeDefined();
    expect(res.source).toBeDefined();

    if (res.fixtures.length > 0) {
      const f = res.fixtures[0];
      expect(f.canonicalFixtureId).toMatch(/^canonical-af-/);
      expect(f.homeTeam).toBeDefined();
      expect(f.awayTeam).toBeDefined();
      expect(f.decisionHome).toBeDefined();
      expect(f.decisionAway).toBeDefined();
    }
  });

  it('never manufactures synthetic fallback odds (e.g. 1.90) when market odds are missing', async () => {
    const res = await AhUpcomingService.getUpcomingAhFixtures({ daysAhead: 7 });

    for (const f of res.fixtures) {
      if (!f.marketAvailable) {
        // Must be null, never a fabricated 1.90 default
        expect(f.marketLine).toBeNull();
        expect(f.homeOdds).toBeNull();
        expect(f.awayOdds).toBeNull();
        expect(f.homeFairOdds).toBeNull();
        expect(f.homeEvPct).toBeNull();

        // Must strictly be classified as GREY / INSUFFICIENT_DATA
        expect(f.decisionHome.badge).toBe('GREY');
        expect(f.decisionHome.status).toBe('INSUFFICIENT_DATA');
        expect(f.decisionHome.statusLabel).toBe('ODDS DATA UNAVAILABLE');
        expect(f.decisionHome.productionReady).toBe(false);
      }
    }
  });

  it('attaches decision evaluations to both home and away sides', async () => {
    const res = await AhUpcomingService.getUpcomingAhFixtures({ daysAhead: 7, limit: 5 });

    for (const f of res.fixtures) {
      expect(f.decisionHome.badge).toBeDefined();
      expect(f.decisionAway.badge).toBeDefined();
      expect(['GREEN', 'YELLOW', 'RED', 'GREY']).toContain(f.decisionHome.badge);
      expect(['GREEN', 'YELLOW', 'RED', 'GREY']).toContain(f.decisionAway.badge);
    }
  });
});
