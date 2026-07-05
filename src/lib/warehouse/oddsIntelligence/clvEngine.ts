export class CLVEngine {
  /**
   * Fractional CLV Percentage
   * Definition: (Odds Taken / Closing Odds) - 1
   * Example: Taken 2.20, Closes 2.00 -> (2.20 / 2.00) - 1 = +10% CLV
   */
  public static calculateFractionalCLV(oddsTaken: number, closingOdds: number): number {
    if (closingOdds === 0) return 0;
    return (oddsTaken / closingOdds) - 1;
  }

  /**
   * Absolute Probability CLV
   * Definition: True Closing Probability - True Taken Probability
   * Represents the exact probability edge gained over the market.
   */
  public static calculateProbabilityCLV(probTaken: number, closingProb: number): number {
    return closingProb - probTaken;
  }

  /**
   * Expected Value (EV) CLV
   * Definition: (Odds Taken * True Closing Probability) - 1
   * Example: Taken 2.20, True Closing Prob 0.5 (Fair Odds 2.00) -> (2.20 * 0.5) - 1 = +10% EV
   */
  public static calculateExpectedValueCLV(oddsTaken: number, trueClosingProb: number): number {
    return (oddsTaken * trueClosingProb) - 1;
  }

  /**
   * Logarithmic CLV (Useful for Kelly staking contexts)
   * Definition: ln(Odds Taken / Closing Odds)
   */
  public static calculateLogCLV(oddsTaken: number, closingOdds: number): number {
    if (closingOdds <= 0 || oddsTaken <= 0) return 0;
    return Math.log(oddsTaken / closingOdds);
  }
}
