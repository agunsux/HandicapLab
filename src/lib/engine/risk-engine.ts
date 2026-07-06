// Risk Management Engine
// Location: src/lib/engine/risk-engine.ts

export interface RiskBetInput {
  matchId: string;
  league: string;
  kickoff: string; // ISO string
  bookmaker: string;
  weight: number;
}

export interface RiskEngineConfig {
  maxExposure: number;
  maxLeagueExposure: number;
  maxBookmakerExposure: number;
}

export interface RiskEvaluationResult {
  valid: boolean;
  violations: string[];
  totalExposure: number;
  riskScore: number;
}

export class RiskEngine {
  /**
   * Computes correlation between two bets.
   */
  public static getCorrelation(b1: RiskBetInput, b2: RiskBetInput): number {
    if (b1.matchId === b2.matchId) {
      return 0.90; // Extremely high correlation (same match)
    }

    let correlation = 0.0;

    if (b1.league === b2.league) {
      correlation += 0.30;
    }

    if (b1.kickoff === b2.kickoff) {
      correlation += 0.15;
    }

    if (b1.bookmaker === b2.bookmaker) {
      correlation += 0.05;
    }

    return Math.min(1.0, correlation);
  }

  /**
   * Calculates overall risk score based on weight correlations.
   * Portfolio variance proxy = w^T * Sigma * w
   */
  public static calculatePortfolioRiskScore(bets: RiskBetInput[]): number {
    if (bets.length === 0) return 0.0;

    let varianceSum = 0.0;

    for (let i = 0; i < bets.length; i++) {
      for (let j = 0; j < bets.length; j++) {
        const r = this.getCorrelation(bets[i], bets[j]);
        varianceSum += bets[i].weight * bets[j].weight * r;
      }
    }

    // Risk score is standard deviation proxy
    return Number(Math.sqrt(varianceSum).toFixed(4));
  }

  /**
   * Evaluates if a list of allocations violates any exposure constraints.
   */
  public static evaluateRisk(
    bets: RiskBetInput[],
    config: RiskEngineConfig
  ): RiskEvaluationResult {
    const violations: string[] = [];
    let totalExposure = 0.0;

    const leagueExposures: Record<string, number> = {};
    const bookmakerExposures: Record<string, number> = {};

    for (const bet of bets) {
      totalExposure += bet.weight;
      leagueExposures[bet.league] = (leagueExposures[bet.league] || 0) + bet.weight;
      bookmakerExposures[bet.bookmaker] = (bookmakerExposures[bet.bookmaker] || 0) + bet.weight;
    }

    // Check Total Exposure
    if (totalExposure > config.maxExposure) {
      violations.push(
        `Total portfolio exposure of ${(totalExposure * 100).toFixed(2)}% exceeds max allowed cap of ${(config.maxExposure * 100).toFixed(2)}%`
      );
    }

    // Check League Exposures
    for (const [league, val] of Object.entries(leagueExposures)) {
      if (val > config.maxLeagueExposure) {
        violations.push(
          `League '${league}' exposure of ${(val * 100).toFixed(2)}% exceeds cap of ${(config.maxLeagueExposure * 100).toFixed(2)}%`
        );
      }
    }

    // Check Bookmaker Exposures
    for (const [bookie, val] of Object.entries(bookmakerExposures)) {
      if (val > config.maxBookmakerExposure) {
        violations.push(
          `Bookmaker '${bookie}' exposure of ${(val * 100).toFixed(2)}% exceeds cap of ${(config.maxBookmakerExposure * 100).toFixed(2)}%`
        );
      }
    }

    const riskScore = this.calculatePortfolioRiskScore(bets);

    return {
      valid: violations.length === 0,
      violations,
      totalExposure: Number(totalExposure.toFixed(4)),
      riskScore
    };
  }

  /**
   * Rescales weights proportionally to satisfy exposure limits.
   */
  public static scaleToLimits(
    bets: RiskBetInput[],
    config: RiskEngineConfig
  ): RiskBetInput[] {
    let scaledBets = [...bets];
    let attempts = 0;

    // Iteratively scale down bets that cause violations
    while (attempts < 10) {
      const evalResult = this.evaluateRisk(scaledBets, config);
      if (evalResult.valid) break;

      // Group by league and bookmaker to find exceedances
      const leagueExposures: Record<string, number> = {};
      const bookmakerExposures: Record<string, number> = {};
      let totalExp = 0.0;

      for (const b of scaledBets) {
        totalExp += b.weight;
        leagueExposures[b.league] = (leagueExposures[b.league] || 0) + b.weight;
        bookmakerExposures[b.bookmaker] = (bookmakerExposures[b.bookmaker] || 0) + b.weight;
      }

      // Proportional scale factor if total exposure violated
      let totalScale = 1.0;
      if (totalExp > config.maxExposure) {
        totalScale = config.maxExposure / totalExp;
      }

      scaledBets = scaledBets.map(b => {
        let weight = b.weight * totalScale;

        // Scale if league limit exceeded
        const leagueExp = leagueExposures[b.league] * totalScale;
        if (leagueExp > config.maxLeagueExposure) {
          weight *= config.maxLeagueExposure / leagueExp;
        }

        // Scale if bookmaker limit exceeded
        const bookieExp = bookmakerExposures[b.bookmaker] * totalScale;
        if (bookieExp > config.maxBookmakerExposure) {
          weight *= config.maxBookmakerExposure / bookieExp;
        }

        return { ...b, weight: Number(weight.toFixed(6)) };
      });

      attempts++;
    }

    return scaledBets;
  }
}
