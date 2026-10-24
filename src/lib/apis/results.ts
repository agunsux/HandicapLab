import { z } from 'zod';
import { apiFootballClient, ApiFootballFixtureResponseItemSchema } from './apifootball';
import { FreeResultsAdapter } from '../results/freeResultsAdapter';

// Ensure this module is only imported/run on the server side
if (typeof window !== 'undefined') {
  throw new Error('Results API provider can only be used on the server side.');
}

// Zod schema for validation of match results
export const MatchResultSchema = z.object({
  matchId: z.string(),
  homeTeam: z.string(),
  awayTeam: z.string(),
  homeGoals: z.number().nullable(),
  awayGoals: z.number().nullable(),
  status: z.string(),
  settledAt: z.string().optional(),
});

export type MatchResult = z.infer<typeof MatchResultSchema>;

export class ResultProvider {
  /**
   * Fetches results for a given league and season.
   * Maps them into a standard, validated MatchResult structure.
   */
  public async getResults(
    league: number,
    season: number
  ): Promise<MatchResult[]> {
    console.log(`[ResultProvider] Fetching match results for league ${league}, season ${season}...`);
    
    // 1. Attempt primary API-Football client
    try {
      const response = await apiFootballClient.getFixtures(league, season);
      const finishedFixtures = (response?.response || []).filter(
        (item) => item.fixture.status.short === 'FT' || item.fixture.status.short === 'AET' || item.fixture.status.short === 'PEN'
      );

      if (finishedFixtures.length > 0) {
        return finishedFixtures.map((item) => ({
          matchId: String(item.fixture.id),
          homeTeam: item.teams.home.name,
          awayTeam: item.teams.away.name,
          homeGoals: item.goals.home !== null && item.goals.home !== undefined ? item.goals.home : null,
          awayGoals: item.goals.away !== null && item.goals.away !== undefined ? item.goals.away : null,
          status: item.fixture.status.short,
          settledAt: item.fixture.date,
        }));
      }
    } catch (err: any) {
      console.warn(`[ResultProvider] Primary apiFootballClient unavailable: ${err.message}. Engaging FreeResultsAdapter...`);
    }

    // 2. Fallback: FreeResultsAdapter (EPIC 89)
    try {
      const { LEAGUE_REGISTRY } = await import('@/lib/crons/leagueRegistry');
      const lConfig = LEAGUE_REGISTRY.find(l => l.apiFootballId === league);
      const leagueName = lConfig ? lConfig.name : 'Premier League';
      const freeResults = await FreeResultsAdapter.getResultsForLeague(leagueName, season);

      return freeResults.map((r, idx) => ({
        matchId: `fd_${r.division}_${r.kickoffDate}_${idx}`,
        homeTeam: r.homeTeam,
        awayTeam: r.awayTeam,
        homeGoals: r.homeGoals,
        awayGoals: r.awayGoals,
        status: 'FT',
        settledAt: `${r.kickoffDate}T${r.kickoffTime || '15:00'}:00Z`,
      }));
    } catch (fbErr: any) {
      console.error(`[ResultProvider] FreeResultsAdapter fallback failed: ${fbErr.message}`);
      return [];
    }
  }
}

export const resultProvider = new ResultProvider();
