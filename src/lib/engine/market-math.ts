// Core Mathematical & Margin-Removal Calculators
// Location: src/lib/engine/market-math.ts

export interface FairOddsResult {
  impliedProbabilities: Record<string, number>;
  fairProbabilities: Record<string, number>;
  overround: number;
  shinZ?: number;
}

export class MarketMath {
  /**
   * Computes implied probabilities and overround from decimal odds.
   */
  public static calculateOverround(odds: Record<string, number>): {
    implied: Record<string, number>;
    overround: number;
  } {
    const implied: Record<string, number> = {};
    let sumImplied = 0;

    for (const [key, val] of Object.entries(odds)) {
      if (val && val > 1.0) {
        const p = 1.0 / val;
        implied[key] = p;
        sumImplied += p;
      } else {
        implied[key] = 0.0;
      }
    }

    const overround = sumImplied - 1.0;
    return { implied, overround };
  }

  /**
   * Proportional Margin Removal Method.
   * Simple scaling: P_fair = P_implied / (1 + overround)
   */
  public static removeMarginProportional(odds: Record<string, number>): FairOddsResult {
    const { implied, overround } = this.calculateOverround(odds);
    const sumImplied = 1.0 + overround;
    const fair: Record<string, number> = {};

    for (const [key, p] of Object.entries(implied)) {
      fair[key] = sumImplied > 0 ? Number((p / sumImplied).toFixed(6)) : 0.0;
      implied[key] = Number(p.toFixed(6));
    }

    return {
      impliedProbabilities: implied,
      fairProbabilities: fair,
      overround: Number(overround.toFixed(6))
    };
  }

  /**
   * Shin's Margin Removal Method.
   * Solves for the proportion of inside traders 'z' such that sum of fair probabilities is 1.0.
   */
  public static removeMarginShin(odds: Record<string, number>, tolerance = 1e-6, maxIterations = 100): FairOddsResult {
    const { implied, overround } = this.calculateOverround(odds);
    const keys = Object.keys(odds);
    const numOutcomes = keys.length;

    // Fallback if odds are invalid or overround is zero/negative
    if (overround <= 0 || numOutcomes < 2) {
      return this.removeMarginProportional(odds);
    }

    // Solve for z in [0, 1) using bisection method
    let lowZ = 0.0;
    let highZ = 0.9999;
    let z = 0.0;
    let fair: Record<string, number> = {};

    for (let iter = 0; iter < maxIterations; iter++) {
      z = (lowZ + highZ) / 2.0;
      fair = {};
      let sumFair = 0.0;

      // Shin's formulation: P_i = (sqrt(z^2 + 4 * (1 - z) * (implied_i^2 / sum_implied_squares)) - z) / (2 * (1 - z))
      // First find the normalized implied probabilities
      let sumImplied = 0;
      for (const k of keys) sumImplied += implied[k];

      for (const k of keys) {
        const impliedNormalized = implied[k] / sumImplied;
        const numerator = Math.sqrt(z * z + 4.0 * (1.0 - z) * impliedNormalized * impliedNormalized) - z;
        const denominator = 2.0 * (1.0 - z);
        const pFair = numerator / denominator;
        fair[k] = pFair;
        sumFair += pFair;
      }

      if (Math.abs(sumFair - 1.0) < tolerance) {
        break;
      }

      if (sumFair > 1.0) {
        lowZ = z; // Increase z to pull down probabilities
      } else {
        highZ = z; // Decrease z to raise probabilities
      }
    }

    // Format results
    const formattedFair: Record<string, number> = {};
    const formattedImplied: Record<string, number> = {};
    for (const k of keys) {
      formattedFair[k] = Number((fair[k] || 0.0).toFixed(6));
      formattedImplied[k] = Number(implied[k].toFixed(6));
    }

    return {
      impliedProbabilities: formattedImplied,
      fairProbabilities: formattedFair,
      overround: Number(overround.toFixed(6)),
      shinZ: Number(z.toFixed(6))
    };
  }
}
