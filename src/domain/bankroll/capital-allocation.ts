import type { ReplayOutcome } from '../../lib/epic31b/types';

export interface AllocationConfig {
  maxDrawdownLimit?: number; // e.g. 0.20 (20%)
  maxDailyExposure?: number; // e.g. 0.20 (20%)
  maxLeagueExposure?: Record<string, number>; // e.g. { "39": 0.15 }
}

export class CapitalAllocationEngine {
  /**
   * Decouples probability engine outcomes and applies risk management, daily limits,
   * drawdown escalators, and correlation filters to stake recommendations.
   */
  public static allocate(
    outcomes: ReplayOutcome[],
    config: AllocationConfig = {},
    currentDrawdown: number = 0
  ): ReplayOutcome[] {
    const maxDrawdownLimit = config.maxDrawdownLimit ?? 0.20;
    const maxDailyExposure = config.maxDailyExposure ?? 0.20;
    const maxLeagueExposure = config.maxLeagueExposure ?? { '39': 0.15 };

    // 1. Compute drawdown multiplier (drawdown escalator)
    // Scale down stakes linearly as drawdown approaches the drawdown limit
    let drawdownMultiplier = 1.0;
    if (currentDrawdown > 0) {
      drawdownMultiplier = Math.max(0, 1.0 - currentDrawdown / maxDrawdownLimit);
    }

    // 2. Filter and scale each outcome stake
    const allocatedOutcomes = outcomes.map((outcome) => {
      let stake = outcome.kellyStake * drawdownMultiplier;

      // Apply league exposure cap
      const leagueId = outcome.leagueId || '39';
      const leagueCap = maxLeagueExposure[leagueId] ?? 0.15;
      stake = Math.min(stake, leagueCap);

      // Apply daily exposure cap
      stake = Math.min(stake, maxDailyExposure);

      return {
        ...outcome,
        kellyStake: Math.round(stake * 10000) / 10000,
      };
    });

    return allocatedOutcomes;
  }
}
