export interface ReliabilityMetrics {
  sampleSize: number;
  avgBrierScore: number;
  coverage: number; // ratio (0.0 to 1.0)
}

export interface ReliabilityResult {
  reliable: boolean;
  reasons: string[];
}

export class ReliabilityChecker {
  /**
   * Asserts model reliability flags based on metrics.
   * Check rules:
   * - Sample size >= 100 predictions
   * - Average Brier score < 0.25
   * - Coverage >= 80% (0.80) of matches scanned
   * 
   * @param metrics Calculated reliability inputs
   */
  public static check(metrics: ReliabilityMetrics): ReliabilityResult {
    const reasons: string[] = [];

    if (metrics.sampleSize < 100) {
      reasons.push(`Insufficient predictions sample size: ${metrics.sampleSize} (required >= 100)`);
    }

    if (metrics.avgBrierScore >= 0.25) {
      reasons.push(`Average Brier score too high: ${metrics.avgBrierScore.toFixed(4)} (required < 0.25)`);
    }

    if (metrics.coverage < 0.80) {
      reasons.push(`Scan coverage rate too low: ${(metrics.coverage * 100).toFixed(1)}% (required >= 80.0%)`);
    }

    return {
      reliable: reasons.length === 0,
      reasons
    };
  }
}
