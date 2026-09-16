import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DailyAhShadowPipeline, CONFIRMED_LEAGUES } from '@/lib/pipeline/dailyAhShadowPipeline';
import { apiFootballClient } from '@/lib/apis/apifootball';
import { oddsApiClient } from '@/lib/apis/oddspapi';
import { getBlockedRequestCount, resetBlockedRequestCount } from './setup-env';

describe('P0.4 Fixture Query Deduplication', () => {
  beforeEach(() => {
    resetBlockedRequestCount();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls apiFootballClient.getFixturesByDate exactly twice (today + tomorrow), NOT per-league', async () => {
    const initialBlocked = getBlockedRequestCount();

    // Mock oddsApiClient to return empty fixture list without network egress
    (oddsApiClient as any).getFixtures = vi.fn().mockResolvedValue([]);

    // Mock apiFootballClient.getFixturesByDate
    const getFixturesSpy = vi.spyOn(apiFootballClient, 'getFixturesByDate').mockImplementation(async (date: string) => {
      return [
        {
          fixture: { id: 1001, date: `${date}T15:00:00Z`, status: { short: 'NS' } },
          league: { id: 39, name: 'Premier League' }, // Whitelisted
          teams: {
            home: { id: 33, name: 'Manchester United' },
            away: { id: 34, name: 'Newcastle' },
          },
        },
        {
          fixture: { id: 1002, date: `${date}T17:30:00Z`, status: { short: 'NS' } },
          league: { id: 140, name: 'La Liga' }, // Whitelisted
          teams: {
            home: { id: 529, name: 'Barcelona' },
            away: { id: 541, name: 'Real Madrid' },
          },
        },
        {
          fixture: { id: 9999, date: `${date}T19:00:00Z`, status: { short: 'NS' } },
          league: { id: 999, name: 'Unknown League' }, // NOT Whitelisted
          teams: {
            home: { id: 1, name: 'Team A' },
            away: { id: 2, name: 'Team B' },
          },
        },
      ] as any;
    });

    const candidates = await DailyAhShadowPipeline.fetchLiveUpcomingFixtures();

    // With 8 confirmed leagues, the old code called getFixturesByDate 16 times (8 leagues * 2 dates).
    // The optimized code must call it exactly 2 times (1 per date).
    const leagueCount = Object.keys(CONFIRMED_LEAGUES).length;
    expect(leagueCount).toBeGreaterThanOrEqual(8);
    expect(getFixturesSpy).toHaveBeenCalledTimes(2);

    // Filtered in-memory: only the 2 confirmed leagues per date = 4 total candidates
    expect(candidates.length).toBe(4);
    for (const c of candidates) {
      expect([39, 140]).toContain(Number(c.leagueId));
      expect(c.status).toBe('NS');
    }

    // Assert zero unmocked network egress occurred
    expect(getBlockedRequestCount()).toBe(initialBlocked);
  });
});
