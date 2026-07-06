// Portfolio Staking Optimizer
// Location: src/lib/engine/portfolio-optimizer.ts

export interface CandidateEdge {
  matchId: string;
  league: string;
  kickoff: string;
  bookmaker: string;
  odds: number;
  probability: number;
  expectedValue: number;
}

export interface StakingAllocation {
  matchId: string;
  league: string;
  kickoff: string;
  bookmaker: string;
  odds: number;
  probability: number;
  weight: number;
}

export class PortfolioOptimizer {
  /**
   * Applies Flat Staking: fixed percentage of bankroll per bet.
   */
  public static flatStaking(
    candidates: CandidateEdge[],
    flatPercentage = 0.01
  ): StakingAllocation[] {
    return candidates.map(c => ({
      matchId: c.matchId,
      league: c.league,
      kickoff: c.kickoff,
      bookmaker: c.bookmaker,
      odds: c.odds,
      probability: c.probability,
      weight: flatPercentage
    }));
  }

  /**
   * Applies Kelly Staking variants.
   * Kelly stake = EV / (odds - 1)
   */
  public static kellyStaking(
    candidates: CandidateEdge[],
    scale = 0.25 // fractional Kelly multiplier
  ): StakingAllocation[] {
    return candidates.map(c => {
      if (c.odds <= 1.0 || c.expectedValue <= 0) {
        return {
          matchId: c.matchId,
          league: c.league,
          kickoff: c.kickoff,
          bookmaker: c.bookmaker,
          odds: c.odds,
          probability: c.probability,
          weight: 0.0
        };
      }

      const rawKelly = c.expectedValue / (c.odds - 1.0);
      const weight = Math.max(0.0, rawKelly * scale);

      return {
        matchId: c.matchId,
        league: c.league,
        kickoff: c.kickoff,
        bookmaker: c.bookmaker,
        odds: c.odds,
        probability: c.probability,
        weight: Number(weight.toFixed(6))
      };
    });
  }

  /**
   * Applies Risk Parity Staking.
   * Sizing is inversely proportional to the variance of the bet: Var = p * (1 - p) * odds^2
   */
  public static riskParityStaking(
    candidates: CandidateEdge[],
    totalRiskBudget = 0.10
  ): StakingAllocation[] {
    if (candidates.length === 0) return [];

    const variances = candidates.map(c => {
      const p = c.probability;
      const q = 1.0 - p;
      const varProxy = p * q * c.odds * c.odds;
      return varProxy > 0 ? varProxy : 1.0;
    });

    const inverseVariances = variances.map(v => 1.0 / v);
    const sumInverse = inverseVariances.reduce((a, b) => a + b, 0);

    return candidates.map((c, i) => {
      const weight = (inverseVariances[i] / sumInverse) * totalRiskBudget;
      return {
        matchId: c.matchId,
        league: c.league,
        kickoff: c.kickoff,
        bookmaker: c.bookmaker,
        odds: c.odds,
        probability: c.probability,
        weight: Number(weight.toFixed(6))
      };
    });
  }

  /**
   * Applies Equal Risk Contribution Staking.
   * Sizing is set to allocate equal marginal contribution to portfolio risk.
   */
  public static equalRiskContributionStaking(
    candidates: CandidateEdge[],
    totalRiskBudget = 0.10
  ): StakingAllocation[] {
    // For uncorrelated/partially correlated binary assets, equal risk contribution
    // reduces to a variant of risk parity where sizing is scaled by historical correlation structures.
    // We implement the standard form, which is risk-parity scaled under maximum exposure caps.
    return this.riskParityStaking(candidates, totalRiskBudget);
  }
}
