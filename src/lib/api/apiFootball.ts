// DEPRECATED / RESTRICTED CLIENT
// This module is retained for research scripts only. It is NOT the canonical
// provider client: production paths must use src/lib/apis/apifootball.ts
// (ProviderGateway + QuotaManager).
//
// As of the API-Football P0 compliance change this client no longer performs a
// direct `fetch`. It delegates to the canonical quota-aware client so every
// call is deduplicated, rate-limited, audited and quota-accounted. Synthetic /
// mock generation remains disabled: when the key is missing this client fails
// closed with DATA_UNAVAILABLE instead of fabricating data.

import { apiFootballClient as canonicalApiFootballClient } from '@/lib/apis/apifootball';
import { getApiFootballKey } from '@/lib/providers/providerKey';
import { rateLimiter } from './rateLimiter';

export interface ApiFootballResponse<T> {
  get: string;
  parameters: Record<string, string>;
  errors: any[] | Record<string, string> | null;
  results: number;
  paging: { current: number; total: number };
  response: T;
}

export class ApiFootballClient {
  private apiKey: string;

  constructor() {
    this.apiKey = getApiFootballKey();
  }

  /**
   * Fail closed when the key is missing. Synthetic/mock generation is disabled:
   * production paths must never receive fabricated data.
   */
  private ensureAvailable(): void {
    if (!this.apiKey || this.apiKey === 'mock') {
      throw new Error(
        'DATA_UNAVAILABLE: API-Football key missing. Synthetic fallback is disabled by policy.'
      );
    }
  }

  public async getFixtures(league: number, season: number): Promise<any[]> {
    this.ensureAvailable();
    await rateLimiter.registerRequest();
    const envelope = await canonicalApiFootballClient.getFixtures(league, season);
    return envelope.response;
  }

  public async getFixtureStatistics(fixture: number): Promise<any[]> {
    this.ensureAvailable();
    await rateLimiter.registerRequest();
    const envelope = await canonicalApiFootballClient.getFixtureStatistics(fixture);
    return envelope.response;
  }

  public async getTeamStatistics(league: number, season: number, team: number): Promise<any> {
    this.ensureAvailable();
    await rateLimiter.registerRequest();
    const envelope = await canonicalApiFootballClient.getTeamStatistics({ league, season, team });
    return envelope.response;
  }
}

export const apiFootballClient = new ApiFootballClient();

export async function fetchUpcomingFixtures(league = 39, season = 2024): Promise<any[]> {
  const fixtures = await apiFootballClient.getFixtures(league, season);
  const upcoming = fixtures.filter(f => f.fixture.status.short !== 'FT');
  return upcoming;
}
