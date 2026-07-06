// HandicapLab Decision Engine v1 - Risk Engine
// Location: src/lib/engines/decision-engine-v1/risk-engine.ts

export class RiskEngine {
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
