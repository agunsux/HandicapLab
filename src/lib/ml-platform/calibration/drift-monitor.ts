export class DriftMonitor {
  /**
   * Calculates Expected Calibration Error (ECE).
   * 
   * @param rawProbs Array of predicted probabilities
   * @param actualOutcomes Array of actual binary outcomes (0 or 1)
   * @param bins Number of bins to partition the [0,1] space
   * @returns ECE score (0.0 = perfect calibration)
   */
  public static calculateECE(rawProbs: number[], actualOutcomes: number[], bins: number = 10): number {
    if (rawProbs.length !== actualOutcomes.length || rawProbs.length === 0) return 0;
    
    const binSize = 1.0 / bins;
    const totalSamples = rawProbs.length;
    let ece = 0;
    
    for (let i = 0; i < bins; i++) {
      const binLower = i * binSize;
      const binUpper = (i + 1) * binSize;
      
      let binCount = 0;
      let sumProbs = 0;
      let sumOutcomes = 0;
      
      for (let j = 0; j < totalSamples; j++) {
        const p = rawProbs[j];
        if (p >= binLower && (p < binUpper || (i === bins - 1 && p <= binUpper))) {
          binCount++;
          sumProbs += p;
          sumOutcomes += actualOutcomes[j];
        }
      }
      
      if (binCount > 0) {
        const avgProb = sumProbs / binCount;
        const avgOutcome = sumOutcomes / binCount;
        ece += (binCount / totalSamples) * Math.abs(avgProb - avgOutcome);
      }
    }
    
    return ece;
  }

  /**
   * Checks if the ECE breaches the maximum allowed threshold.
   * If true, the calibration route should be quarantined.
   */
  public static checkCircuitBreaker(ece: number, threshold: number = 0.025): boolean {
    return ece > threshold;
  }
}
