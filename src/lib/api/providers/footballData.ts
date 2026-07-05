import { FootballProvider, NormalizedFixture } from './types';
import { LeagueConfig } from '@/lib/crons/leagueRegistry';
import { normalizeTournamentStage } from '@/lib/utils/stageNormalization';

export class FootballDataProvider implements FootballProvider {
  private baseUrl = 'https://api.football-data.org/v4';
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.FOOTBALL_DATA_API_KEY || '';
  }

  private async request(endpoint: string): Promise<any> {
    if (!this.apiKey) {
      throw new Error('FOOTBALL_DATA_API_KEY is not configured');
    }

    const url = `${this.baseUrl}/${endpoint}`;
    console.log(`[FootballDataProvider] Fetching: ${url}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Auth-Token': this.apiKey,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Status: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      return data;
    } catch (e: any) {
      clearTimeout(timeoutId);
      console.error(`[FootballDataProvider] ${endpoint} error:`, e.message);
      throw e;
    }
  }

  async getFixtures(leagueConfig: LeagueConfig, season: number): Promise<NormalizedFixture[]> {
    if (!leagueConfig.footballDataId) {
      console.log(`[FootballDataProvider] No footballDataId for ${leagueConfig.name}, skipping.`);
      return [];
    }

    // Example endpoint: competitions/2021/matches?season=2024
    const endpoint = `competitions/${leagueConfig.footballDataId}/matches?season=${season}`;
    const data = await this.request(endpoint);

    if (!data.matches) return [];

    return data.matches.map((m: any) => ({
      id: String(m.id),
      competitionId: String(leagueConfig.footballDataId),
      competitionName: leagueConfig.name, // Use local config name for consistency
      homeTeam: m.homeTeam.name,
      awayTeam: m.awayTeam.name,
      matchDate: m.utcDate,
      status: m.status === 'FINISHED' ? 'finished' : (['TIMED', 'SCHEDULED'].includes(m.status) ? 'upcoming' : 'live'),
      season: season,
      homeTeamId: String(m.homeTeam.id),
      awayTeamId: String(m.awayTeam.id),
      tournamentStage: normalizeTournamentStage(m.matchday ? `Matchday ${m.matchday}` : m.stage || null),
    }));
  }

  async getResults(leagueConfig: LeagueConfig, season: number): Promise<NormalizedFixture[]> {
    if (!leagueConfig.footballDataId) return [];
    const endpoint = `competitions/${leagueConfig.footballDataId}/matches?season=${season}&status=FINISHED`;
    const data = await this.request(endpoint);
    if (!data.matches) return [];

    return data.matches.map((m: any) => ({
      id: String(m.id),
      competitionId: String(leagueConfig.footballDataId),
      competitionName: leagueConfig.name,
      homeTeam: m.homeTeam.name,
      awayTeam: m.awayTeam.name,
      matchDate: m.utcDate,
      status: 'finished',
      season: season,
      homeTeamId: String(m.homeTeam.id),
      awayTeamId: String(m.awayTeam.id),
      tournamentStage: normalizeTournamentStage(m.matchday ? `Matchday ${m.matchday}` : m.stage || null),
    }));
  }

  async getStandings(leagueConfig: LeagueConfig, season: number): Promise<any> {
    if (!leagueConfig.footballDataId) return [];
    const endpoint = `competitions/${leagueConfig.footballDataId}/standings?season=${season}`;
    const data = await this.request(endpoint);
    return data;
  }
}
