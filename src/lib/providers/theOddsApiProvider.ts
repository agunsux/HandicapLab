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
import { DailyPicksEngine } from '@/lib/daily-picks/engine';

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
   * Documented as 0-credit unmetered endpoint.
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

    const auth = TheOddsApiQuotaManager.authorizeRequest('events', 50, 0);
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
        cost: 0, // Confirmed 0-credit unmetered endpoint
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
   * Enforces atomic quota reservation before dispatch.
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
    quotaReservationId?: string;
  }> {
    if (!hasOddsApiKey()) {
      return { success: false, records: [], snapshots: [], eventsCount: 0, error: 'API_KEY_MISSING' };
    }

    if (process.env.NODE_ENV === 'test' && !process.env.RUN_LIVE_PROVIDER_TESTS) {
      return { success: true, records: [], snapshots: [], eventsCount: 0 };
    }

    const priority = options.priority ?? 90; // Default P0 for daily predictions
    const regions = options.regions || 'eu';
    const markets = options.markets || 'spreads,totals';

    // Calculate conservative expected cost: (regions count) * (markets count)
    const { calculateTheOddsApiCost } = await import('./quotaManagerV4');
    const expectedCost = calculateTheOddsApiCost(regions, markets);
    const requestId = `hl_odds_${sportKey}_${Date.now()}`;

    // 1. Atomic reservation before dispatch
    const reserveResult = await TheOddsApiQuotaManager.reserveAtomic({
      endpoint: 'odds',
      priority,
      requestId,
      expectedCost,
    });

    if (!reserveResult.allowed) {
      return {
        success: false,
        records: [],
        snapshots: [],
        eventsCount: 0,
        error: reserveResult.reason || 'QUOTA_RESERVATION_REJECTED',
      };
    }

    const reservationId = reserveResult.reservationId;
    const key = getOddsApiKey();
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

      // Determine actual cost from response header if available, otherwise expected cost
      const lastHeader = res.headers.get('x-requests-last');
      const actualCost = lastHeader !== null && !isNaN(Number(lastHeader)) ? Number(lastHeader) : expectedCost;

      // 2. Confirm reservation with authoritative provider headers
      await TheOddsApiQuotaManager.confirmAtomic({
        reservationId,
        requestId,
        endpoint: 'odds',
        method: 'GET',
        actualCost,
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
          quotaReservationId: reservationId,
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
        quotaReservationId: reservationId,
      };
    } catch (err: any) {
      // Rollback reservation if HTTP request failed before executing
      await TheOddsApiQuotaManager.rollbackAtomic(reservationId);
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
   * Reconciles normalized The Odds API records with CanonicalFixture objects,
   * cleanly mapping Asian Handicap, Over/Under, and BTTS markets into fixture.markets.
   */
  public static reconcileOddsWithFixtures(
    fixtures: any[],
    oddsRecords: CanonicalTheOddsApiRecord[]
  ): { fixtures: any[]; matchedCount: number } {
    if (!fixtures || fixtures.length === 0 || !oddsRecords || oddsRecords.length === 0) {
      return { fixtures: fixtures || [], matchedCount: 0 };
    }

    let matchedCount = 0;

    for (const fixture of fixtures) {
      const fKickMs = new Date(fixture.kickoffUtc).getTime();
      const homeNorm = (fixture.homeTeam || '').toLowerCase();
      const awayNorm = (fixture.awayTeam || '').toLowerCase();

      // Find all records matching this fixture
      const fixtureRecords = oddsRecords.filter((rec) => {
        // Direct canonical ID match if resolved
        if (rec.canonicalMatchId && rec.canonicalMatchId === fixture.fixtureId) {
          return true;
        }

        // Time window match (+/- 3 hours)
        const rKickMs = new Date(rec.kickoffUtc).getTime();
        if (isNaN(fKickMs) || isNaN(rKickMs) || Math.abs(fKickMs - rKickMs) > 3 * 3600 * 1000) {
          return false;
        }

        // Team names match
        return (
          DailyPicksEngine.matchTeams(homeNorm, (rec.homeTeam || '').toLowerCase()) &&
          DailyPicksEngine.matchTeams(awayNorm, (rec.awayTeam || '').toLowerCase())
        );
      });

      if (fixtureRecords.length === 0) continue;

      matchedCount++;
      if (!fixture.markets) {
        fixture.markets = {
          asianHandicap: { available: false, line: null, homeOdds: null, awayOdds: null },
          overUnder: { available: false, line: null, overOdds: null, underOdds: null },
          btts: { available: false, line: null, yesOdds: null, noOdds: null },
        };
      }

      // Prioritize Pinnacle records where available, otherwise first sharp bookmaker
      const pinnacleRecords = fixtureRecords.filter((r) => r.bookmaker.toLowerCase() === 'pinnacle');
      const candidateRecords = pinnacleRecords.length > 0 ? pinnacleRecords : fixtureRecords;

      // 1. Asian Handicap (AH)
      const ahRecords = candidateRecords.filter((r) => r.market === 'AH');
      if (ahRecords.length > 0) {
        // Find main line closest to zero or preferred quarter line
        const mainAh = ahRecords.find((r) => r.selection === 'HOME') || ahRecords[0];
        const awayAh = ahRecords.find((r) => r.selection === 'AWAY' && r.line === (mainAh.line !== null ? -mainAh.line : 0));

        if (mainAh && mainAh.oddsDecimal > 1.0) {
          fixture.markets.asianHandicap = {
            available: true,
            line: mainAh.line ?? -0.25,
            homeOdds: mainAh.homeOdds ?? mainAh.oddsDecimal,
            awayOdds: awayAh?.awayOdds ?? awayAh?.oddsDecimal ?? (mainAh.awayOdds || null),
          };
          fixture.hasPinnacleOdds = mainAh.bookmaker.toLowerCase() === 'pinnacle';
        }
      }

      // 2. Over / Under (OU)
      const ouRecords = candidateRecords.filter((r) => r.market === 'OU');
      if (ouRecords.length > 0) {
        // Default to 2.5 or 2.75/2.25 quarter lines
        const line25 = ouRecords.find((r) => r.line === 2.5) || ouRecords[0];
        const overRecord = ouRecords.find((r) => r.line === line25.line && r.selection.toLowerCase().includes('over'));
        const underRecord = ouRecords.find((r) => r.line === line25.line && r.selection.toLowerCase().includes('under'));

        if ((overRecord || line25) && (overRecord?.oddsDecimal || line25.oddsDecimal) > 1.0) {
          fixture.markets.overUnder = {
            available: true,
            line: line25.line ?? 2.5,
            overOdds: overRecord?.overOdds ?? overRecord?.oddsDecimal ?? (line25.overOdds || null),
            underOdds: underRecord?.underOdds ?? underRecord?.oddsDecimal ?? (line25.underOdds || null),
          };
        }
      }

      // 3. Both Teams To Score (BTTS)
      const bttsRecords = candidateRecords.filter((r) => r.market === 'BTTS');
      if (bttsRecords.length > 0) {
        const yesRecord = bttsRecords.find((r) => r.selection.toLowerCase() === 'yes') || bttsRecords[0];
        const noRecord = bttsRecords.find((r) => r.selection.toLowerCase() === 'no');

        if (yesRecord && yesRecord.oddsDecimal > 1.0) {
          fixture.markets.btts = {
            available: true,
            line: 0,
            yesOdds: yesRecord.yesOdds ?? yesRecord.oddsDecimal,
            noOdds: noRecord?.noOdds ?? noRecord?.oddsDecimal ?? (yesRecord.noOdds || null),
          };
        }
      }
    }

    return { fixtures, matchedCount };
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
