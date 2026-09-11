import { z } from 'zod';
import { rateLimiter } from './rateLimiter';
import { apiCache } from './cache';

// DEPRECATED / RESTRICTED CLIENT
// This module is retained for research scripts only. It is NOT the canonical
// provider client: production paths must use src/lib/apis/apifootball.ts
// (ProviderGateway + QuotaManager). Synthetic/mock generation has been
// removed — when the key is missing this client fails closed with
// DATA_UNAVAILABLE instead of fabricating data.

export interface ApiFootballResponse<T> {
  get: string;
  parameters: Record<string, string>;
  errors: any[] | Record<string, string> | null;
  results: number;
  paging: { current: number; total: number };
  response: T;
}

export class ApiFootballClient {
  private baseUrl = 'https://v3.football.api-sports.io';
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.APIFOOTBALL_KEY || process.env.API_FOOTBALL_KEY || '';
  }

  private async request<T>(endpoint: string, params: Record<string, any>): Promise<T> {
    // 1. Check cache first
    const cachedData = apiCache.get<T>(endpoint, params);
    if (cachedData !== null) {
      return cachedData;
    }

    // 2. Fail closed when the key is missing. Synthetic/mock generation is
    //    disabled: production paths must never receive fabricated data.
    if (!this.apiKey || this.apiKey === 'mock') {
      throw new Error(
        'DATA_UNAVAILABLE: API-Football key missing. Synthetic fallback is disabled by policy.'
      );
    }

    // 3. Check rate limiter, execute real API call and cache
    await rateLimiter.registerRequest();

    const url = new URL(`${this.baseUrl}/${endpoint}`);
    Object.keys(params).forEach(key => url.searchParams.append(key, String(params[key])));

    console.log(`[ApiFootballClient] Fetching live data from: ${url.toString()}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'x-apisports-key': this.apiKey,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`API-Football error status: ${res.status} ${res.statusText}`);
      }

      const rawResponse: unknown = await res.json();

      const apiFootballEnvelopeSchema = z.object({
        get: z.string(),
        parameters: z.record(z.string(), z.any()),
        errors: z.union([z.array(z.any()), z.record(z.string(), z.any())]).optional().nullable(),
        results: z.number(),
        paging: z.object({ current: z.number(), total: z.number() }),
        response: z.any(),
      });

      const parsedEnvelope = apiFootballEnvelopeSchema.safeParse(rawResponse);
      if (!parsedEnvelope.success) {
        console.error('[ApiFootballClient] Envelope validation failed:', parsedEnvelope.error.format());
        throw new Error(`API-Football response validation failed: ${parsedEnvelope.error.message}`);
      }

      const data = parsedEnvelope.data;

      // API-Football returns errors in response body under "errors" property
      if (data.errors && (Array.isArray(data.errors) ? data.errors.length > 0 : Object.keys(data.errors).length > 0)) {
        console.error('[ApiFootballClient] API response errors:', data.errors);
        throw new Error(`API-Football response error: ${JSON.stringify(data.errors)}`);
      }

      const responsePayload = data.response as T;
      apiCache.set(endpoint, params, responsePayload);
      return responsePayload;
    } catch (e) {
      clearTimeout(timeoutId);
      console.error(`[ApiFootballClient] Network request failed for ${endpoint}:`, e);
      throw e;
    }
  }

  public async getFixtures(league: number, season: number): Promise<any[]> {
    return this.request<any[]>('fixtures', { league, season });
  }

  public async getFixtureStatistics(fixture: number): Promise<any[]> {
    return this.request<any[]>('fixtures/statistics', { fixture });
  }

  public async getTeamStatistics(league: number, season: number, team: number): Promise<any> {
    return this.request<any>('teams/statistics', { league, season, team });
  }
}

export const apiFootballClient = new ApiFootballClient();

export async function fetchUpcomingFixtures(league = 39, season = 2024): Promise<any[]> {
  const fixtures = await apiFootballClient.getFixtures(league, season);
  const upcoming = fixtures.filter(f => f.fixture.status.short !== 'FT');
  return upcoming;
}
