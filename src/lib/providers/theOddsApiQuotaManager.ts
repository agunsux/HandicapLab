// ============================================================================
// THE ODDS API FREE-QUOTA ALLOCATOR & USAGE MANAGER
// ============================================================================
// Location: src/lib/providers/theOddsApiQuotaManager.ts
//
// Invariants enforced:
// 1. Hard Monthly Limit: 500 requests/month (Free Tier).
// 2. Protected Safety Floor: 50 requests (untouchable reserve).
// 3. Usable Operational Remaining = Math.max(0, totalRemaining - 50).
// 4. Request Authorization: Every request must be pre-authorized before dispatch.
// 5. Atomic Audit Logging: Records provider, endpoint, timestamp, credits,
//    success/failure, HTTP status, and remaining quota.
// 6. Zero Mock Quota: Headers (x-requests-remaining, x-requests-used) are used
//    as live ground truth whenever returned by provider.
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

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
const RESERVE_FLOOR = 50;

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
          this.cachedState = { ...defaultState, ...parsed };
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

  /**
   * Pre-authorizes an outbound request against the safety quota floor.
   */
  public static authorizeRequest(endpoint: string, priority: number = 50): {
    allowed: boolean;
    reason?: string;
    state: TheOddsApiQuotaState;
  } {
    const state = this.loadState();

    // Endpoints that cost 0 (unmetered, e.g. /v4/sports or health) are always allowed if not hard stop
    if (endpoint === 'sports' || endpoint === 'health') {
      return { allowed: true, state };
    }

    if (state.remaining <= 0) {
      return { allowed: false, reason: 'MONTHLY_QUOTA_EXHAUSTED', state };
    }

    if (state.remaining <= 5) {
      return { allowed: false, reason: 'HARD_STOP_ACTIVE', state };
    }

    // Safety floor protection: reserve 50 requests for P0/Critical operations
    if (state.remaining <= state.reserveFloor && priority < 90) {
      return {
        allowed: false,
        reason: `RESERVE_FLOOR_PROTECTED: ${state.remaining} credits remaining (< ${state.reserveFloor} reserve floor)`,
        state,
      };
    }

    return { allowed: true, state };
  }

  /**
   * Records an executed call and updates quota state based on reported response headers.
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

    // Update state based on authoritative headers or estimated consumption
    if (headersRemaining !== null) {
      state.remaining = headersRemaining;
      state.used = headersUsed !== null ? headersUsed : state.totalMonthlyBudget - headersRemaining;
    } else if (params.success && params.cost > 0) {
      state.used += params.cost;
      state.remaining = Math.max(0, state.totalMonthlyBudget - state.used);
    }

    state.usableRemaining = Math.max(0, state.remaining - state.reserveFloor);

    // Compute status
    if (state.remaining <= 0) {
      state.status = 'EXHAUSTED';
    } else if (state.remaining <= 5) {
      state.status = 'HARD_STOP';
    } else if (state.remaining <= 20) {
      state.status = 'CRITICAL_QUOTA';
    } else if (state.remaining <= state.reserveFloor) {
      state.status = 'ECONOMY';
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
      cost: params.cost,
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
    } catch (e) {
      // Non-blocking log failure
    }

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
