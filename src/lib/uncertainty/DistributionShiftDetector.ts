export class DistributionShiftDetector {
  /**
   * Evaluates macro-level distribution shifts (e.g., new season, new manager, structural changes).
   * Returns a score where 1 means completely in-distribution (stable) and 0 means massive shift.
   * 
   * @param isNewSeason boolean
   * @param recentManagerChange boolean
   * @param structuralRuleChange boolean
   */
  static evaluateShift(isNewSeason: boolean, recentManagerChange: boolean, structuralRuleChange: boolean): number {
    let score = 1.0;
    
    // A new season introduces moderate uncertainty
    if (isNewSeason) score -= 0.15;
    
    // A manager change invalidates historical tactical data heavily
    if (recentManagerChange) score -= 0.3;
    
    // Major structural or rule changes (e.g. VAR introduction)
    if (structuralRuleChange) score -= 0.2;
    
    return Math.max(0, score);
  }
}
