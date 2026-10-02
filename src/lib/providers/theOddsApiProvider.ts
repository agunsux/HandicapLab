// ============================================================================
// THE ODDS API PROVIDER IMPLEMENTATION
// ============================================================================
// Location: src/lib/providers/theOddsApiProvider.ts
//
// Invariants enforced:
// 1. Role: Historical + supplementary market odds provider. Does NOT replace OddsPapi.
// 2. Provider Identifier: 'the-odds-api'
// 3. Quota Safety: Free tier (500 req/month). Pre-authorized through TheOddsApiQuotaManager
//    and globalGateway before issuing requests.
// 4. Zero Secrets Leakage: API key retrieved server-side via getOddsApiKey(),
//    redacted from logs, never sent to clients.
// 5. Capability Discipline: If historical odds is not supported by current plan,
//    returns structured CAPABILITY_UNAVAILABLE error without mock data.
// 6. Strict Markets: AH (line preserved), OU (line family), BTTS.
// ============================================================================

import { globalGateway } from './providerGateway';
import { getOddsApiKey, hasOddsApiKey } from './providerKey';
import { TheOddsApiQuotaManager } from './theOddsApiQuotaManager';
import {
  TheOddsApiNormalizer,
  type TheOddsApiEvent,
  type CanonicalTheOddsApiRecord,
} from '@/lib/data/providers/odds/theOddsApiNormalizer';
import type { OddsSnapshot } from '@/lib/data/providers/types';

export interface TheOddsApiHistoricalResponse {
  success: boolean;
  error?: string;
  message?: string;
  timestamp?: string;
  data?: any[];
}

export class TheOddsApiProvider {
  public static readonly PROVIDER_NAME = 'the-odds-api';
  private static readonly BASE_URL = 'https://api.the-odds-api.com/v4';

  /**
   * Safe unmetered health check against /v4/sports.
   * Consumes 0 credits on The Odds API.
   */
  public static async healthCheck(timeoutMs: number = 5000): Promise<{
    healthy: boolean;
    provider: string;
    configured: boolean;
    latencyMs: number;
    error?: string;
    remainingCredits?: number;
  }> {
    const start = Date.now();
    const configured = hasOddsApiKey();

    if (!configured) {
      return {
        healthy: false,
        provider: this.PROVIDER_NAME,
        configured: false,
        latencyMs: 0,
        error: 'ODDS_API_KEY / THE_ODDS_API_KEY is not configured in environment',
      };
    }

    if (process.env.NODE_ENV === 'test' && !process.env.RUN_LIVE_PROVIDER_TESTS) {
      return {
        healthy: true,
        provider: this.PROVIDER_NAME,
        configured: true,
        latencyMs: 5,
        remainingCredits: 500,
      };
    }

    const key = getOddsApiKey();
    const url = `${this.BASE_URL}/sports?apiKey=${encodeURIComponent(key)}`;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const res = await globalGateway.fetch(this.PROVIDER_NAME, 'sports', url, {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
        cacheTtlMs: 300_000, // 5 minutes cache
        quotaPriority: 10,
      });

      clearTimeout(timer);
      const latencyMs = Date.now() - start;

      // Parse headers
      const remHeader = res.headers.get('x-requests-remaining');
      const usedHeader = res.headers.get('x-requests-used');

      TheOddsApiQuotaManager.recordExecution({
        requestId: `hl_health_${Date.now()}`,
        endpoint: 'sports',
        method: 'GET',
        cost: 0,
        httpStatus: res.status,
        success: res.ok,
        latencyMs,
        headers: res.headers,
      });

      if (res.status === 200) {
        return {
          healthy: true,
          provider: this.PROVIDER_NAME,
          configured: true,
          latencyMs,
          remainingCredits: remHeader ? parseInt(remHeader, 10) : undefined,
        };
      }

      if (res.status === 401 || res.status === 403) {
        return {
          healthy: false,
          provider: this.PROVIDER_NAME,
          configured: true,
          latencyMs,
          error: `HTTP ${res.status}: Invalid or unauthorized API key`,
        };
      }

      return {
        healthy: false,
        provider: this.PROVIDER_NAME,
        configured: true,
        latencyMs,
        error: `HTTP ${res.status} ${res.statusText}`,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      TheOddsApiQuotaManager.recordExecution({
        requestId: `hl_health_err_${Date.now()}`,
        endpoint: 'sports',
        method: 'GET',
        cost: 0,
        httpStatus: null,
        success: false,
        latencyMs,
        error: err.message || String(err),
      });

      return {
        healthy: false,
        provider: this.PROVIDER_NAME,
        configured: true,
        latencyMs,
        error: err.message || String(err),
      };
    }
  }

  /**
   * Fetches active fixtures/events for a given sport without odds.
   */
  public static async getFixtures(sportKey: string = 'soccer_epl'): Promise<{
    success: boolean;
    events: TheOddsApiEvent[];
    error?: string;
  }> {
    if (!hasOddsApiKey()) {
      return { success: false, events: [], error: 'API_KEY_MISSING' };
    }

    if (process.env.NODE_ENV === 'test' && !process.env.RUN_LIVE_PROVIDER_TESTS) {
      return { success: true, events: [] };
    }

    const auth = TheOddsApiQuotaManager.authorizeRequest('events', 50);
    if (!auth.allowed) {
      return { success: false, events: [], error: auth.reason };
    }

    const key = getOddsApiKey();
    const url = `${this.BASE_URL}/sports/${encodeURIComponent(sportKey)}/events?apiKey=${encodeURIComponent(key)}`;
    const start = Date.now();

    try {
      const res = await globalGateway.fetch(this.PROVIDER_NAME, 'events', url, {
        headers: { 'Accept': 'application/json' },
        cacheTtlMs: 60_000,
        quotaPriority: 50,
      });

      const latencyMs = Date.now() - start;
      TheOddsApiQuotaManager.recordExecution({
        requestId: `hl_evt_${Date.now()}`,
        endpoint: 'events',
        method: 'GET',
        cost: 1,
        httpStatus: res.status,
        success: res.ok,
        latencyMs,
        headers: res.headers,
      });

      if (!res.ok) {
        return { success: false, events: [], error: `HTTP ${res.status}: ${res.statusText}` };
      }

      const events: TheOddsApiEvent[] = await res.json();
      return { success: true, events };
    } catch (err: any) {
      return { success: false, events: [], error: err.message || String(err) };
    }
  }

  /**
   * Fetches market odds for a sport and converts into canonical odds records.
   * Supported markets: spreads (AH), totals (OU), btts.
   */
  public static async getOdds(
    sportKey: string = 'soccer_epl',
    options: {
      regions?: string; // 'eu,uk,us'
      markets?: string; // 'spreads,totals,btts'
      priority?: number;
    } = {}
  ): Promise<{
    success: boolean;
    records: CanonicalTheOddsApiRecord[];
    snapshots: OddsSnapshot[];
    eventsCount: number;
    error?: string;
  }> {
    if (!hasOddsApiKey()) {
      return { success: false, records: [], snapshots: [], eventsCount: 0, error: 'API_KEY_MISSING' };
    }

    if (process.env.NODE_ENV === 'test' && !process.env.RUN_LIVE_PROVIDER_TESTS) {
      return { success: true, records: [], snapshots: [], eventsCount: 0 };
    }

    const priority = options.priority ?? 70;
    const auth = TheOddsApiQuotaManager.authorizeRequest('odds', priority);
    if (!auth.allowed) {
      return { success: false, records: [], snapshots: [], eventsCount: 0, error: auth.reason };
    }

    const key = getOddsApiKey();
    const regions = options.regions || 'eu';
    const markets = options.markets || 'spreads,totals,btts';

    const url = `${this.BASE_URL}/sports/${encodeURIComponent(sportKey)}/odds?apiKey=${encodeURIComponent(
      key
    )}&regions=${encodeURIComponent(regions)}&markets=${encodeURIComponent(
      markets
    )}&oddsFormat=decimal&dateFormat=iso`;

    const start = Date.now();

    try {
      const res = await globalGateway.fetch(this.PROVIDER_NAME, 'odds', url, {
        headers: { 'Accept': 'application/json' },
        cacheTtlMs: 30_000,
        quotaPriority: priority,
      });

      const latencyMs = Date.now() - start;
      TheOddsApiQuotaManager.recordExecution({
        requestId: `hl_odds_${Date.now()}`,
        endpoint: 'odds',
        method: 'GET',
        cost: 1,
        httpStatus: res.status,
        success: res.ok,
        latencyMs,
        headers: res.headers,
      });

      if (!res.ok) {
        return {
          success: false,
          records: [],
          snapshots: [],
          eventsCount: 0,
          error: `HTTP ${res.status}: ${res.statusText}`,
        };
      }

      const events: TheOddsApiEvent[] = await res.json();
      const allRecords: CanonicalTheOddsApiRecord[] = [];

      for (const ev of events) {
        const normalized = TheOddsApiNormalizer.normalizeEvent(ev);
        allRecords.push(...normalized);
      }

      const snapshots = TheOddsApiNormalizer.toOddsSnapshots(allRecords);

      return {
        success: true,
        records: allRecords,
        snapshots,
        eventsCount: events.length,
      };
    } catch (err: any) {
      return {
        success: false,
        records: [],
        snapshots: [],
        eventsCount: 0,
        error: err.message || String(err),
      };
    }
  }

  /**
   * Fetches historical odds snapshot for research.
   * If the account/plan does not permit historical access, returns structured
   * CAPABILITY_UNAVAILABLE without fabricating any data.
   */
  public static async getHistoricalOdds(
    sportKey: string,
    dateIso: string,
    options: {
      regions?: string;
      markets?: string;
    } = {}
  ): Promise<TheOddsApiHistoricalResponse> {
    if (!hasOddsApiKey()) {
      return {
        success: false,
        error: 'API_KEY_MISSING',
        message: 'ODDS_API_KEY is not configured in environment',
      };
    }

    if (process.env.NODE_ENV === 'test' && !process.env.RUN_LIVE_PROVIDER_TESTS) {
      return {
        success: false,
        error: 'CAPABILITY_UNAVAILABLE',
        message: 'Historical odds require paid plan with historical add-on in test environment',
      };
    }

    const auth = TheOddsApiQuotaManager.authorizeRequest('historical-odds', 40);
    if (!auth.allowed) {
      return {
        success: false,
        error: 'QUOTA_BLOCKED',
        message: auth.reason,
      };
    }

    const key = getOddsApiKey();
    const regions = options.regions || 'eu';
    const markets = options.markets || 'spreads,totals,btts';

    const url = `${this.BASE_URL}/historical/sports/${encodeURIComponent(
      sportKey
    )}/odds?apiKey=${encodeURIComponent(key)}&regions=${encodeURIComponent(
      regions
    )}&markets=${encodeURIComponent(markets)}&date=${encodeURIComponent(dateIso)}`;

    const start = Date.now();

    try {
      const res = await globalGateway.fetch(this.PROVIDER_NAME, 'historical-odds', url, {
        headers: { 'Accept': 'application/json' },
        cacheTtlMs: 24 * 3600 * 1000,
        quotaPriority: 40,
      });

      const latencyMs = Date.now() - start;
      TheOddsApiQuotaManager.recordExecution({
        requestId: `hl_hist_${Date.now()}`,
        endpoint: 'historical-odds',
        method: 'GET',
        cost: 1,
        httpStatus: res.status,
        success: res.ok,
        latencyMs,
        headers: res.headers,
      });

      if (res.status === 401 || res.status === 403 || res.status === 422) {
        const body = await res.json().catch(() => ({}));
        return {
          success: false,
          error: 'CAPABILITY_UNAVAILABLE',
          message:
            body?.message ||
            `The Odds API account does not support historical odds endpoint (HTTP ${res.status}).`,
        };
      }

      if (!res.ok) {
        return {
          success: false,
          error: `HTTP_${res.status}`,
          message: `Historical odds request failed: HTTP ${res.status}`,
        };
      }

      const payload = await res.json();
      return {
        success: true,
        timestamp: payload.timestamp || dateIso,
        data: payload.data || [],
      };
    } catch (err: any) {
      return {
        success: false,
        error: 'REQUEST_FAILED',
        message: err.message || String(err),
      };
    }
  }
}
