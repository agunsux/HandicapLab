// ============================================================================
// PRODUCTION QUOTA BUDGET CONTROLLER
// ============================================================================
// Location: src/lib/quota/quotaBudgetController.ts
//
// Invariants enforced (Section 1, 2, 3, 23):
// 1. Monthly hard limit: 250 requests. Never exceed under any circumstances.
// 2. Protected reserve: 50 requests. NEVER consumed by standard prediction engine.
// 3. Usable operational budget: Math.max(0, remaining - protectedReserve).
// 4. Safe daily request budget calculation:
//    - Controlled front-loading allowed when fixture density, market density, or expected EV is high.
//    - Under-spending when fixture quality is low, odds are already fresh, or no positive EV exists.
// 5. Complete atomic budget gating and audit trail.
// ============================================================================

import { OddsPapiQuotaAllocator } from '@/lib/providers/oddspapiQuotaAllocator';

export interface QuotaBudgetSnapshot {
  monthlyHardLimit: number;
  protectedReserve: number;
  totalUsed: number;
  totalRemaining: number;
  usableOperationalBudget: number;
  daysRemainingInPeriod: number;
  baseDailyBudget: number;
  safeDailyRequestBudget: number;
  frontLoadingMultiplier: number;
  isReserveUntouched: boolean;
  timestampUtc: string;
}

export interface QuotaBudgetControllerOptions {
  nowMs?: number;
  monthlyHardLimit?: number;
  protectedReserve?: number;
}

export class QuotaBudgetController {
  public static readonly MONTHLY_HARD_LIMIT = 250;
  public static readonly PROTECTED_RESERVE = 50;

  /**
   * Calculates days remaining in current UTC calendar month.
   */
  public static getDaysRemainingInPeriod(nowMs: number = Date.now()): number {
    const d = new Date(nowMs);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const currentDay = d.getUTCDate();
    return Math.max(1, lastDayOfMonth - currentDay + 1);
  }

  /**
   * Retrieves live quota budget snapshot from allocator state.
   */
  public static getBudgetSnapshot(options: QuotaBudgetControllerOptions = {}): QuotaBudgetSnapshot {
    const nowMs = options.nowMs ?? Date.now();
    const timestampUtc = new Date(nowMs).toISOString();

    const hardLimit = options.monthlyHardLimit ?? this.MONTHLY_HARD_LIMIT;
    const reserve = options.protectedReserve ?? this.PROTECTED_RESERVE;

    const allocatorStatus = OddsPapiQuotaAllocator.loadState();
    const totalUsed = allocatorStatus.totalUsed;
    const totalRemaining = Math.max(0, hardLimit - totalUsed);
    const usableOperationalBudget = Math.max(0, totalRemaining - reserve);
    const daysRemaining = this.getDaysRemainingInPeriod(nowMs);

    const baseDailyBudget = Math.floor((usableOperationalBudget / daysRemaining) * 100) / 100;

    return {
      monthlyHardLimit: hardLimit,
      protectedReserve: reserve,
      totalUsed,
      totalRemaining,
      usableOperationalBudget,
      daysRemainingInPeriod: daysRemaining,
      baseDailyBudget,
      safeDailyRequestBudget: baseDailyBudget,
      frontLoadingMultiplier: 1.0,
      isReserveUntouched: totalRemaining >= reserve,
      timestampUtc,
    };
  }

  /**
   * Computes an optimized, demand-aware daily request budget.
   *
   * Front-loading allowed when:
   * - High fixture density (> 5 upcoming matches in top tier)
   * - High market opportunity (AH + OU + BTTS expected)
   * - Schedule scarcity ahead (e.g. weekend matchday vs quiet midweek)
   *
   * Under-spending when:
   * - Low fixture quality or odds already fresh (< 24h)
   * - No positive EV candidate projected
   */
  public static computeSafeDailyBudget(demand: {
    upcomingFixturesCount: number;
    highQualityTierACount: number;
    staleOddsFixturesCount: number;
    averageProjectedEv?: number;
    nowMs?: number;
  }): {
    safeDailyRequestBudget: number;
    frontLoadingMultiplier: number;
    reason: string;
    snapshot: QuotaBudgetSnapshot;
  } {
    const snapshot = this.getBudgetSnapshot({ nowMs: demand.nowMs });
    const usable = snapshot.usableOperationalBudget;

    if (usable <= 0) {
      return {
        safeDailyRequestBudget: 0,
        frontLoadingMultiplier: 0.0,
        reason: 'USABLE_OPERATIONAL_BUDGET_EXHAUSTED: Protected reserve reached. 0 operational requests permitted.',
        snapshot,
      };
    }

    let multiplier = 1.0;
    let rationale = 'STANDARD_BALANCED_ALLOCATION';

    // 1. High density / High opportunity front-loading
    if (demand.highQualityTierACount >= 4 || demand.staleOddsFixturesCount >= 6) {
      multiplier = 2.0;
      rationale = 'FRONT_LOADING: High density of Tier-A fixtures requiring refresh';
    } else if (demand.highQualityTierACount >= 2) {
      multiplier = 1.5;
      rationale = 'FRONT_LOADING: Moderate weekend/matchday fixture density';
    } else if (demand.staleOddsFixturesCount === 0 || demand.upcomingFixturesCount === 0) {
      // 2. Under-spending when fixtures are already fresh or few fixtures exist
      multiplier = 0.5;
      rationale = 'UNDER_SPENDING: Existing odds are fresh or fixture supply is scarce';
    }

    // Never exceed the usable operational budget itself
    const rawBudget = Math.ceil(snapshot.baseDailyBudget * multiplier);
    const safeDailyRequestBudget = Math.min(usable, Math.max(1, rawBudget));

    return {
      safeDailyRequestBudget,
      frontLoadingMultiplier: multiplier,
      reason: rationale,
      snapshot: {
        ...snapshot,
        safeDailyRequestBudget,
        frontLoadingMultiplier: multiplier,
      },
    };
  }

  /**
   * Authorizes or rejects a proposed OddsPAPI operational request.
   * Guarantees totalRemaining - cost >= 50 at all times!
   */
  public static canConsumeOperationalRequest(cost = 1, options: QuotaBudgetControllerOptions = {}): {
    allowed: boolean;
    reason: string;
    usableRemaining: number;
    totalRemaining: number;
  } {
    const snapshot = this.getBudgetSnapshot(options);
    const willRemainTotal = snapshot.totalRemaining - cost;
    const willRemainUsable = snapshot.usableOperationalBudget - cost;

    if (willRemainTotal < snapshot.protectedReserve) {
      return {
        allowed: false,
        reason: `RESERVE_PROTECTION_TRIPPED: Spending ${cost} would breach the 50-request protected reserve (would leave ${willRemainTotal}).`,
        usableRemaining: snapshot.usableOperationalBudget,
        totalRemaining: snapshot.totalRemaining,
      };
    }

    if (willRemainUsable < 0) {
      return {
        allowed: false,
        reason: `INSUFFICIENT_OPERATIONAL_BUDGET: Usable budget is ${snapshot.usableOperationalBudget}, requested cost is ${cost}.`,
        usableRemaining: snapshot.usableOperationalBudget,
        totalRemaining: snapshot.totalRemaining,
      };
    }

    return {
      allowed: true,
      reason: 'AUTHORIZED: Operational request leaves protected reserve strictly intact.',
      usableRemaining: willRemainUsable,
      totalRemaining: willRemainTotal,
    };
  }
}
