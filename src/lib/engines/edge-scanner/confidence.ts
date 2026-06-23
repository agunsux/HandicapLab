export class ConfidenceScanner {
  /**
   * Classifies a model prediction probability into confidence tiers.
   * 
   * @param probability Model prediction probability (0.0 to 1.0)
   */
  public static getConfidence(probability: number): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (probability >= 0.70) return 'HIGH';
    if (probability >= 0.50) return 'MEDIUM';
    return 'LOW';
  }
}
