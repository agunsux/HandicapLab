import { z } from 'zod';
import { FootballProvider, NormalizedFixture } from './types';
import { LeagueConfig } from '@/lib/crons/leagueRegistry';
import { normalizeTournamentStage } from '@/lib/utils/stageNormalization';

export const FootballDataMatchSchema = z.object({
  id: z.number(),
  status: z.string(),
  utcDate: z.string(),
  matchday: z.number().nullable().optional(),
  stage: z.string().nullable().optional(),
  homeTeam: z.object({ id: z.number(), name: z.string() }),
  awayTeam: z.object({ id: z.number(), name: z.string() }),
  score: z.object({
    fullTime: z.object({ home: z.number().nullable().optional(), away: z.number().nullable().optional() }).optional().nullable(),
    halfTime: z.object({ home: z.number().nullable().optional(), away: z.number().nullable().optional() }).optional().nullable(),
  }).optional().nullable(),
});

export const FootballDataMatchesResponseSchema = z.object({
  matches: z.array(FootballDataMatchSchema),
});

export const FootballDataStandingsResponseSchema = z.object({
  standings: z.array(z.any()).optional().nullable(),
}).passthrough();

export class FootballDataProvider implements FootballProvider {
  private baseUrl = 'https://api.football-data.org/v4';
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.FOOTBALL_DATA_API_KEY || '';
  }

  private async request<T>(endpoint: string, schema?: z.ZodSchema<T>): Promise<T> {
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

      const rawJson: unknown = await res.json();
      
      if (schema) {
        const validationResult = schema.safeParse(rawJson);
        if (!validationResult.success) {
          console.error('[FootballDataProvider] Schema validation failed for', endpoint, validationResult.error.format());
          throw new Error(`Football-Data API response validation failed: ${validationResult.error.message}`);
        }
        return validationResult.data;
      }
      
      return rawJson as T;
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
    const data = await this.request(endpoint, FootballDataMatchesResponseSchema);

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
    const data = await this.request(endpoint, FootballDataMatchesResponseSchema);
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
    const data = await this.request(endpoint, FootballDataStandingsResponseSchema);
    return data;
  }
}
