import { MarginMethod } from './types';

export class MarginEngine {
  /**
   * Calculates the overround (sum of implied probabilities).
   * A fair book has an overround of 1.0 (100%).
   * Typically bookmakers have > 1.0 (e.g., 1.05 = 5% overround).
   */
  public static calculateOverround(decimalOddsList: number[]): number {
    if (!decimalOddsList || decimalOddsList.length === 0) return 0;
    return decimalOddsList.reduce((sum, odds) => sum + (1 / odds), 0);
  }

  /**
   * Calculates the actual bookmaker margin (Hold).
   * Formula: (Overround - 1) / Overround
   */
  public static calculateMargin(overround: number): number {
    if (overround <= 1) return 0;
    return (overround - 1) / overround;
  }

  /**
   * Proportional Margin Removal.
   * Assumes bookmaker applies margin proportionally to the raw probability.
   */
  private static calculateProportional(odds: number, overround: number): number {
    if (overround === 0) return 1 / odds;
    return (1 / odds) / overround;
  }

  /**
   * Shin Method Margin Removal.
   * Estimates the proportion of insider traders (z) to find true probability.
   * Simplified iterative approach to solve for z.
   */
  private static calculateShin(oddsList: number[], targetIndex: number, overround: number): number {
    if (oddsList.length < 2 || overround <= 1.0) {
      return this.calculateProportional(oddsList[targetIndex], overround);
    }
    
    // Iterative Newton-Raphson approximation for z
    let z = 0.0;
    let iterations = 0;
    let sum = 0;
    
    // Initial guess for z based on overround
    z = (overround - 1) / overround; 
    
    // A simplified bounded Shin calculation for true probabilities:
    // P_i = (sqrt(z^2 + 4 * (1 - z) * (1 / odds_i)^2 / sum_inv_odds_sq) - z) / (2 * (1 - z))
    // For production speed, we'll use a direct closed-form approximation of Shin if iteration fails,
    // but here we use a deterministic bounded approximation.
    
    const invOdds = oddsList.map(o => 1 / o);
    let error = 1;
    
    while (error > 0.0001 && iterations < 50) {
      sum = 0;
      for (const p of invOdds) {
        sum += (Math.sqrt(z * z + 4 * (1 - z) * ((p * p) / overround)) - z) / (2 * (1 - z));
      }
      error = Math.abs(1 - sum);
      z = z * sum; // Adjust z
      iterations++;
    }

    const p_target = invOdds[targetIndex];
    const trueProb = (Math.sqrt(z * z + 4 * (1 - z) * ((p_target * p_target) / overround)) - z) / (2 * (1 - z));
    return trueProb;
  }

  /**
   * Core public method to calculate implied probability for a specific odds value
   * in the context of the entire market selection.
   */
  public static calculateFairProbability(
    oddsList: number[],
    targetOdds: number,
    method: MarginMethod = 'proportional'
  ): number {
    const overround = this.calculateOverround(oddsList);
    
    if (overround <= 1.0) {
      return 1 / targetOdds; // No margin or arb exists
    }

    if (method === 'shin') {
      const targetIndex = oddsList.indexOf(targetOdds);
      if (targetIndex !== -1) {
        return this.calculateShin(oddsList, targetIndex, overround);
      }
    }

    // Default to proportional
    return this.calculateProportional(targetOdds, overround);
  }
}
