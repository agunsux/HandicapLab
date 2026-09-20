// ============================================================================
// ODDSPAPI FREE-QUOTA ALLOCATOR & TIERED BUDGET MANAGER
// ============================================================================
// Location: src/lib/providers/oddspapiQuotaAllocator.ts
//
// Strictly manages OddsPapi Free Tier consumption (250 req/month).
// Prevents any single league from consuming the entire monthly budget.
// Tier budget reservations:
//   - Tier A (Primary): 60% (~150 requests/month)
//   - Tier B (Secondary Europe): 25% (~62 requests/month)
//   - Tier C (Global Expansion): 10% (~25 requests/month)
//   - Retry / Safety Buffer: 5% (~13 requests/month)
// ============================================================================

import { LeagueTier } from '@/lib/config/multiLeagueRegistry';
import * as fs from 'fs';
import * as path from 'path';

export type OddsRequestPriority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';

export interface QuotaAllocationStatus {
  totalMonthlyBudget: number;
  totalUsed: number;
  totalRemaining: number;
  providerLimit: number;
  providerCount: number;
  status: 'NORMAL' | 'ECONOMY' | 'CRITICAL' | 'EXHAUSTED';
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
}

const STATE_FILE_PATH = path.resolve('data/cache/oddspapi_quota_allocator_state.json');

export class OddsPapiQuotaAllocator {
  private static cachedState: QuotaAllocationStatus | null = null;
  private static lastAccountFetchMs: number = 0;
  private static readonly ACCOUNT_TTL_MS = 120_000; // 2 minutes cache for unmetered /account

  // Tier allocation ratios (must sum to 1.0)
  public static readonly TIER_RATIOS: Record<LeagueTier, number> = {
    A: 0.60,
    B: 0.25,
    C: 0.10,
  };
  public static readonly BUFFER_RATIO = 0.05;

  // Single league max consumption cap (percentage of total monthly budget)
  public static readonly MAX_LEAGUE_PERCENT = 0.25; // 25% max for any one league

  /**
   * Initializes or loads allocator state from persistent disk cache.
   */
  public static loadState(): QuotaAllocationStatus {
    if (this.cachedState) return this.cachedState;

    const defaultBudget = 250;
    const defaultState: QuotaAllocationStatus = {
      totalMonthlyBudget: defaultBudget,
      totalUsed: 122, // Known baseline from account probe
      totalRemaining: 128,
      providerLimit: 250,
      providerCount: 122,
      status: 'NORMAL',
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
      if (fs.existsSync(STATE_FILE_PATH)) {
        const raw = fs.readFileSync(STATE_FILE_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.totalMonthlyBudget === 'number') {
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
      const dir = path.dirname(STATE_FILE_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(state, null, 2), 'utf8');
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

          state.providerLimit = limit;
          state.providerCount = count;
          state.totalMonthlyBudget = limit;
          state.totalRemaining = remaining;
          state.totalUsed = count;
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

          if (remaining === 0) {
            state.status = 'EXHAUSTED';
          } else if (remaining < 15) {
            state.status = 'CRITICAL';
          } else if (remaining < 50) {
            state.status = 'ECONOMY';
          } else {
            state.status = 'NORMAL';
          }

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
   * Evaluates whether an odds request is allowed under tier quotas and priority gates.
   */
  public static canAcquire(params: {
    leagueId: string;
    tier: LeagueTier;
    priority: OddsRequestPriority;
    cost?: number;
  }): QuotaAcquireDecision {
    const { leagueId, tier, priority, cost = 1 } = params;
    const state = this.loadState();

    // 1. Hard exhaustion check
    if (state.totalRemaining <= 0 || state.status === 'EXHAUSTED') {
      return {
        allowed: false,
        reason: 'QUOTA_EXHAUSTED: Monthly provider limit reached.',
        priority,
        leagueId,
        tier,
        cost,
      };
    }

    // 2. Safety reserve: If remaining < 5, only CRITICAL allowed
    if (state.totalRemaining < 5 && priority !== 'CRITICAL') {
      return {
        allowed: false,
        reason: 'SAFETY_RESERVE_ACTIVE: Only CRITICAL priority allowed below 5 remaining requests.',
        priority,
        leagueId,
        tier,
        cost,
      };
    }

    // 3. Economy mode: If remaining < 30, reject LOW priority
    if (state.totalRemaining < 30 && priority === 'LOW') {
      return {
        allowed: false,
        reason: 'ECONOMY_MODE_ACTIVE: LOW priority rejected below 30 remaining requests.',
        priority,
        leagueId,
        tier,
        cost,
      };
    }

    // 4. Per-league hard ceiling: No single league can exceed 25% of total budget
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
      };
    }

    // 5. Tier budget check
    const tierBudget = state.tierBudgets[tier];
    if (tierBudget.remaining < cost && priority !== 'CRITICAL') {
      return {
        allowed: false,
        reason: `TIER_${tier}_BUDGET_EXHAUSTED: Tier ${tier} quota depleted (${tierBudget.used}/${tierBudget.allocatedBudget}).`,
        priority,
        leagueId,
        tier,
        cost,
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
    };
  }

  /**
   * Commits usage after successful execution.
   */
  public static recordUsage(params: {
    leagueId: string;
    tier: LeagueTier;
    cost?: number;
  }): void {
    const { leagueId, tier, cost = 1 } = params;
    const state = this.loadState();

    state.totalUsed += cost;
    state.totalRemaining = Math.max(0, state.totalRemaining - cost);
    state.providerCount += cost;

    state.tierBudgets[tier].used += cost;
    state.tierBudgets[tier].remaining = Math.max(0, state.tierBudgets[tier].allocatedBudget - state.tierBudgets[tier].used);

    state.leagueUsage[leagueId] = (state.leagueUsage[leagueId] || 0) + cost;
    state.lastSyncedAt = new Date().toISOString();

    if (state.totalRemaining === 0) state.status = 'EXHAUSTED';
    else if (state.totalRemaining < 15) state.status = 'CRITICAL';
    else if (state.totalRemaining < 50) state.status = 'ECONOMY';

    this.saveState(state);
  }

  /**
   * Resets usage for local testing or new month roll.
   */
  public static resetState(customBudget?: number): void {
    const budget = customBudget || 250;
    const state: QuotaAllocationStatus = {
      totalMonthlyBudget: budget,
      totalUsed: 0,
      totalRemaining: budget,
      providerLimit: budget,
      providerCount: 0,
      status: 'NORMAL',
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

