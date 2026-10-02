/**
 * DRIBBLE360 PROVIDER — Typed Provider Adapter
 * 
 * Implements the canonical provider abstraction for Dribble360 API.
 * Routes all traffic through the Provider Gateway for:
 *   - Quota management
 *   - Rate limiting
 *   - Caching
 *   - Deduplication
 *   - Audit logging
 *   - Circuit breaking
 *
 * Provider State: TRIAL_VALIDATION
 * Status: RESEARCH_ONLY — No public or paying-user exposure.
 *
 * @see EPIC §16 — Build Proper Provider Adapter
 * @see EPIC §17 — Error Classification
 * @see EPIC §18 — Usage Ledger
 */

import { globalGateway } from './providerGateway';
import { logger } from '@/lib/logger';
import type { Provider } from './quotaPolicy';
import { DribbleLiteQuotaGuard } from './dribbleLiteQuotaGuard';
import * as crypto from 'crypto';

// ============================================================================
// TYPES — Dribble360 Response Shapes
// ============================================================================

/** Provider state — never automatically mark ACTIVE (EPIC §16) */
export type Dribble360ProviderState =
  | 'TRIAL_VALIDATION'
  | 'RESEARCH_ONLY'
  | 'SECONDARY_CANDIDATE'
  | 'FALLBACK'
  | 'REJECTED'
  | 'SUSPENDED';

/** Error classification per EPIC §17 */
export type Dribble360ErrorClass =
  | 'AUTH_ERROR'
  | 'RATE_LIMIT'
  | 'TIMEOUT'
  | 'SERVER_ERROR'
  | 'BAD_REQUEST'
  | 'NOT_FOUND'
  | 'SCHEMA_ERROR'
  | 'DATA_QUALITY_ERROR'
  | 'NETWORK_ERROR';

export interface Dribble360Match {
  id: string | number;
  match_slug?: string;
  home_team?: string;
  away_team?: string;
  home_team_id?: string | number;
  away_team_id?: string | number;
  home_goals?: number | null;
  away_goals?: number | null;
  status?: string;
  kickoff?: string;
  date?: string;
  league_id?: string | number;
  league_name?: string;
  season?: string;
  competition_id?: string | number;
  expected_goals_home?: number | null;
  expected_goals_away?: number | null;
  last_updated?: string;
  [key: string]: any; // Allow additional fields discovered at runtime
}

export interface Dribble360TeamMatch {
  id: string | number;
  team_id?: string | number;
  team_name?: string;
  match_slug?: string;
  expected_goals?: number | null;
  expected_goals_conceded?: number | null;
  expected_assists?: number | null;
  shots?: number | null;
  shots_on_target?: number | null;
  total_scoring_att?: number | null;
  ontarget_scoring_att?: number | null;
  possession?: number | null;
  [key: string]: any;
}

export interface Dribble360League {
  id: string | number;
  name?: string;
  league_name?: string;
  country?: string;
  [key: string]: any;
}

export interface Dribble360PaginatedResponse<T> {
  rows?: T[];
  data?: T[];
  pagination?: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
  meta?: {
    pagination?: {
      page: number;
      per_page: number;
      total: number;
      total_pages: number;
    };
  };
}

/** Usage ledger record per EPIC §18 */
export interface Dribble360UsageRecord {
  timestamp: string;
  endpoint: string;
  parameterHash: string;
  httpStatus: number;
  latencyMs: number;
  bytes: number;
  recordsReturned: number;
  cacheHit: boolean;
  retryCount: number;
  purpose: string;
  errorClass: Dribble360ErrorClass | null;
  providerRequestId: string | null;
}

// ============================================================================
// PROVIDER CONFIGURATION
// ============================================================================

interface Dribble360Config {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  maxRetries: number;
  state: Dribble360ProviderState;
  syncEnabled: boolean;
}

function getDribble360Config(): Dribble360Config {
  const apiKey = process.env.DRIBBLE_API_KEY?.trim() || '';
  return {
    baseUrl: 'https://dribble360.com/api/v1',
    apiKey,
    timeoutMs: 30_000,
    maxRetries: 2,
    state: 'TRIAL_VALIDATION',
    syncEnabled: process.env.DRIBBLE360_SYNC_ENABLED === 'true', // EPIC §43: false by default
  };
}

// ============================================================================
// ERROR CLASSIFICATION
// ============================================================================

function classifyError(status: number, error?: any): Dribble360ErrorClass {
  if (status === 0) return 'NETWORK_ERROR';
  if (status === 401 || status === 403) return 'AUTH_ERROR';
  if (status === 429) return 'RATE_LIMIT';
  if (status === 400) return 'BAD_REQUEST';
  if (status === 404) return 'NOT_FOUND';
  if (status === 408) return 'TIMEOUT';
  if (status >= 500) return 'SERVER_ERROR';
  if (error?.name === 'AbortError' || error?.name === 'TimeoutError') return 'TIMEOUT';
  return 'NETWORK_ERROR';
}

// ============================================================================
// PROVIDER CLASS
// ============================================================================

export class Dribble360Provider {
  private static readonly PROVIDER: Provider = 'dribble360';
  private static readonly log = logger.child('dribble360-provider');
  private static usageLedger: Dribble360UsageRecord[] = [];

  /**
   * Check if the provider is configured (has an API key).
   */
  static isConfigured(): boolean {
    const config = getDribble360Config();
    return config.apiKey.length > 5 && !config.apiKey.includes('[SENSITIVE]');
  }

  /**
   * Get the current provider state.
   */
  static getState(): Dribble360ProviderState {
    return getDribble360Config().state;
  }

  /**
   * Check if sync to downstream consumers is enabled.
   * EPIC §43: DRIBBLE360_SYNC_ENABLED=false by default.
   */
  static isSyncEnabled(): boolean {
    return getDribble360Config().syncEnabled;
  }

  /**
   * Get usage statistics for the current session.
   */
  static getUsageStats(): {
    totalCalls: number;
    successCalls: number;
    failedCalls: number;
    cacheHits: number;
    totalBytes: number;
    totalRecords: number;
    avgLatencyMs: number;
    errorBreakdown: Record<string, number>;
  } {
    const stats = {
      totalCalls: this.usageLedger.length,
      successCalls: this.usageLedger.filter(r => r.httpStatus >= 200 && r.httpStatus < 300).length,
      failedCalls: this.usageLedger.filter(r => r.httpStatus < 200 || r.httpStatus >= 300).length,
      cacheHits: this.usageLedger.filter(r => r.cacheHit).length,
      totalBytes: this.usageLedger.reduce((sum, r) => sum + r.bytes, 0),
      totalRecords: this.usageLedger.reduce((sum, r) => sum + r.recordsReturned, 0),
      avgLatencyMs: 0,
      errorBreakdown: {} as Record<string, number>,
    };

    const latencies = this.usageLedger.map(r => r.latencyMs).filter(l => l > 0);
    stats.avgLatencyMs = latencies.length > 0
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : 0;

    for (const record of this.usageLedger) {
      if (record.errorClass) {
        stats.errorBreakdown[record.errorClass] = (stats.errorBreakdown[record.errorClass] || 0) + 1;
      }
    }

    return stats;
  }

  /**
   * Get the raw usage ledger.
   */
  static getUsageLedger(): Dribble360UsageRecord[] {
    return [...this.usageLedger];
  }

  // --------------------------------------------------------------------------
  // CORE FETCH — Routes through ProviderGateway
  // --------------------------------------------------------------------------

  private static endpointFromPath(urlPath: string): string {
    return urlPath.replace(/^\/+/, '').replace(/^api\/v1\//, '') || 'root';
  }

  /**
   * Execute an authenticated request to Dribble360 through the Provider Gateway.
   * All quota, rate limiting, caching, deduplication, and audit happen in the gateway.
   */
  static async fetch<T = any>(
    endpoint: string,
    params: Record<string, string | number> = {},
    purpose: string = 'general'
  ): Promise<{ data: T | null; status: number; latencyMs: number; error: Dribble360ErrorClass | null }> {
    const config = getDribble360Config();
    const startMs = Date.now();

    if (!this.isConfigured()) {
      this.log.warn('dribble360_not_configured', { endpoint });
      return { data: null, status: 401, latencyMs: 0, error: 'AUTH_ERROR' };
    }

    const url = new URL(`${config.baseUrl}${endpoint}`);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.append(k, String(v));
    }

    const paramHash = crypto
      .createHash('sha256')
      .update(JSON.stringify({ endpoint, params }))
      .digest('hex')
      .slice(0, 12);

    // Enforce Simulated Lite Quota Guard BEFORE making requests
    const liteReceipt = DribbleLiteQuotaGuard.reserve(endpoint, purpose, 1);
    if (!liteReceipt.ok) {
      this.log.warn('dribble360_lite_budget_blocked', { endpoint, reason: liteReceipt.reason });
      return { data: null, status: 429, latencyMs: 0, error: 'RATE_LIMIT' };
    }

    try {
      const response = await globalGateway.fetch(
        this.PROVIDER,
        this.endpointFromPath(endpoint),
        url.toString(),
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Accept': 'application/json',
            'User-Agent': 'HandicapLab-Dribble360/1.0',
          },
          quotaPriority: 60, // P2_DISCOVERY level for research work
        }
      );

      const latencyMs = Date.now() - startMs;
      const raw = await response.text();
      const bytes = raw.length;

      let data: T | null = null;
      try {
        data = JSON.parse(raw) as T;
      } catch {
        this.log.warn('dribble360_parse_error', { endpoint, raw: raw.slice(0, 200) });
      }

      const recordsReturned = this.countRecords(data);
      const errorClass = response.ok ? null : classifyError(response.status);

      // Confirm consumption in simulated Lite budget
      if (liteReceipt.reservationId) {
        DribbleLiteQuotaGuard.confirm(liteReceipt.reservationId, 1);
      }

      // Record in usage ledger (EPIC §18)
      this.usageLedger.push({
        timestamp: new Date().toISOString(),
        endpoint,
        parameterHash: paramHash,
        httpStatus: response.status,
        latencyMs,
        bytes,
        recordsReturned,
        cacheHit: response.headers.get('x-hl-source-status') === 'CACHE',
        retryCount: 0,
        purpose,
        errorClass,
        providerRequestId: response.headers.get('x-request-id') || null,
      });

      this.log.info('dribble360_request', {
        endpoint,
        status: response.status,
        latencyMs,
        records: recordsReturned,
        cacheHit: response.headers.get('x-hl-source-status') === 'CACHE',
        purpose,
      });

      return { data, status: response.status, latencyMs, error: errorClass };
    } catch (err: any) {
      if (liteReceipt.reservationId) {
        DribbleLiteQuotaGuard.rollback(liteReceipt.reservationId);
      }

      const latencyMs = Date.now() - startMs;
      const errorClass = classifyError(0, err);

      this.usageLedger.push({
        timestamp: new Date().toISOString(),
        endpoint,
        parameterHash: paramHash,
        httpStatus: 0,
        latencyMs,
        bytes: 0,
        recordsReturned: 0,
        cacheHit: false,
        retryCount: 0,
        purpose,
        errorClass,
        providerRequestId: null,
      });

      this.log.error('dribble360_request_failed', {
        endpoint,
        error: err.message,
        errorClass,
        latencyMs,
      });

      return { data: null, status: 0, latencyMs, error: errorClass };
    }
  }

  private static countRecords(data: any): number {
    if (!data) return 0;
    if (Array.isArray(data)) return data.length;
    if (Array.isArray(data?.rows)) return data.rows.length;
    if (Array.isArray(data?.data)) return data.data.length;
    return typeof data === 'object' ? 1 : 0;
  }

  // --------------------------------------------------------------------------
  // HIGH-LEVEL API METHODS
  // --------------------------------------------------------------------------

  /**
   * Fetch matches for a season.
   * Verified endpoint: GET /api/v1/matches?season=YYYY/YYYY
   */
  static async getMatches(
    season: string,
    extraParams: Record<string, string | number> = {}
  ): Promise<Dribble360PaginatedResponse<Dribble360Match>> {
    const { data } = await this.fetch<Dribble360PaginatedResponse<Dribble360Match>>(
      '/matches',
      { season, ...extraParams },
      `matches:${season}`
    );
    return data || { rows: [] };
  }

  /**
   * Fetch team-level match statistics.
   * Endpoint: GET /api/v1/team_matches?season=YYYY/YYYY
   */
  static async getTeamMatches(
    season: string,
    extraParams: Record<string, string | number> = {}
  ): Promise<Dribble360PaginatedResponse<Dribble360TeamMatch>> {
    const { data } = await this.fetch<Dribble360PaginatedResponse<Dribble360TeamMatch>>(
      '/team_matches',
      { season, ...extraParams },
      `team_matches:${season}`
    );
    return data || { rows: [] };
  }

  /**
   * Fetch player-level match statistics.
   */
  static async getPlayerMatches(
    season: string,
    extraParams: Record<string, string | number> = {}
  ): Promise<Dribble360PaginatedResponse<any>> {
    const { data } = await this.fetch<Dribble360PaginatedResponse<any>>(
      '/player_matches',
      { season, ...extraParams },
      `player_matches:${season}`
    );
    return data || { rows: [] };
  }

  /**
   * Fetch leagues/competitions.
   */
  static async getLeagues(): Promise<Dribble360PaginatedResponse<Dribble360League>> {
    const { data } = await this.fetch<Dribble360PaginatedResponse<Dribble360League>>(
      '/leagues',
      {},
      'leagues:discovery'
    );
    return data || { rows: [] };
  }

  /**
   * Fetch seasons.
   */
  static async getSeasons(): Promise<Dribble360PaginatedResponse<any>> {
    const { data } = await this.fetch<Dribble360PaginatedResponse<any>>(
      '/seasons',
      {},
      'seasons:discovery'
    );
    return data || { rows: [] };
  }

  /**
   * Fetch teams.
   */
  static async getTeams(
    extraParams: Record<string, string | number> = {}
  ): Promise<Dribble360PaginatedResponse<any>> {
    const { data } = await this.fetch<Dribble360PaginatedResponse<any>>(
      '/teams',
      extraParams,
      'teams:discovery'
    );
    return data || { rows: [] };
  }

  /**
   * Fetch standings.
   */
  static async getStandings(
    season: string,
    extraParams: Record<string, string | number> = {}
  ): Promise<Dribble360PaginatedResponse<any>> {
    const { data } = await this.fetch<Dribble360PaginatedResponse<any>>(
      '/standings',
      { season, ...extraParams },
      `standings:${season}`
    );
    return data || { rows: [] };
  }

  /**
   * Health check — lightweight ping to verify API connectivity.
   */
  static async healthCheck(): Promise<{
    healthy: boolean;
    latencyMs: number;
    error?: string;
    state: Dribble360ProviderState;
  }> {
    if (!this.isConfigured()) {
      return { healthy: false, latencyMs: 0, error: 'Not configured', state: this.getState() };
    }

    const startMs = Date.now();
    try {
      // Use a minimal call — seasons or leagues discovery
      const { status, latencyMs } = await this.fetch('/seasons', {}, 'health_check');
      return {
        healthy: status >= 200 && status < 300,
        latencyMs,
        state: this.getState(),
      };
    } catch (err: any) {
      return {
        healthy: false,
        latencyMs: Date.now() - startMs,
        error: err.message,
        state: this.getState(),
      };
    }
  }
}

export default Dribble360Provider;
