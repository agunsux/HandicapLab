export class ModelIntelligenceAdjuster {
  /**
   * Calculates league quality score (0-100) based on weighted ROI, CLV, sample size, and liquidity.
   */
  public static calculateLeagueQualityScore(
    historicalRoi: number, // e.g. 5.5% ROI
    clvPercentage: number,  // e.g. 2.1% CLV
    sampleSize: number,    // number of historical signals
    liquidityScore: number // bookmaker liquidity (0-100)
  ): number {
    let roiWeight = 0;
    if (historicalRoi >= 10) roiWeight = 30;
    else if (historicalRoi >= 5) roiWeight = 20;
    else if (historicalRoi > 0) roiWeight = 10;

    let clvWeight = 0;
    if (clvPercentage >= 3) clvWeight = 30;
    else if (clvPercentage >= 1.5) clvWeight = 20;
    else if (clvPercentage > 0) clvWeight = 10;

    let sampleSizeWeight = 5;
    if (sampleSize >= 100) sampleSizeWeight = 20;
    else if (sampleSize >= 30) sampleSizeWeight = 10;

    const liquidityWeight = Math.round(liquidityScore * 0.20); // max 20

    const score = roiWeight + clvWeight + sampleSizeWeight + liquidityWeight;
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Compares current vs opening line/odds and returns line movement and steam score.
   * If line moves in favor of our pick, steamScore is positive. If it moves against, it is negative.
   */
  public static calculateSteamScore(
    market: string,
    selection: string,
    openingLine: number,
    currentLine: number,
    openingOdds: number,
    currentOdds: number
  ): { lineMove: number; steamScore: number } {
    const lineMove = currentLine - openingLine;
    let steamScore = 0;

    const normalizedMarket = market.toLowerCase();
    const normalizedSelection = selection.toLowerCase();

    if (normalizedMarket === 'asian_handicap' || normalizedMarket === 'ah') {
      if (lineMove !== 0) {
        // selection 'home' expects line to move negative (e.g. -0.25 -> -0.5 is negative lineMove)
        if (normalizedSelection.includes('home')) {
          steamScore = lineMove < 0 ? 5 : -5;
        } else {
          steamScore = lineMove > 0 ? 5 : -5;
        }
      } else {
        // Fallback to odds movement
        if (currentOdds < openingOdds) {
          steamScore = 3;
        } else if (currentOdds > openingOdds) {
          steamScore = -3;
        }
      }
    } else if (normalizedMarket === 'over_under' || normalizedMarket === 'ou') {
      if (lineMove !== 0) {
        // selection 'over' expects positive line movement (e.g. 2.5 -> 2.75 is positive lineMove)
        if (normalizedSelection.includes('over')) {
          steamScore = lineMove > 0 ? 5 : -5;
        } else {
          steamScore = lineMove < 0 ? 5 : -5;
        }
      } else {
        // Fallback to odds movement
        if (currentOdds < openingOdds) {
          steamScore = 3;
        } else if (currentOdds > openingOdds) {
          steamScore = -3;
        }
      }
    } else {
      // Moneyline / H2H: Line is 0, compare odds
      if (currentOdds < openingOdds) {
        steamScore = 5;
      } else if (currentOdds > openingOdds) {
        steamScore = -5;
      }
    }

    return { lineMove, steamScore };
  }

  /**
   * Adjusts the model's raw confidence based on league quality score and steam score.
   */
  public static adjustConfidence(
    rawConfidence: number,
    qualityScore: number,
    steamScore: number
  ): number {
    let adjusted = rawConfidence;

    // League quality confidence adjustments
    if (qualityScore >= 80) {
      adjusted += 3;
    } else if (qualityScore < 50) {
      adjusted -= 5;
    }

    // Steam movement confidence adjustments
    adjusted += steamScore;

    // Clamp between 0 and 100
    return Math.max(0, Math.min(100, Math.round(adjusted)));
  }
}
