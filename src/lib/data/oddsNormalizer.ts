// Odds Normalization Layer (Math calculations for overrounds & probabilities)
// Location: src/lib/data/oddsNormalizer.ts

export interface NormalizationResult {
  impliedProbabilities: Record<string, number>;
  normalizedProbabilities: Record<string, number>;
  overround: number;
  expectedMargin: number;
}

export class OddsNormalizer {
  /**
   * Normalizes decimal odds.
   * Works for 2-way (AH, OU) and 3-way (ML/1X2) outcomes.
   * 
   * @param odds Map of selection keys to decimal odds value, e.g. { home: 1.85, away: 2.05 }
   */
  public static normalize(odds: Record<string, number>): NormalizationResult {
    const impliedProbabilities: Record<string, number> = {};
    let sumImplied = 0;

    // Calculate raw implied probability (1 / decimal_odds)
    for (const [selection, val] of Object.entries(odds)) {
      if (val && val > 1.0) {
        const prob = 1 / val;
        impliedProbabilities[selection] = Number(prob.toFixed(6));
        sumImplied += prob;
      } else {
        impliedProbabilities[selection] = 0;
      }
    }

    const overround = sumImplied - 1.0;
    const normalizedProbabilities: Record<string, number> = {};

    // Normalize probabilities to sum up to 1.0
    for (const [selection, prob] of Object.entries(impliedProbabilities)) {
      if (sumImplied > 0) {
        normalizedProbabilities[selection] = Number((prob / sumImplied).toFixed(6));
      } else {
        normalizedProbabilities[selection] = 0;
      }
    }

    // Expected margin = overround / sum_implied
    const expectedMargin = sumImplied > 0 ? overround / sumImplied : 0;

    return {
      impliedProbabilities,
      normalizedProbabilities,
      overround: Number(overround.toFixed(6)),
      expectedMargin: Number(expectedMargin.toFixed(6))
    };
  }
}
