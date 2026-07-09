// ApiFootball Provider — IFixturesProvider Implementation
// Location: src/lib/data/providers/apiFootball/provider.ts
// Responsibilities: fetch fixtures, validate response, normalize
// Does NOT: save to DB, make predictions, calculate EV/Kelly

import { logger } from '@/lib/logger';
import { HttpClient } from '@/lib/http';
import { createApiFootballClient } from './client';
import { normalizeFixtures, normalizeTeams, type RawApiFootballResponse } from './normalizers';
import type { IFixturesProvider, Fixture, ProviderFixtureQuery, HealthStatus } from '../types';

export class ApiFootballProvider implements IFixturesProvider {
  readonly name = 'api-football';
  private client: HttpClient;
  private log = logger.child('provider:api-football');

  constructor(client?: HttpClient) {
    this.client = client ?? createApiFootballClient();
  }

  async fetchFixtures(query: ProviderFixtureQuery): Promise<Fixture[]> {
    this.log.info('fetch_fixtures', { leagues: query.leagues, status: query.status });

    const queryParams: Record<string, string | number | undefined> = {};

    // API-Football uses league IDs, not names
    if (query.leagues && query.leagues.length > 0) {
      // Try to use first league param — caller should provide numeric IDs
      queryParams.league = query.leagues[0];
    }

    if (query.fromDate) {
      queryParams.from = query.fromDate.toISOString().split('T')[0];
    }
    if (query.toDate) {
      queryParams.to = query.toDate.toISOString().split('T')[0];
    }
    if (query.status) {
      switch (query.status) {
        case 'upcoming':
          // API-Football: NS = Not Started
          queryParams.status = 'NS';
          break;
        case 'live':
          queryParams.status = 'live';
          break;
        case 'finished':
          queryParams.status = 'FT';
          break;
      }
    }

    // Default: fetch today's fixtures if no date range specified
    if (!queryParams.from && !queryParams.to) {
      const today = new Date().toISOString().split('T')[0];
      queryParams.date = today;
      delete queryParams.from;
      delete queryParams.to;
    }

    try {
      const response = await this.client.get<RawApiFootballResponse>('/fixtures', {
        queryParams,
        cacheTtlMs: 60_000, // 1 min cache for fixtures
      });

      const fixtures = normalizeFixtures(response.data);
      this.log.info('fixtures_fetched', { count: fixtures.length });
      return fixtures;
    } catch (error: any) {
      this.log.error('fetch_fixtures_failed', { error: error.message, code: error.code });
      throw error;
    }
  }

  async fetchTeams(leagueId: number, season: number): Promise<any[]> {
    try {
      const response = await this.client.get<{ response: any[] }>('/teams', {
        queryParams: { league: String(leagueId), season: String(season) },
        cacheTtlMs: 300_000, // 5 min cache for teams
      });
      return normalizeTeams(response.data);
    } catch (error: any) {
      this.log.error('fetch_teams_failed', { error: error.message });
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      return await this.client.ping('/');
    } catch {
      return false;
    }
  }

  async getHealthStatus(): Promise<HealthStatus> {
    const start = performance.now();
    try {
      const healthy = await this.healthCheck();
      return {
        healthy,
        provider: this.name,
        latencyMs: Math.round(performance.now() - start),
        lastChecked: new Date(),
      };
    } catch (err: any) {
      return {
        healthy: false,
        provider: this.name,
        error: err.message,
        lastChecked: new Date(),
      };
    }
  }
}
