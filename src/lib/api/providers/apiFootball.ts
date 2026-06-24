import { FootballProvider, NormalizedFixture } from './types';
import { LeagueConfig } from '@/lib/crons/leagueRegistry';
import { apiFootballClient } from '../apiFootball';

export class ApiFootballProvider implements FootballProvider {
  async getFixtures(leagueConfig: LeagueConfig, season: number): Promise<NormalizedFixture[]> {
    try {
      const fixtures = await apiFootballClient.getFixtures(leagueConfig.apiFootballId, season);
      return fixtures.map((f: any) => ({
        id: String(f.fixture.id),
        competitionId: String(leagueConfig.apiFootballId),
        competitionName: f.league.name,
        homeTeam: f.teams.home.name,
        awayTeam: f.teams.away.name,
        matchDate: f.fixture.date,
        status: f.fixture.status.short === 'FT' ? 'finished' : (f.fixture.status.short === 'NS' ? 'upcoming' : 'live'),
        season: season,
        homeTeamId: String(f.teams.home.id),
        awayTeamId: String(f.teams.away.id),
        tournamentStage: f.league.round || null,
      }));
    } catch (e: any) {
      console.error(`[ApiFootballProvider] /fixtures error:`, e.message);
      throw e;
    }
  }

  async getResults(leagueConfig: LeagueConfig, season: number): Promise<NormalizedFixture[]> {
    const fixtures = await this.getFixtures(leagueConfig, season);
    return fixtures.filter(f => f.status === 'finished');
  }

  async getStandings(leagueConfig: LeagueConfig, season: number): Promise<any> {
    // Currently unimplemented for ApiFootball fallback inside provider abstraction
    return [];
  }
}
