// HandicapLab Decision Engine v1 - Risk Engine
// Location: src/lib/engines/decision-engine-v1/risk-engine.ts

export class RiskEngine {
  /**
   * Estimates a continuous Risk Score (0-100) based on multiple parameters.
   */
  public static calculateRiskScore(
    disagreementScore: number,
    steamScore: number,
    marketRegime: string,
    kellyFraction: number
  ): number {
    let baseRisk = 20; // baseline risk score

    // 1. Model Disagreement factor
    baseRisk += disagreementScore * 0.3;

    // 2. Steam volatility factor
    if (steamScore > 60) {
      baseRisk += 15;
    }

    // 3. Market Volatility / Regime factor
    if (marketRegime === 'Volatile') {
      baseRisk += 20;
    } else if (marketRegime === 'Mixed') {
      baseRisk += 15;
    }

    // 4. Recommendation Stake risk factor
    baseRisk += kellyFraction * 50;

    return Math.round(Math.max(0, Math.min(100, baseRisk)));
  }

  /**
   * Calculates Kelly stake size based on probability, odds, and risk parameters.
   * Includes fractional Kelly scaling.
   */
  public static calculateKellyFraction(
    probability: number,
    marketOdds: number,
    multiplier: number = 0.25
  ): { kellyFraction: number; recommendedStake: number } {
    if (marketOdds <= 1.0 || probability <= 0) {
      return { kellyFraction: 0, recommendedStake: 0 };
    }

    // Kelly Formula: f = (p * b - 1) / (b - 1)
    const rawKelly = (probability * marketOdds - 1) / (marketOdds - 1);
    
    // Scale and bound to prevent excessive risk
    const kellyFraction = Math.max(0, Math.min(1.0, rawKelly));
    const recommendedStake = Number((kellyFraction * multiplier * 100).toFixed(2));

    return {
      kellyFraction: Number(kellyFraction.toFixed(4)),
      recommendedStake
    };
  }
}
