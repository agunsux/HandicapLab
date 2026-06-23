export class ValueDetector {
  /**
   * Compares model probability vs market odds.
   * Computes implied probability, expected value (EV), and raw edge.
   * 
   * @param modelProbability Model prediction probability (0.0 to 1.0)
   * @param marketOdds Decimal market odds (e.g. 1.95)
   */
  public static calculateEdge(
    modelProbability: number,
    marketOdds: number
  ): { expectedValue: number; edge: number; impliedProbability: number } {
    if (marketOdds <= 1.0) {
      return { expectedValue: 0, edge: 0, impliedProbability: 1.0 };
    }

    const impliedProbability = 1 / marketOdds;
    const expectedValue = modelProbability * marketOdds - 1;
    const edge = modelProbability - impliedProbability;

    return {
      expectedValue: Number(expectedValue.toFixed(4)),
      edge: Number(edge.toFixed(4)),
      impliedProbability: Number(impliedProbability.toFixed(4))
    };
  }

  /**
   * Asserts whether a given expected value represents a valid edge.
   */
  public static isValue(expectedValue: number, minEV: number = 0.0): boolean {
    return expectedValue > minEV;
  }
}
