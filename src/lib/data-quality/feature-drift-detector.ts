// EPIC 39 — Feature Distribution Drift Detector
// Compares historical feature baseline vs today's feature distribution and emits drift warnings.

export interface FeatureDriftReport {
  featureName: string;
  historicalMean: number;
  currentMean: number;
  driftPct: number;
  alertLevel: 'NORMAL' | 'WARNING' | 'CRITICAL';
  summaryText: string;
}

export class FeatureDriftDetectorEngine {
  /** Detect drift between historical feature mean and current snapshot mean */
  static detectFeatureDrift(
    featureName: string,
    historicalMean: number,
    currentMean: number,
    warningThresholdPct: number = 15.0,
    criticalThresholdPct: number = 30.0
  ): FeatureDriftReport {
    const driftPct = Number((Math.abs((currentMean - historicalMean) / Math.max(0.01, historicalMean)) * 100).toFixed(1));

    let alertLevel: 'NORMAL' | 'WARNING' | 'CRITICAL' = 'NORMAL';
    if (driftPct >= criticalThresholdPct) alertLevel = 'CRITICAL';
    else if (driftPct >= warningThresholdPct) alertLevel = 'WARNING';

    return {
      featureName,
      historicalMean,
      currentMean,
      driftPct,
      alertLevel,
      summaryText: `Feature Drift [${featureName}]: Historical mean ${historicalMean} vs Today ${currentMean} (${driftPct}% drift). Level: ${alertLevel}.`,
    };
  }
}
