import { z } from 'zod';
import { apiFootballClient, ApiFootballFixtureResponseItemSchema } from './apifootball';

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
    
    // Fetch via our type-safe production client
    const response = await apiFootballClient.getFixtures(league, season);
    
    // Filter to finished/settled fixtures only
    const finishedFixtures = response.response.filter(
      (item) => item.fixture.status.short === 'FT' || item.fixture.status.short === 'AET' || item.fixture.status.short === 'PEN'
    );

    return finishedFixtures.map((item) => {
      return {
        matchId: String(item.fixture.id),
        homeTeam: item.teams.home.name,
        awayTeam: item.teams.away.name,
        homeGoals: item.goals.home !== null && item.goals.home !== undefined ? item.goals.home : null,
        awayGoals: item.goals.away !== null && item.goals.away !== undefined ? item.goals.away : null,
        status: item.fixture.status.short,
        settledAt: item.fixture.date, // use kickoff date/time as settlement approximation
      };
    });
  }
}

export const resultProvider = new ResultProvider();
