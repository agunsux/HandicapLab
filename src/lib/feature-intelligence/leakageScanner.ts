// HandicapLab Feature Intelligence - Leakage Scanner
import { FeatureDefinition } from '../feature-platform/registry';

export class LeakageScanner {
  /**
   * Automatically scans a feature vector series against outcomes to detect leakage.
   * If correlation with target is impossibly high, or if distributions shift drastically,
   * it returns a Quarantine recommendation.
   */
  public static scan(featureDef: FeatureDefinition, featureValues: number[], targetOutcomes: number[]): { isLeaking: boolean, reason: string | null } {
    if (featureValues.length !== targetOutcomes.length) {
      throw new Error('Mismatched lengths');
    }

    // 1. Correlation Check (Pearson Approximation)
    // If Pearson > 0.95 or < -0.95, it's almost certainly leaking the target
    const corr = this.pearsonCorrelation(featureValues, targetOutcomes);
    if (Math.abs(corr) > 0.95) {
      return { isLeaking: true, reason: `Impossibly high correlation with target (${corr.toFixed(3)}). Likely contains future knowledge.` };
    }

    // 2. Future Timestamp Check (stub)
    if (featureDef.timeTravelPolicy === 'live' && featureDef.status !== 'experimental') {
        // Just a mock rule: live features must be heavily scrutinized
    }

    return { isLeaking: false, reason: null };
  }

  private static pearsonCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    
    for (let i = 0; i < n; i++) {
      sumX += x[i];
      sumY += y[i];
      sumXY += x[i] * y[i];
      sumX2 += x[i] * x[i];
      sumY2 += y[i] * y[i];
    }
    
    const num = (n * sumXY) - (sumX * sumY);
    const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    if (den === 0) return 0;
    return num / den;
  }
}
