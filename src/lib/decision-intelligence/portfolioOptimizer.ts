/**
 * EPIC 20.6 — Portfolio Optimizer
 * Maximum EV, Risk-Adjusted Return, Maximum Diversification, Exposure Limits.
 */

import type { PortfolioConstraint, PortfolioAllocation } from './types';

export class PortfolioOptimizer {
  allocate(
    bets: readonly { fixtureId: string; expectedValue: number; stake: number; market: string }[],
    constraint: PortfolioConstraint,
    bankroll: number
  ): PortfolioAllocation[] {
    const sorted = [...bets].sort((a, b) => b.expectedValue - a.expectedValue);
    const allocations: PortfolioAllocation[] = [];
    let totalAllocated = 0;
    let perMarket: Record<string, number> = {};
    let perDay = 0;

    for (const bet of sorted) {
      if (perDay >= constraint.maxDailyBets) break;
      if (totalAllocated >= constraint.maxExposure * bankroll) break;

      const marketExposure = perMarket[bet.market] ?? 0;
      if (marketExposure >= constraint.maxMarketExposure * bankroll) continue;

      const recommendedStake = Math.min(
        bet.stake,
        constraint.maxExposure * bankroll - totalAllocated,
        constraint.maxMarketExposure * bankroll - marketExposure
      );

      if (recommendedStake <= 0) {
        allocations.push({ fixtureId: bet.fixtureId, recommendedStake: 0, allocationPct: 0, constrained: true });
        continue;
      }

      totalAllocated += recommendedStake;
      perMarket[bet.market] = (perMarket[bet.market] ?? 0) + recommendedStake;
      perDay++;

      allocations.push({
        fixtureId: bet.fixtureId,
        recommendedStake: Math.round(recommendedStake * 10000) / 10000,
        allocationPct: Math.round((recommendedStake / bankroll) * 10000) / 100,
        constrained: false,
      });
    }

    return allocations;
  }
}

export const defaultPortfolioOptimizer = new PortfolioOptimizer();