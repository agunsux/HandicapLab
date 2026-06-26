export class BrierCalculator {
  /**
   * Calculates the Brier score for a prediction market.
   * Formula: brier = mean((predicted_prob - actual_result)^2)
   * 
   * @param marketType Market type ('ML' | 'AH' | 'OU')
   * @param prediction Object containing model probabilities
   * @param actualHome Actual goals scored by the home team
   * @param actualAway Actual goals scored by the away team
   */
  public static calculate(
    marketType: 'ML' | 'AH' | 'OU',
    prediction: any,
    actualHome: number,
    actualAway: number
  ): number {
    const totalGoals = actualHome + actualAway;
    const goalDiff = actualHome - actualAway;

    const predObj = typeof prediction === 'object' && prediction ? prediction : {};

    if (marketType === 'ML') {
      // Brier score is restricted to binary markets (AH cover and OU only)
      return 0.0;
    } else if (marketType === 'AH') {
      // Extract Asian Handicap line and probability
      const line = parseFloat(predObj.ah_line || predObj.line || '0');
      const lineStr = line > 0 ? `+${line.toFixed(1)}` : line.toFixed(1);

      // If predicted via ProbabilityOutput
      let pAhHome = 0.5;
      let pAhAway = 0.5;
      if (predObj.pAhHome && predObj.pAhHome[lineStr] !== undefined) {
        pAhHome = parseFloat(predObj.pAhHome[lineStr]);
        pAhAway = parseFloat(predObj.pAhAway[lineStr]);
      } else {
        pAhHome = parseFloat(predObj.ah_prob || '0.5');
        pAhAway = 1 - pAhHome;
      }

      // Net handicap calculation: actual margin + line
      const net = goalDiff + line;
      let yHome = 0.5;
      let yAway = 0.5;

      if (net > 0) {
        yHome = 1;
        yAway = 0;
      } else if (net < 0) {
        yHome = 0;
        yAway = 1;
      }

      const brier = (Math.pow(pAhHome - yHome, 2) + Math.pow(pAhAway - yAway, 2)) / 2;
      return Number(brier.toFixed(4));
    } else if (marketType === 'OU') {
      // Extract Over/Under line and probability
      const line = parseFloat(predObj.ou_line || predObj.line || '2.5');
      const lineStr = line.toFixed(1);

      let pOver = 0.5;
      let pUnder = 0.5;
      if (predObj.pOver && predObj.pOver[lineStr] !== undefined) {
        pOver = parseFloat(predObj.pOver[lineStr]);
        pUnder = parseFloat(predObj.pUnder[lineStr]);
      } else {
        pOver = parseFloat(predObj.over_prob || '0.5');
        pUnder = 1 - pOver;
      }

      let yOver = 0.5;
      let yUnder = 0.5;

      if (totalGoals > line) {
        yOver = 1;
        yUnder = 0;
      } else if (totalGoals < line) {
        yOver = 0;
        yUnder = 1;
      }

      const brier = (Math.pow(pOver - yOver, 2) + Math.pow(pUnder - yUnder, 2)) / 2;
      return Number(brier.toFixed(4));
    }

    return 0;
  }
}
