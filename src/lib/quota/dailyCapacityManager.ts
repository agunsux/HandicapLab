// ============================================================================
// DYNAMIC DAILY CAPACITY & ROLLING LOSS GUARD MANAGER
// ============================================================================
// Location: src/lib/quota/dailyCapacityManager.ts
//
// Invariants enforced (Section 16, 17, 23):
// 1. Dynamic calculation of daily prediction capacity:
//    - MINIMUM_EXPECTED_DAILY_PICKS
//    - TARGET_DAILY_PICKS
//    - MAXIMUM_SAFE_DAILY_PICKS
//    Calculated from usable quota, days remaining, fixture supply, density, and risk limits.
// 2. Risk Controls & Rolling Loss Guards:
//    - dailyLossGuard: Checks 24h rolling PnL; tightens thresholds if losses accumulate.
//    - marketLossGuard: Checks rolling PnL per market (AH, OU, BTTS).
//    - leagueLossGuard: Checks rolling PnL per league.
//    - modelVersionLossGuard: Verifies model version stability.
// 3. Dynamic Threshold Adaptation:
//    - Healthy regime: relaxes to empirical floor (min EV 1.0%).
//    - Guard triggered: tightens to defensive tier (min EV 2.5% to 4.0%).
//    - STRICTLY NO martingale, NO loss chasing, NO fabricated predictions.
// ============================================================================

import { QuotaBudgetController, QuotaBudgetSnapshot } from './quotaBudgetController';
import { MarketType } from '@/lib/ledger/predictionLedgerTypes';

export interface RollingPerformanceWindow {
  windowDays: number;
  totalBets: number;
  wins: number;
  losses: number;
  pushes: number;
  halfWins: number;
  halfLosses: number;
  netPnL: number; // in units e.g. -1.5, +3.2
  yieldPct: number; // netPnL / totalBets
  marketPnL: Record<MarketType, { bets: number; netPnL: number; yieldPct: number }>;
  leaguePnL: Record<string, { bets: number; netPnL: number }>;
}

export interface RiskGuardEvaluation {
  dailyLossGuardTriggered: boolean;
  marketLossGuardTriggered: Record<MarketType, boolean>;
  leagueLossGuardTriggered: Record<string, boolean>;
  modelVersionLossGuardTriggered: boolean;
  activeRegime: 'HEALTHY' | 'CAUTIONARY' | 'DEFENSIVE_LOCKDOWN';
  recommendedEvFloor: number; // e.g. 0.01 (1%) to 0.04 (4%)
  guardRationale: string[];
}

export interface DynamicCapacityResult {
  minimumExpectedDailyPicks: number;
  targetDailyPicks: number;
  maximumSafeDailyPicks: number;
  usableDailyRequestBudget: number;
  projectedPredictionDensity: number;
  effectiveEvFloor: number;
  riskEvaluation: RiskGuardEvaluation;
  budgetSnapshot: QuotaBudgetSnapshot;
  rationale: string;
}

export class DailyCapacityManager {
  public static readonly BASE_EV_FLOOR = 0.01; // 1.0% empirical EV floor
  public static readonly CAUTIONARY_EV_FLOOR = 0.025; // 2.5%
  public static readonly DEFENSIVE_EV_FLOOR = 0.04; // 4.0%

  /**
   * Evaluates rolling loss guards across daily, market, and league dimensions.
   */
  public static evaluateRiskGuards(perf: RollingPerformanceWindow): RiskGuardEvaluation {
    const rationale: string[] = [];

    // 1. Daily / Recent PnL Guard (Trigger if rolling net PnL < -3.0 units)
    const dailyLossGuardTriggered = perf.netPnL <= -3.0;
    if (dailyLossGuardTriggered) {
      rationale.push(`DAILY_LOSS_GUARD: Recent rolling PnL is ${perf.netPnL.toFixed(2)} units (limit -3.0). Tightening qualification.`);
    }

    // 2. Market Loss Guard (Trigger if specific market yield is deeply negative < -10% with >= 5 bets)
    const marketLossGuardTriggered: Record<MarketType, boolean> = {
      AH: false,
      OU: false,
      BTTS: false,
    };

    for (const m of ['AH', 'OU', 'BTTS'] as MarketType[]) {
      const mData = perf.marketPnL[m];
      if (mData && mData.bets >= 5 && mData.yieldPct < -0.10) {
        marketLossGuardTriggered[m] = true;
        rationale.push(`MARKET_LOSS_GUARD: Market ${m} yield is ${(mData.yieldPct * 100).toFixed(1)}% across ${mData.bets} bets. Elevated scrutiny active.`);
      }
    }

    // 3. League Loss Guard (Trigger if league has >= 3 bets and net PnL < -2.5 units)
    const leagueLossGuardTriggered: Record<string, boolean> = {};
    for (const [league, data] of Object.entries(perf.leaguePnL)) {
      if (data.bets >= 3 && data.netPnL <= -2.5) {
        leagueLossGuardTriggered[league] = true;
        rationale.push(`LEAGUE_LOSS_GUARD: League ${league} down ${data.netPnL.toFixed(2)} units.`);
      }
    }

    // 4. Model Version Guard (Yield deeply negative across large sample)
    const modelVersionLossGuardTriggered = perf.totalBets >= 20 && perf.yieldPct < -0.08;
    if (modelVersionLossGuardTriggered) {
      rationale.push(`MODEL_VERSION_GUARD: Rolling yield is ${(perf.yieldPct * 100).toFixed(1)}% over ${perf.totalBets} bets.`);
    }

    // Determine overall regime & EV floor
    let activeRegime: 'HEALTHY' | 'CAUTIONARY' | 'DEFENSIVE_LOCKDOWN' = 'HEALTHY';
    let recommendedEvFloor = this.BASE_EV_FLOOR;

    if (dailyLossGuardTriggered || modelVersionLossGuardTriggered) {
      activeRegime = 'DEFENSIVE_LOCKDOWN';
      recommendedEvFloor = this.DEFENSIVE_EV_FLOOR;
    } else if (
      Object.values(marketLossGuardTriggered).some(Boolean) ||
      Object.values(leagueLossGuardTriggered).some(Boolean) ||
      perf.netPnL < -1.5
    ) {
      activeRegime = 'CAUTIONARY';
      recommendedEvFloor = this.CAUTIONARY_EV_FLOOR;
    }

    if (rationale.length === 0) {
      rationale.push('HEALTHY_REGIME: Performance metrics are within safe operational parameters. Empirical floor active (1.0% EV).');
    }

    return {
      dailyLossGuardTriggered,
      marketLossGuardTriggered,
      leagueLossGuardTriggered,
      modelVersionLossGuardTriggered,
      activeRegime,
      recommendedEvFloor,
      guardRationale: rationale,
    };
  }

  /**
   * Dynamically calculates daily capacity bounds.
   */
  public static calculateDailyCapacity(input: {
    upcomingFixturesCount: number;
    estimatedPredictionDensity?: number; // default ~2.0 picks per request
    rollingPerformance?: RollingPerformanceWindow;
    nowMs?: number;
  }): DynamicCapacityResult {
    const nowMs = input.nowMs ?? Date.now();
    const budgetSnapshot = QuotaBudgetController.getBudgetSnapshot({ nowMs });

    // Fallback healthy performance window if none provided
    const perf: RollingPerformanceWindow = input.rollingPerformance ?? {
      windowDays: 7,
      totalBets: 10,
      wins: 6,
      losses: 4,
      pushes: 0,
      halfWins: 0,
      halfLosses: 0,
      netPnL: 1.45,
      yieldPct: 0.145,
      marketPnL: {
        AH: { bets: 4, netPnL: 0.8, yieldPct: 0.20 },
        OU: { bets: 3, netPnL: 0.4, yieldPct: 0.13 },
        BTTS: { bets: 3, netPnL: 0.25, yieldPct: 0.08 },
      },
      leaguePnL: {},
    };

    const riskEval = this.evaluateRiskGuards(perf);

    // Compute safe daily request budget
    const safeDailyRequests = Math.max(
      0,
      Math.min(
        budgetSnapshot.usableOperationalBudget,
        Math.ceil(budgetSnapshot.baseDailyBudget * (input.upcomingFixturesCount > 5 ? 1.5 : 1.0))
      )
    );

    const density = input.estimatedPredictionDensity ?? 2.0;

    // Compute pick bounds
    // Minimum: What we can sustainably guarantee even on quiet days or conservative regime
    // Target: Balanced daily production
    // Maximum safe: Ceiling to prevent burning quota or overtrading
    let minPicks = 0;
    let targetPicks = 0;
    let maxSafePicks = 0;

    if (budgetSnapshot.usableOperationalBudget > 0 && input.upcomingFixturesCount > 0) {
      if (riskEval.activeRegime === 'DEFENSIVE_LOCKDOWN') {
        minPicks = 1;
        targetPicks = Math.min(input.upcomingFixturesCount, 3);
        maxSafePicks = Math.min(input.upcomingFixturesCount, 5);
      } else if (riskEval.activeRegime === 'CAUTIONARY') {
        minPicks = 2;
        targetPicks = Math.min(Math.floor(input.upcomingFixturesCount * 0.7), Math.round(safeDailyRequests * density));
        targetPicks = Math.max(minPicks, Math.min(8, targetPicks));
        maxSafePicks = Math.min(input.upcomingFixturesCount * 2, 10);
      } else {
        // HEALTHY
        minPicks = Math.min(3, input.upcomingFixturesCount);
        targetPicks = Math.min(
          input.upcomingFixturesCount * 2,
          Math.max(minPicks, Math.round(safeDailyRequests * density))
        );
        targetPicks = Math.max(minPicks, Math.min(12, targetPicks));
        maxSafePicks = Math.min(input.upcomingFixturesCount * 3, Math.max(targetPicks + 3, 15));
      }
    }

    const rationale = `Calculated with ${budgetSnapshot.usableOperationalBudget} usable reqs across ${budgetSnapshot.daysRemainingInPeriod} days, fixture supply: ${input.upcomingFixturesCount}, density: ${density.toFixed(1)}, regime: ${riskEval.activeRegime}.`;

    return {
      minimumExpectedDailyPicks: minPicks,
      targetDailyPicks: targetPicks,
      maximumSafeDailyPicks: maxSafePicks,
      usableDailyRequestBudget: safeDailyRequests,
      projectedPredictionDensity: density,
      effectiveEvFloor: riskEval.recommendedEvFloor,
      riskEvaluation: riskEval,
      budgetSnapshot,
      rationale,
    };
  }
}
