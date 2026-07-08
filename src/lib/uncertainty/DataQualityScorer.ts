export class DataQualityScorer {
  /**
   * Scores the quality of data inputs.
   * A lower score implies high uncertainty due to data quality issues.
   * 
   * @param missingFeatures Percentage of missing features (0 to 1)
   * @param freshness Hours since last data update
   * @param marketDepth Proxy for liquidity/market depth (0 to 1)
   */
  static score(missingFeatures: number, freshness: number, marketDepth: number): number {
    let score = 1.0;
    
    // Penalize missing features heavily
    score -= (missingFeatures * 1.5);
    
    // Penalize stale data (e.g., more than 24 hours old)
    if (freshness > 24) {
      score -= Math.min(0.5, (freshness - 24) * 0.05);
    }
    
    // Penalize low market depth
    if (marketDepth < 0.3) {
      score -= 0.2;
    }
    
    return Math.max(0, Math.min(1, score));
  }
}
