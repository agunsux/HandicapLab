export class CLVCalculator {
  /**
   * Calculates Closing Line Value (CLV).
   * Formula: clv = (closingOdds / predictionOdds) - 1
   * Measures how much the market moved in our favor (if closing odds are higher than predicted).
   * 
   * @param predictionOdds Odds when the prediction was generated (e.g., 1.90)
   * @param closingOdds Market odds just before kickoff (e.g., 2.10)
   */
  public static calculate(
    predictionOdds: number,
    closingOdds: number | null | undefined
  ): number | null {
    if (!closingOdds || closingOdds <= 1.0 || predictionOdds <= 1.0) {
      return null;
    }
    const clv = ((1.0 / closingOdds) - (1.0 / predictionOdds)) * 100;
    return Number(clv.toFixed(4));
  }
}
