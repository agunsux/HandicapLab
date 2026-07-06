// HandicapLab Market Intelligence - ROI & Yield Evaluation
// Location: src/lib/market-intelligence/features/evaluation/roi.ts

export class ROIEvaluator {
  /**
   * Calculates Yield/ROI percentage for a given set of bets.
   * MUST ONLY BE CALLED POST-MATCH.
   */
  public static calculateYield(bets: { stake: number; profit: number }[]): number {
    if (!bets || bets.length === 0) return 0;

    let totalStake = 0;
    let totalProfit = 0;

    for (const bet of bets) {
      totalStake += bet.stake;
      totalProfit += bet.profit;
    }

    if (totalStake === 0) return 0;
    return (totalProfit / totalStake) * 100;
  }
}
