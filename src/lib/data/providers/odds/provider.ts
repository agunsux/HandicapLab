// OddsApi Provider — IOddsProvider Implementation
// Location: src/lib/data/providers/odds/provider.ts
// Responsibilities: fetch odds, validate response, normalize
// Does NOT: save to DB, make predictions, calculate EV/Kelly

import { logger } from '@/lib/logger';
import { HttpClient } from '@/lib/http';
import { createOddsApiClient } from './client';
import { normalizeOddsSnapshots } from './normalizers';
import type { IOddsProvider, OddsSnapshot, ProviderOddsQuery, HealthStatus } from '../types';

export class OddsApiProvider implements IOddsProvider {
  readonly name = 'the-odds-api';
  private client: HttpClient;
  private log = logger.child('provider:the-odds-api');

  constructor(client?: HttpClient) {
    this.client = client ?? createOddsApiClient();
  }

  async fetchOdds(query: ProviderOddsQuery): Promise<OddsSnapshot[]> {
    this.log.info('fetch_odds', {
      fixtureIds: query.fixtureIds?.length,
      marketTypes: query.marketTypes,
    });

    const apiKey = this.getApiKey();
    const regions = 'us,uk,eu'; // Default regions
    const markets = this.buildMarketsParam(query.marketTypes);
    const oddsFormat = 'decimal';

    // Determine sport key — default to soccer
    const sport = 'soccer_epl'; // Will be configurable in production

    const queryParams: Record<string, string | number | undefined> = {
      apiKey,
      regions,
      markets,
      oddsFormat,
    };

    if (query.fromTimestamp) {
      queryParams.commenceTimeFrom = query.fromTimestamp.toISOString();
    }
    if (query.toTimestamp) {
      queryParams.commenceTimeTo = query.toTimestamp.toISOString();
    }

    const path = `/sports/${sport}/odds`;

    try {
      const response = await this.client.get<any>(path, {
        queryParams,
        cacheTtlMs: 30_000, // 30s cache for odds
      });

      // Response is an array of matches
      const snapshots = normalizeOddsSnapshots({ data: response.data });

      // Filter by fixture IDs if specified
      if (query.fixtureIds && query.fixtureIds.length > 0) {
        const idSet = new Set(query.fixtureIds);
        return snapshots.filter(s => idSet.has(s.fixtureId));
      }

      this.log.info('odds_fetched', { count: snapshots.length });
      return snapshots;
    } catch (error: any) {
      this.log.error('fetch_odds_failed', { error: error.message, code: error.code });
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const apiKey = this.getApiKey();
      const response = await this.client.get<any>('/sports', {
        queryParams: { apiKey },
        cacheTtlMs: 300_000,
      });
      return Array.isArray(response.data);
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

  private getApiKey(): string {
    return process.env.THE_ODDS_API_KEY ?? process.env.ODDSPAPI_KEY ?? '';
  }

  private buildMarketsParam(marketTypes?: string[]): string {
    if (!marketTypes || marketTypes.length === 0) return 'h2h,spreads,totals';
    const mapping: Record<string, string> = {
      'moneyline': 'h2h',
      'asian_handicap': 'spreads',
      'over_under': 'totals',
    };
    return marketTypes.map(m => mapping[m] || m).join(',');
  }
}
