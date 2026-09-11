import { FootballProvider, NormalizedFixture } from './types';
import { LeagueConfig } from '@/lib/crons/leagueRegistry';
// Canonical quota-aware client (ProviderGateway + QuotaManager).
// The legacy mock-capable client (src/lib/api/apiFootball.ts) must never be
// used on production paths.
import { apiFootballClient } from '@/lib/apis/apifootball';
import { normalizeTournamentStage } from '@/lib/utils/stageNormalization';

const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN']);
const UPCOMING_STATUSES = new Set(['NS', 'TBD']);

function mapStatus(short: string): NormalizedFixture['status'] {
  if (FINISHED_STATUSES.has(short)) return 'finished';
  if (UPCOMING_STATUSES.has(short)) return 'upcoming';
  return 'live';
}

export class ApiFootballProvider implements FootballProvider {
  async getFixtures(leagueConfig: LeagueConfig, season: number): Promise<NormalizedFixture[]> {
    try {
      const envelope = await apiFootballClient.getFixtures(leagueConfig.apiFootballId, season);
      return envelope.response.map((f) => ({
        id: String(f.fixture.id),
        competitionId: String(leagueConfig.apiFootballId),
        competitionName: f.league.name,
        homeTeam: f.teams.home.name,
        awayTeam: f.teams.away.name,
        matchDate: f.fixture.date,
        status: mapStatus(f.fixture.status.short),
        season,
        homeTeamId: String(f.teams.home.id),
        awayTeamId: String(f.teams.away.id),
        tournamentStage: normalizeTournamentStage(f.league.round),
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
