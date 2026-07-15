import type { ReplayOutcome } from '../../lib/epic31b/types';

export interface MonteCarloConfig {
  simulationsCount?: number;
  initialBankroll?: number;
  ruinThreshold?: number; // e.g. 5 units
  seed?: number;
}

export interface MonteCarloStakingResult {
  stakingType: string;
  expectedCAGR: number;
  maxDrawdown: number;
  probabilityOfRuin: number; // percentage
  medianBankroll: number;
  worst1Pct: number;
  worst5Pct: number;
  best1Pct: number;
  best5Pct: number;
  ulcerIndex: number;
}

export class MonteCarloSimulator {
  /**
   * Runs 10,000 Monte Carlo bankroll pathways across Kelly, fractional, and flat stakes.
   */
  public static simulate(
    outcomes: ReplayOutcome[],
    config: MonteCarloConfig = {}
  ): MonteCarloStakingResult[] {
    const simCount = config.simulationsCount ?? 10000;
    const initBank = config.initialBankroll ?? 100;
    const ruinThresh = config.ruinThreshold ?? 5;
    const seed = config.seed ?? 42;

    const stakingTypes = [
      { name: 'Flat Stake (1 unit)', fraction: 0, flat: 1 },
      { name: 'Kelly Full (100%)', fraction: 1.0, flat: 0 },
      { name: 'Kelly Half (50%)', fraction: 0.5, flat: 0 },
      { name: 'Kelly Quarter (25%)', fraction: 0.25, flat: 0 },
      { name: 'Fractional (10%)', fraction: 0.1, flat: 0 },
    ];

    const results: MonteCarloStakingResult[] = [];

    // Seeded random number generator
    let state = seed;
    const seededRandom = () => {
      state = (state * 1664525 + 1013904223) & 0x7fffffff;
      return state / 0x7fffffff;
    };

    const validOutcomes = outcomes.filter(o => o.kellyStake > 0);
    if (validOutcomes.length === 0) {
      // Return default empty results if no predictions placed
      return stakingTypes.map(s => ({
        stakingType: s.name,
        expectedCAGR: 0,
        maxDrawdown: 0,
        probabilityOfRuin: 0,
        medianBankroll: initBank,
        worst1Pct: initBank,
        worst5Pct: initBank,
        best1Pct: initBank,
        best5Pct: initBank,
        ulcerIndex: 0,
      }));
    }

    for (const stakeConfig of stakingTypes) {
      const finalBankrolls: number[] = [];
      let ruinsCount = 0;
      let totalMaxDrawdownSum = 0;
      let totalUlcerIndexSum = 0;

      for (let s = 0; s < simCount; s++) {
        let bankroll = initBank;
        let peak = initBank;
        let maxDrawdown = 0;
        const drawdowns: number[] = [];

        for (const outcome of validOutcomes) {
          if (bankroll < ruinThresh) {
            bankroll = 0;
            break;
          }

          // Compute stake size
          let stake = 0;
          if (stakeConfig.flat > 0) {
            stake = stakeConfig.flat;
          } else {
            stake = bankroll * outcome.kellyStake * stakeConfig.fraction;
          }

          // Cap stake at current bankroll
          stake = Math.min(stake, bankroll);
          if (stake <= 0) continue;

          // Simulate match outcome using model's predicted probability
          const rand = seededRandom();
          const win = rand < outcome.predictedProbability;

          if (win) {
            // Odds taken is profitLoss / kellyStake + 1
            const odds = outcome.kellyStake > 0 ? (outcome.profitLoss / outcome.kellyStake) + 1 : 2.0;
            bankroll += stake * (odds - 1);
          } else {
            bankroll -= stake;
          }

          // Track drawdowns
          if (bankroll > peak) {
            peak = bankroll;
          }
          const dd = peak > 0 ? ((peak - bankroll) / peak) * 100 : 0;
          drawdowns.push(dd);
          if (dd > maxDrawdown) {
            maxDrawdown = dd;
          }
        }

        if (bankroll < ruinThresh) {
          ruinsCount++;
          bankroll = 0;
        }

        finalBankrolls.push(bankroll);
        totalMaxDrawdownSum += maxDrawdown;

        // Ulcer Index: quadratic sum of drawdowns
        const quadraticSum = drawdowns.reduce((sum, d) => sum + d * d, 0);
        const ulcerIndex = drawdowns.length > 0 ? Math.sqrt(quadraticSum / drawdowns.length) : 0;
        totalUlcerIndexSum += ulcerIndex;
      }

      // Sort final bankrolls to get percentiles
      finalBankrolls.sort((a, b) => a - b);
      const medianBankroll = finalBankrolls[Math.floor(simCount / 2)];
      const worst1Pct = finalBankrolls[Math.floor(simCount * 0.01)];
      const worst5Pct = finalBankrolls[Math.floor(simCount * 0.05)];
      const best1Pct = finalBankrolls[Math.floor(simCount * 0.99)];
      const best5Pct = finalBankrolls[Math.floor(simCount * 0.95)];

      // CAGR = (FinalBankroll / InitialBankroll) ^ (1 / Years) - 1
      // Assuming EPL season matches count is 380 (1 year)
      const matchesPerYear = 380;
      const years = validOutcomes.length / matchesPerYear || 1;
      const cagrVal = Math.pow(Math.max(0.1, medianBankroll) / initBank, 1 / years) - 1;

      results.push({
        stakingType: stakeConfig.name,
        expectedCAGR: Math.round(cagrVal * 10000) / 100,
        maxDrawdown: Math.round((totalMaxDrawdownSum / simCount) * 100) / 100,
        probabilityOfRuin: Math.round((ruinsCount / simCount) * 10000) / 100,
        medianBankroll: Math.round(medianBankroll * 100) / 100,
        worst1Pct: Math.round(worst1Pct * 100) / 100,
        worst5Pct: Math.round(worst5Pct * 100) / 100,
        best1Pct: Math.round(best1Pct * 100) / 100,
        best5Pct: Math.round(best5Pct * 100) / 100,
        ulcerIndex: Math.round((totalUlcerIndexSum / simCount) * 100) / 100,
      });
    }

    return results;
  }
}
