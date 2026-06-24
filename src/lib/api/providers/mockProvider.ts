import { FootballProvider, NormalizedFixture } from './types';
import { LeagueConfig } from '@/lib/crons/leagueRegistry';

export class MockProvider implements FootballProvider {
  async getFixtures(leagueConfig: LeagueConfig, season: number): Promise<NormalizedFixture[]> {
    console.log(`[MockProvider] Generating mock fixtures for ${leagueConfig.name}`);
    
    const mockFixtures: NormalizedFixture[] = [];
    const baseDate = new Date();
    
    // Generate 5 mock fixtures
    for (let i = 0; i < 5; i++) {
      const matchDate = new Date(baseDate.getTime() + (i + 1) * 86400 * 1000); // Future dates
      mockFixtures.push({
        id: `mock-${leagueConfig.id}-${i}`,
        competitionId: String(leagueConfig.apiFootballId),
        competitionName: leagueConfig.name,
        homeTeam: `Mock Home ${i}`,
        awayTeam: `Mock Away ${i}`,
        matchDate: matchDate.toISOString(),
        status: 'upcoming',
        season: season,
        homeTeamId: `home-${i}`,
        awayTeamId: `away-${i}`,
        tournamentStage: `Matchday ${i + 1}`,
      });
    }

    return mockFixtures;
  }

  async getResults(leagueConfig: LeagueConfig, season: number): Promise<NormalizedFixture[]> {
    return [];
  }

  async getStandings(leagueConfig: LeagueConfig, season: number): Promise<any> {
    return [];
  }
}
