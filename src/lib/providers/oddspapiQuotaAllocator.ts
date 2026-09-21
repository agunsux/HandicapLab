// ============================================================================
// ODDSPAPI FREE-QUOTA ALLOCATOR & TIERED BUDGET MANAGER
// ============================================================================
// Location: src/lib/providers/oddspapiQuotaAllocator.ts
//
// Strictly manages OddsPapi Free Tier consumption (250 req/month).
// Prevents any single league from consuming the entire monthly budget.
//
// Quota & Safety Constraints:
//   - Provider Contractual Hard Limit: 250 requests/month
//   - Protected Reserve Floor: 50 requests (untouchable capacity)
//   - Usable Operational Remaining = Math.max(0, totalRemaining - 50)
//   - Hard Stop: <= 5 requests remaining -> all requests blocked
//   - Critical Quota: <= 20 requests remaining -> only CRITICAL requests allowed
//   - Emergency Reserve Active: <= 50 requests remaining -> operational requests blocked
//
// Tier budget reservations (applied to operational budget):
//   - Tier A (Primary Top Leagues): 60%
//   - Tier B (Secondary Europe): 25%
//   - Tier C (Global Expansion): 10%
//   - Safety Buffer: 5%
// ============================================================================

import { LeagueTier } from '@/lib/config/multiLeagueRegistry';
import * as fs from 'fs';
import * as path from 'path';

export type OddsRequestPriority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';

export type QuotaStatus =
  | 'NORMAL'
  | 'ECONOMY'
  | 'EMERGENCY_RESERVE_ACTIVE'
  | 'CRITICAL_QUOTA'
  | 'HARD_STOP'
  | 'EXHAUSTED';

export interface QuotaAllocationStatus {
  totalMonthlyBudget: number;
  totalUsed: number;
  totalRemaining: number;
  usableRemaining: number;
  reserveFloor: number;
  providerLimit: number;
  providerCount: number;
  status: QuotaStatus;
  tierBudgets: Record<LeagueTier, {
    allocatedBudget: number;
    used: number;
    remaining: number;
  }>;
  bufferBudget: {
    allocatedBudget: number;
    used: number;
    remaining: number;
  };
  leagueUsage: Record<string, number>;
  lastSyncedAt: string;
}

export interface QuotaAcquireDecision {
  allowed: boolean;
  reason: string;
  priority: OddsRequestPriority;
  leagueId: string;
  tier: LeagueTier;
  cost: number;
  reservationToken?: string;
  usableRemaining?: number;
}

export interface OddsPapiCallRecord {
  timestamp: string;
  reservationId: string;
  fixtureId?: string | number;
  market?: string;
  endpoint: string;
  billable: boolean;
  cost: number;
  countBefore: number;
  countAfter: number;
  remainingBefore: number;
  remainingAfter: number;
  usableRemainingBefore: number;
  usableRemainingAfter: number;
  status: QuotaStatus;
}

function getStateFilePath(): string {
  return process.env.NODE_ENV === 'test'
    ? path.resolve('data/test_cache/oddspapi_quota_allocator_state.json')
    : path.resolve('data/cache/oddspapi_quota_allocator_state.json');
}

function getAuditLogPath(): string {
  return process.env.NODE_ENV === 'test'
    ? path.resolve('data/test_ledger/oddspapi_call_audit.jsonl')
    : path.resolve('data/ledger/oddspapi_call_audit.jsonl');
}

export class OddsPapiQuotaAllocator {
  private static cachedState: QuotaAllocationStatus | null = null;
  private static lastAccountFetchMs: number = 0;
  private static readonly ACCOUNT_TTL_MS = 120_000; // 2 minutes cache for unmetered /account

  public static readonly RESERVE_FLOOR = 50;

  // Tier allocation ratios (must sum to 1.0)
  public static readonly TIER_RATIOS: Record<LeagueTier, number> = {
    A: 0.60,
    B: 0.25,
    C: 0.10,
  };
  public static readonly BUFFER_RATIO = 0.05;

  // Single league max consumption cap (percentage of total monthly budget)
  public static readonly MAX_LEAGUE_PERCENT = 0.25; // 25% max for any one league

  public static computeStatus(remaining: number): QuotaStatus {
    if (remaining <= 0) return 'EXHAUSTED';
    if (remaining <= 5) return 'HARD_STOP';
    if (remaining <= 20) return 'CRITICAL_QUOTA';
    if (remaining <= this.RESERVE_FLOOR) return 'EMERGENCY_RESERVE_ACTIVE';
    if (remaining < 75) return 'ECONOMY';
    return 'NORMAL';
  }

  /**
   * Initializes or loads allocator state from persistent disk cache.
   */
  public static loadState(): QuotaAllocationStatus {
    if (this.cachedState) return this.cachedState;

    const defaultBudget = 250;
    const defaultUsed = 152;
    const defaultRemaining = Math.max(0, defaultBudget - defaultUsed);
    const usable = Math.max(0, defaultRemaining - this.RESERVE_FLOOR);

    const defaultState: QuotaAllocationStatus = {
      totalMonthlyBudget: defaultBudget,
      totalUsed: defaultUsed,
      totalRemaining: defaultRemaining,
      usableRemaining: usable,
      reserveFloor: this.RESERVE_FLOOR,
      providerLimit: defaultBudget,
      providerCount: defaultUsed,
      status: this.computeStatus(defaultRemaining),
      tierBudgets: {
        A: { allocatedBudget: Math.floor(defaultBudget * this.TIER_RATIOS.A), used: 0, remaining: Math.floor(defaultBudget * this.TIER_RATIOS.A) },
        B: { allocatedBudget: Math.floor(defaultBudget * this.TIER_RATIOS.B), used: 0, remaining: Math.floor(defaultBudget * this.TIER_RATIOS.B) },
        C: { allocatedBudget: Math.floor(defaultBudget * this.TIER_RATIOS.C), used: 0, remaining: Math.floor(defaultBudget * this.TIER_RATIOS.C) },
      },
      bufferBudget: {
        allocatedBudget: Math.floor(defaultBudget * this.BUFFER_RATIO),
        used: 0,
        remaining: Math.floor(defaultBudget * this.BUFFER_RATIO),
      },
      leagueUsage: {},
      lastSyncedAt: new Date().toISOString(),
    };

    try {
      const filePath = getStateFilePath();
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.totalMonthlyBudget === 'number') {
          parsed.reserveFloor = this.RESERVE_FLOOR;
          parsed.usableRemaining = Math.max(0, (parsed.totalRemaining ?? 0) - this.RESERVE_FLOOR);
          parsed.status = this.computeStatus(parsed.totalRemaining ?? 0);
          this.cachedState = parsed;
          return parsed;
        }
      }
    } catch {}

    this.cachedState = defaultState;
    this.saveState(defaultState);
    return defaultState;
  }

  public static saveState(state: QuotaAllocationStatus): void {
    try {
      const filePath = getStateFilePath();
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf8');
    } catch {}
    this.cachedState = state;
  }

  /**
   * Reconciles allocator state with live unmetered /v4/account.
   */
  public static async syncFromProviderAccount(apiKey?: string): Promise<QuotaAllocationStatus> {
    const now = Date.now();
    const state = this.loadState();

    if (now - this.lastAccountFetchMs < this.ACCOUNT_TTL_MS) {
      return state;
    }

    const key = (apiKey || process.env.ODDS_PAPI_KEY || process.env.ODDSPAPI_KEY || '').replace(/['`"]/g, '').trim();
    if (!key) return state;

    try {
      const res = await fetch(`https://api.oddspapi.io/v4/account?apiKey=${key}`);
      if (res.ok) {
        const data = await res.json();
        const sub = data.subscriptions?.[0];
        if (sub) {
          const limit = sub.request_limit || 250;
          const count = sub.request_count || 0;
          const remaining = Math.max(0, limit - count);
          const usable = Math.max(0, remaining - this.RESERVE_FLOOR);

          state.providerLimit = limit;
          state.providerCount = count;
          state.totalMonthlyBudget = limit;
          state.totalRemaining = remaining;
          state.usableRemaining = usable;
          state.reserveFloor = this.RESERVE_FLOOR;
          state.totalUsed = count;
          state.status = this.computeStatus(remaining);
          state.lastSyncedAt = new Date().toISOString();

          // Re-calculate tier allowances proportionally
          state.tierBudgets.A.allocatedBudget = Math.floor(limit * this.TIER_RATIOS.A);
          state.tierBudgets.A.remaining = Math.max(0, state.tierBudgets.A.allocatedBudget - state.tierBudgets.A.used);

          state.tierBudgets.B.allocatedBudget = Math.floor(limit * this.TIER_RATIOS.B);
          state.tierBudgets.B.remaining = Math.max(0, state.tierBudgets.B.allocatedBudget - state.tierBudgets.B.used);

          state.tierBudgets.C.allocatedBudget = Math.floor(limit * this.TIER_RATIOS.C);
          state.tierBudgets.C.remaining = Math.max(0, state.tierBudgets.C.allocatedBudget - state.tierBudgets.C.used);

          state.bufferBudget.allocatedBudget = Math.floor(limit * this.BUFFER_RATIO);
          state.bufferBudget.remaining = Math.max(0, state.bufferBudget.allocatedBudget - state.bufferBudget.used);

          this.saveState(state);
          this.lastAccountFetchMs = now;
        }
      }
    } catch (e) {
      console.warn('[OddsPapiQuotaAllocator] Failed to sync /v4/account:', e);
    }

    return state;
  }

  /**
   * Evaluates whether an odds request is allowed under tier quotas, reserve floor, and priority gates.
   */
  public static canAcquire(params: {
    leagueId: string;
    tier: LeagueTier;
    priority: OddsRequestPriority;
    cost?: number;
  }): QuotaAcquireDecision {
    const { leagueId, tier, priority, cost = 1 } = params;
    const state = this.loadState();
    const usable = Math.max(0, state.totalRemaining - this.RESERVE_FLOOR);

    // 1. Hard exhaustion check
    if (state.totalRemaining <= 0 || state.status === 'EXHAUSTED') {
      return {
        allowed: false,
        reason: 'QUOTA_EXHAUSTED: Monthly provider limit reached.',
        priority,
        leagueId,
        tier,
        cost,
        usableRemaining: 0,
      };
    }

    // 2. Hard Stop check (<= 5)
    if (state.totalRemaining <= 5) {
      return {
        allowed: false,
        reason: `HARD_STOP: Quota at ${state.totalRemaining} requests (<= 5). All requests blocked.`,
        priority,
        leagueId,
        tier,
        cost,
        usableRemaining: 0,
      };
    }

    // 3. Critical Quota check (<= 20)
    if (state.totalRemaining <= 20 && priority !== 'CRITICAL') {
      return {
        allowed: false,
        reason: `CRITICAL_QUOTA: Quota at ${state.totalRemaining} requests (<= 20). Only CRITICAL priority allowed.`,
        priority,
        leagueId,
        tier,
        cost,
        usableRemaining: 0,
      };
    }

    // 4. Reserve Floor Protection (<= 50)
    if (state.totalRemaining <= this.RESERVE_FLOOR && priority !== 'CRITICAL') {
      return {
        allowed: false,
        reason: `EMERGENCY_RESERVE_ACTIVE: Quota at ${state.totalRemaining} requests (<= ${this.RESERVE_FLOOR} reserve floor). Operational requests blocked.`,
        priority,
        leagueId,
        tier,
        cost,
        usableRemaining: 0,
      };
    }

    // 5. Cost would breach Reserve Floor
    if (state.totalRemaining - cost < this.RESERVE_FLOOR && priority !== 'CRITICAL') {
      return {
        allowed: false,
        reason: `EMERGENCY_RESERVE_ACTIVE: Request cost (${cost}) would breach reserve floor (${state.totalRemaining} - ${cost} < ${this.RESERVE_FLOOR}).`,
        priority,
        leagueId,
        tier,
        cost,
        usableRemaining: usable,
      };
    }

    // 6. Economy mode: If usable remaining < 25 (total remaining < 75), reject LOW priority
    if (usable < 25 && priority === 'LOW') {
      return {
        allowed: false,
        reason: `ECONOMY_MODE_ACTIVE: LOW priority rejected with ${usable} usable remaining.`,
        priority,
        leagueId,
        tier,
        cost,
        usableRemaining: usable,
      };
    }

    // 7. Per-league hard ceiling: No single league can exceed 25% of total budget
    const leagueUsage = state.leagueUsage[leagueId] || 0;
    const leagueCeiling = Math.floor(state.totalMonthlyBudget * this.MAX_LEAGUE_PERCENT);
    if (leagueUsage + cost > leagueCeiling && priority !== 'CRITICAL') {
      return {
        allowed: false,
        reason: `LEAGUE_CEILING_EXCEEDED: League ${leagueId} used ${leagueUsage}/${leagueCeiling} limit.`,
        priority,
        leagueId,
        tier,
        cost,
        usableRemaining: usable,
      };
    }

    // 8. Tier budget check
    const tierBudget = state.tierBudgets[tier];
    if (tierBudget && tierBudget.remaining < cost && priority !== 'CRITICAL') {
      return {
        allowed: false,
        reason: `TIER_${tier}_BUDGET_EXHAUSTED: Tier ${tier} quota depleted (${tierBudget.used}/${tierBudget.allocatedBudget}).`,
        priority,
        leagueId,
        tier,
        cost,
        usableRemaining: usable,
      };
    }

    const token = `res_${leagueId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    return {
      allowed: true,
      reason: 'ACQUIRE_PERMITTED',
      priority,
      leagueId,
      tier,
      cost,
      reservationToken: token,
      usableRemaining: usable,
    };
  }

  /**
   * Commits usage after successful execution and records call instrumentation.
   */
  public static recordUsage(params: {
    leagueId: string;
    tier: LeagueTier;
    cost?: number;
    fixtureId?: string | number;
    market?: string;
    endpoint?: string;
    reservationId?: string;
    billable?: boolean;
  }): OddsPapiCallRecord {
    const {
      leagueId,
      tier,
      cost = 1,
      fixtureId,
      market,
      endpoint = 'odds-by-tournaments',
      reservationId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      billable = true,
    } = params;

    const state = this.loadState();

    const countBefore = state.totalUsed;
    const remainingBefore = state.totalRemaining;
    const usableBefore = state.usableRemaining;

    if (billable) {
      state.totalUsed += cost;
      state.totalRemaining = Math.max(0, state.totalRemaining - cost);
      state.providerCount += cost;

      if (state.tierBudgets[tier]) {
        state.tierBudgets[tier].used += cost;
        state.tierBudgets[tier].remaining = Math.max(
          0,
          state.tierBudgets[tier].allocatedBudget - state.tierBudgets[tier].used
        );
      }

      state.leagueUsage[leagueId] = (state.leagueUsage[leagueId] || 0) + cost;
    }

    state.usableRemaining = Math.max(0, state.totalRemaining - this.RESERVE_FLOOR);
    state.status = this.computeStatus(state.totalRemaining);
    state.lastSyncedAt = new Date().toISOString();

    this.saveState(state);

    const callRecord: OddsPapiCallRecord = {
      timestamp: new Date().toISOString(),
      reservationId,
      fixtureId,
      market,
      endpoint,
      billable,
      cost,
      countBefore,
      countAfter: state.totalUsed,
      remainingBefore,
      remainingAfter: state.totalRemaining,
      usableRemainingBefore: usableBefore,
      usableRemainingAfter: state.usableRemaining,
      status: state.status,
    };

    // Append to durable call audit log
    try {
      const logPath = getAuditLogPath();
      const dir = path.dirname(logPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.appendFileSync(logPath, JSON.stringify(callRecord) + '\n', 'utf8');
    } catch (logErr) {
      console.warn('[OddsPapiQuotaAllocator] Failed to write call audit log:', logErr);
    }

    return callRecord;
  }

  /**
   * Reads call audit log entries.
   */
  public static getCallAudit(since?: Date): OddsPapiCallRecord[] {
    try {
      const logPath = getAuditLogPath();
      if (!fs.existsSync(logPath)) return [];
      const lines = fs.readFileSync(logPath, 'utf8').split('\n').filter(Boolean);
      const records: OddsPapiCallRecord[] = lines.map((l) => JSON.parse(l));
      if (!since) return records;
      return records.filter((r) => new Date(r.timestamp).getTime() >= since.getTime());
    } catch {
      return [];
    }
  }

  /**
   * Resets usage for local testing or new month roll.
   */
  public static resetState(customBudget?: number, customUsed?: number): void {
    const budget = customBudget ?? 250;
    const used = customUsed ?? 0;
    const remaining = Math.max(0, budget - used);
    const usable = Math.max(0, remaining - this.RESERVE_FLOOR);

    const state: QuotaAllocationStatus = {
      totalMonthlyBudget: budget,
      totalUsed: used,
      totalRemaining: remaining,
      usableRemaining: usable,
      reserveFloor: this.RESERVE_FLOOR,
      providerLimit: budget,
      providerCount: used,
      status: this.computeStatus(remaining),
      tierBudgets: {
        A: { allocatedBudget: Math.floor(budget * this.TIER_RATIOS.A), used: 0, remaining: Math.floor(budget * this.TIER_RATIOS.A) },
        B: { allocatedBudget: Math.floor(budget * this.TIER_RATIOS.B), used: 0, remaining: Math.floor(budget * this.TIER_RATIOS.B) },
        C: { allocatedBudget: Math.floor(budget * this.TIER_RATIOS.C), used: 0, remaining: Math.floor(budget * this.TIER_RATIOS.C) },
      },
      bufferBudget: {
        allocatedBudget: Math.floor(budget * this.BUFFER_RATIO),
        used: 0,
        remaining: Math.floor(budget * this.BUFFER_RATIO),
      },
      leagueUsage: {},
      lastSyncedAt: new Date().toISOString(),
    };
    this.saveState(state);
  }
}
