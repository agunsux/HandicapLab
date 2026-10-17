// ============================================================================
// THE ODDS API FREE-QUOTA ALLOCATOR & USAGE MANAGER (ATOMIC & CONCURRENCY-SAFE)
// ============================================================================
// Location: src/lib/providers/theOddsApiQuotaManager.ts
//
// Invariants enforced (Phase 2 Quota Policy):
// 1. Hard Monthly Limit: 500 requests/month (Free Tier).
// 2. Operational Ceiling: 350 requests/month.
// 3. Protected Contingency Reserve: 150 requests (untouchable by routine crons).
// 4. Soft Warning Threshold: 300 requests consumed (200 remaining).
// 5. Usable Operational Remaining = Math.max(0, totalRemaining - 150).
// 6. Concurrency-Safe: Atomic reservation via Supabase reserve_quota RPC (FOR UPDATE).
// 7. Fallback-Safe: In-memory/file fallback if DB unavailable (e.g. offline tests).
// 8. Unmetered Endpoints: /v4/sports, /v4/sports/{sport}/events, /health = 0 credits.
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  reserveQuota,
  confirmQuota,
  rollbackQuota,
  getQuotaSnapshot,
  type AcquireReceipt,
} from './quotaManagerV4';
import { isUnmeteredEndpoint } from './quotaPolicy';
import { supabase } from '@/lib/supabase.server';

export type TheOddsApiQuotaStatus =
  | 'NORMAL'
  | 'ECONOMY'
  | 'CRITICAL_QUOTA'
  | 'HARD_STOP'
  | 'EXHAUSTED';

export interface TheOddsApiCallRecord {
  requestId: string;
  provider: 'the-odds-api';
  endpoint: string;
  method: string;
  timestampUtc: string;
  cost: number;
  httpStatus: number | null;
  success: boolean;
  remainingBefore: number;
  remainingAfter?: number;
  creditsUsedReported?: number;
  latencyMs: number;
  error?: string | null;
}

export interface TheOddsApiQuotaState {
  totalMonthlyBudget: number;
  used: number;
  remaining: number;
  usableRemaining: number;
  reserveFloor: number;
  status: TheOddsApiQuotaStatus;
  lastSyncedAt: string;
}

const DEFAULT_BUDGET = 500;
const OPERATIONAL_CEILING = 350;
const RESERVE_FLOOR = 150; // 500 - 350 = 150 protected reserve
const WARNING_THRESHOLD = 300; // soft warning at 300 consumed

function getStateFilePath(): string {
  if (process.env.NODE_ENV === 'test') {
    return path.resolve('data/test_cache/the_odds_api_quota_state.json');
  }
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join(os.tmpdir(), 'handicaplab_the_odds_api_quota_state.json');
  }
  return path.resolve('data/cache/the_odds_api_quota_state.json');
}

function getAuditLogPath(): string {
  if (process.env.NODE_ENV === 'test') {
    return path.resolve('data/test_ledger/the_odds_api_call_audit.jsonl');
  }
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join(os.tmpdir(), 'handicaplab_the_odds_api_call_audit.jsonl');
  }
  return path.resolve('data/ledger/the_odds_api_call_audit.jsonl');
}

export class TheOddsApiQuotaManager {
  private static cachedState: TheOddsApiQuotaState | null = null;

  public static loadState(): TheOddsApiQuotaState {
    if (this.cachedState) return this.cachedState;

    const defaultState: TheOddsApiQuotaState = {
      totalMonthlyBudget: DEFAULT_BUDGET,
      used: 0,
      remaining: DEFAULT_BUDGET,
      usableRemaining: DEFAULT_BUDGET - RESERVE_FLOOR,
      reserveFloor: RESERVE_FLOOR,
      status: 'NORMAL',
      lastSyncedAt: new Date().toISOString(),
    };

    try {
      const p = getStateFilePath();
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          this.cachedState = { ...defaultState, ...parsed, reserveFloor: RESERVE_FLOOR };
          return this.cachedState!;
        }
      }
    } catch (e) {
      console.warn('[TheOddsApiQuotaManager] Load state warning:', e);
    }

    this.cachedState = defaultState;
    return defaultState;
  }

  public static saveState(state: TheOddsApiQuotaState): void {
    this.cachedState = state;
    try {
      const p = getStateFilePath();
      const dir = path.dirname(p);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(p, JSON.stringify(state, null, 2), 'utf8');
    } catch (e) {
      try {
        const fallback = path.join(os.tmpdir(), 'handicaplab_the_odds_api_quota_state.json');
        fs.writeFileSync(fallback, JSON.stringify(state, null, 2), 'utf8');
      } catch (err) {
        console.warn('[TheOddsApiQuotaManager] Save state warning:', err);
      }
    }
  }

  public static async syncWithDatabase(): Promise<TheOddsApiQuotaState> {
    try {
      const snapshot = await getQuotaSnapshot('the-odds-api');
      if (snapshot) {
        const remaining = snapshot.hardRemaining;
        const used = snapshot.used;
        const totalMonthlyBudget = snapshot.hardLimit || DEFAULT_BUDGET;
        const usableRemaining = Math.max(0, remaining - RESERVE_FLOOR);

        let status: TheOddsApiQuotaStatus = 'NORMAL';
        if (remaining <= 0) {
          status = 'EXHAUSTED';
        } else if (remaining <= 5) {
          status = 'HARD_STOP';
        } else if (remaining <= RESERVE_FLOOR) {
          status = 'CRITICAL_QUOTA';
        } else if (used >= WARNING_THRESHOLD) {
          status = 'ECONOMY';
        }

        const state: TheOddsApiQuotaState = {
          totalMonthlyBudget,
          used,
          remaining,
          usableRemaining,
          reserveFloor: RESERVE_FLOOR,
          status,
          lastSyncedAt: snapshot.updatedAt || new Date().toISOString(),
        };
        this.cachedState = state;
        return state;
      }
    } catch (err) {
      console.warn('[TheOddsApiQuotaManager] syncWithDatabase warning:', err);
    }

    return this.loadState();
  }

  public static async loadDurableState(): Promise<TheOddsApiQuotaState> {
    return this.syncWithDatabase();
  }

  /**
   * Pre-authorizes an outbound request against the 150-credit reserve floor.
   * Synchronous check against local/in-memory state.
   */
  public static authorizeRequest(
    endpoint: string,
    priority: number = 50,
    expectedCost: number = 1
  ): {
    allowed: boolean;
    reason?: string;
    state: TheOddsApiQuotaState;
  } {
    const state = this.loadState();

    // Endpoints that cost 0 (unmetered, e.g. /v4/sports or /events) are always allowed
    if (isUnmeteredEndpoint('the-odds-api', endpoint) || endpoint === 'sports' || endpoint === 'events' || endpoint === 'health') {
      return { allowed: true, state };
    }

    if (state.remaining <= 0) {
      return { allowed: false, reason: 'MONTHLY_QUOTA_EXHAUSTED', state };
    }

    if (state.remaining < expectedCost) {
      return { allowed: false, reason: `INSUFFICIENT_CREDITS: remaining ${state.remaining} < cost ${expectedCost}`, state };
    }

    if (state.remaining <= 5) {
      return { allowed: false, reason: 'HARD_STOP_ACTIVE', state };
    }

    // Safety floor protection: reserve 150 credits for critical / manual recovery operations
    if (state.remaining <= state.reserveFloor && priority < 90) {
      return {
        allowed: false,
        reason: `RESERVE_FLOOR_PROTECTED: ${state.remaining} credits remaining (< ${state.reserveFloor} reserve floor)`,
        state,
      };
    }

    // Check if expected cost would breach into reserve floor
    if (state.remaining - expectedCost < state.reserveFloor && priority < 90) {
      return {
        allowed: false,
        reason: `RESERVE_FLOOR_BREACH: request cost ${expectedCost} would reduce balance to ${state.remaining - expectedCost} (< ${state.reserveFloor} reserve floor)`,
        state,
      };
    }

    return { allowed: true, state };
  }

  /**
   * Concurrency-safe atomic reservation via database RPC (reserve_quota).
   * Falls back to authorizeRequest if database RPC is not configured.
   */
  public static async reserveAtomic(params: {
    endpoint: string;
    priority: number;
    requestId: string;
    expectedCost: number;
  }): Promise<{
    allowed: boolean;
    reservationId?: string;
    reason?: string;
    state: TheOddsApiQuotaState;
  }> {
    const { endpoint, priority, requestId, expectedCost } = params;

    // Check zero-credit endpoints first
    if (isUnmeteredEndpoint('the-odds-api', endpoint) || endpoint === 'sports' || endpoint === 'events' || endpoint === 'health') {
      return { allowed: true, state: this.loadState() };
    }

    // First check synchronous guard
    const auth = this.authorizeRequest(endpoint, priority, expectedCost);
    if (!auth.allowed) {
      return { allowed: false, reason: auth.reason, state: auth.state };
    }

    // Try atomic DB reservation
    try {
      const receipt: AcquireReceipt = await reserveQuota(
        'the-odds-api',
        endpoint,
        priority,
        requestId,
        expectedCost
      );

      if (!receipt.ok) {
        if (receipt.reason === 'RPC_ERROR' || receipt.reason === 'UNAVAILABLE' || process.env.NODE_ENV === 'test') {
          return {
            allowed: auth.allowed,
            reservationId: receipt.reservationId || `local_res_${requestId}`,
            reason: auth.reason,
            state: auth.state,
          };
        }
        return {
          allowed: false,
          reason: receipt.reason || 'DB_RESERVATION_BLOCKED',
          state: this.loadState(),
        };
      }

      return {
        allowed: true,
        reservationId: receipt.reservationId,
        state: this.loadState(),
      };
    } catch (dbErr) {
      console.warn('[TheOddsApiQuotaManager] DB reservation failed, evaluating local guard:', dbErr);
      return {
        allowed: auth.allowed,
        reservationId: `local_res_${requestId}`,
        reason: auth.reason,
        state: auth.state,
      };
    }
  }

  /**
   * Confirms an executed call, reconciles database quota state,
   * and updates local state based on reported response headers.
   */
  public static async confirmAtomic(params: {
    reservationId?: string;
    requestId: string;
    endpoint: string;
    method: string;
    actualCost: number;
    httpStatus: number | null;
    success: boolean;
    latencyMs: number;
    headers?: Headers | Record<string, string | null>;
    error?: string | null;
  }): Promise<TheOddsApiQuotaState> {
    const state = this.loadState();
    const remainingBefore = state.remaining;

    let headersRemaining: number | null = null;
    let headersUsed: number | null = null;

    if (params.headers) {
      const getH = (key: string): string | null => {
        if ('get' in params.headers! && typeof params.headers.get === 'function') {
          return params.headers.get(key);
        }
        return (params.headers as Record<string, string | null>)[key] || null;
      };

      const remStr = getH('x-requests-remaining');
      const usedStr = getH('x-requests-used');
      if (remStr !== null && !isNaN(Number(remStr))) headersRemaining = Number(remStr);
      if (usedStr !== null && !isNaN(Number(usedStr))) headersUsed = Number(usedStr);
    }

    // Confirm DB reservation atomically
    if (params.reservationId) {
      try {
        await confirmQuota(
          params.reservationId,
          params.actualCost,
          state.totalMonthlyBudget,
          headersRemaining ?? undefined
        );
      } catch (err) {
        console.warn('[TheOddsApiQuotaManager] confirmQuota DB error:', err);
      }
    }

    // Update state based on authoritative headers or cost
    if (headersRemaining !== null) {
      state.remaining = headersRemaining;
      state.used = headersUsed !== null ? headersUsed : state.totalMonthlyBudget - headersRemaining;
    } else if (params.success && params.actualCost > 0) {
      state.used += params.actualCost;
      state.remaining = Math.max(0, state.totalMonthlyBudget - state.used);
    }

    state.usableRemaining = Math.max(0, state.remaining - state.reserveFloor);

    // Compute status with 150 reserve floor and 300 warning threshold
    if (state.remaining <= 0) {
      state.status = 'EXHAUSTED';
    } else if (state.remaining <= 5) {
      state.status = 'HARD_STOP';
    } else if (state.remaining <= state.reserveFloor) {
      state.status = 'CRITICAL_QUOTA'; // Under 150 reserve floor
    } else if (state.used >= WARNING_THRESHOLD) {
      state.status = 'ECONOMY'; // Over 300 consumed
    } else {
      state.status = 'NORMAL';
    }

    state.lastSyncedAt = new Date().toISOString();
    this.saveState(state);

    // Append to JSONL audit log
    const auditRecord: TheOddsApiCallRecord = {
      requestId: params.requestId,
      provider: 'the-odds-api',
      endpoint: params.endpoint,
      method: params.method,
      timestampUtc: new Date().toISOString(),
      cost: params.actualCost,
      httpStatus: params.httpStatus,
      success: params.success,
      remainingBefore,
      remainingAfter: state.remaining,
      creditsUsedReported: headersUsed ?? undefined,
      latencyMs: params.latencyMs,
      error: params.error ?? null,
    };

    try {
      const logPath = getAuditLogPath();
      const dir = path.dirname(logPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.appendFileSync(logPath, JSON.stringify(auditRecord) + '\n', 'utf8');
    } catch {
      // Non-blocking log failure
    }

    // Persist to Supabase provider_logs for durable multi-instance audit trail
    try {
      if (supabase && (process.env.VERCEL || process.env.K_SERVICE || process.env.NODE_ENV === 'production')) {
        await supabase.from('provider_logs').insert({
          provider: 'the-odds-api',
          endpoint: params.endpoint,
          level: params.success ? 'INFO' : 'ERROR',
          message: `${params.method} ${params.endpoint} cost=${params.actualCost} status=${params.httpStatus}`,
          latency_ms: params.latencyMs,
          metadata: {
            requestId: params.requestId,
            remainingBefore,
            remainingAfter: state.remaining,
            cost: params.actualCost,
            headersUsed: headersUsed ?? undefined,
            error: params.error ?? null,
          },
        });
      }
    } catch {
      // Non-blocking log sink
    }

    return state;
  }

  /**
   * Safely rolls back a reservation when an error or rejection occurs before execution.
   */
  public static async rollbackAtomic(reservationId?: string): Promise<void> {
    if (!reservationId) return;
    try {
      await rollbackQuota(reservationId);
    } catch (err) {
      console.warn('[TheOddsApiQuotaManager] rollbackQuota error:', err);
    }
  }

  /**
   * Synchronous recording backwards compatibility.
   */
  public static recordExecution(params: {
    requestId: string;
    endpoint: string;
    method: string;
    cost: number;
    httpStatus: number | null;
    success: boolean;
    latencyMs: number;
    headers?: Headers | Record<string, string | null>;
    error?: string | null;
  }): TheOddsApiQuotaState {
    const state = this.loadState();
    const remainingBefore = state.remaining;

    let headersRemaining: number | null = null;
    let headersUsed: number | null = null;

    if (params.headers) {
      const getH = (key: string): string | null => {
        if ('get' in params.headers! && typeof params.headers.get === 'function') {
          return params.headers.get(key);
        }
        return (params.headers as Record<string, string | null>)[key] || null;
      };

      const remStr = getH('x-requests-remaining');
      const usedStr = getH('x-requests-used');
      if (remStr !== null && !isNaN(Number(remStr))) headersRemaining = Number(remStr);
      if (usedStr !== null && !isNaN(Number(usedStr))) headersUsed = Number(usedStr);
    }

    if (headersRemaining !== null) {
      state.remaining = headersRemaining;
      state.used = headersUsed !== null ? headersUsed : state.totalMonthlyBudget - headersRemaining;
    } else if (params.success && params.cost > 0) {
      state.used += params.cost;
      state.remaining = Math.max(0, state.totalMonthlyBudget - state.used);
    }

    state.usableRemaining = Math.max(0, state.remaining - state.reserveFloor);

    if (state.remaining <= 0) {
      state.status = 'EXHAUSTED';
    } else if (state.remaining <= 5) {
      state.status = 'HARD_STOP';
    } else if (state.remaining <= state.reserveFloor) {
      state.status = 'CRITICAL_QUOTA';
    } else if (state.used >= WARNING_THRESHOLD) {
      state.status = 'ECONOMY';
    } else {
      state.status = 'NORMAL';
    }

    state.lastSyncedAt = new Date().toISOString();
    this.saveState(state);
    return state;
  }

  public static getStatus(): TheOddsApiQuotaState {
    return this.loadState();
  }

  public static resetStateForTest(customState?: Partial<TheOddsApiQuotaState>): void {
    this.cachedState = {
      totalMonthlyBudget: DEFAULT_BUDGET,
      used: 0,
      remaining: DEFAULT_BUDGET,
      usableRemaining: DEFAULT_BUDGET - RESERVE_FLOOR,
      reserveFloor: RESERVE_FLOOR,
      status: 'NORMAL',
      lastSyncedAt: new Date().toISOString(),
      ...customState,
    };
  }
}
