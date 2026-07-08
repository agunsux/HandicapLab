import { HealthSnapshot, HealthStatus, DeepAnalysisReport } from './types';

/**
 * Layer 8: Hourly Health Snapshot Writer
 *
 * Reads the current metric state and writes an immutable HealthSnapshot.
 * This is called by the hourly cron. After writing, RealtimeMetrics is reset.
 *
 * The snapshot is what the dashboard always reads from — never raw metrics.
 */
export class HealthSnapshotWriter {
  private static snapshots: HealthSnapshot[] = [];

  static write(snapshot: HealthSnapshot): HealthSnapshot {
    const record = { ...snapshot, id: Math.random().toString(36).substring(7) };
    this.snapshots.push(record);
    return record;
  }

  /**
   * Returns the last N snapshots for a model version.
   */
  static getRecent(modelVersion: string, n: number = 24): HealthSnapshot[] {
    return this.snapshots
      .filter((s) => s.modelVersion === modelVersion)
      .slice(-n)
      .reverse();
  }

  /**
   * Returns the snapshot closest to `hoursAgo` hours in the past.
   */
  static getAtOffset(modelVersion: string, hoursAgo: number): HealthSnapshot | null {
    const cutoff = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    const candidates = this.snapshots
      .filter((s) => s.modelVersion === modelVersion && s.timestamp <= cutoff)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return candidates[0] ?? null;
  }

  static _clear(): void {
    this.snapshots = [];
  }
}

/**
 * Layer 9: Daily Deep Analysis
 *
 * Runs once per day. Computes expensive metrics:
 * PSI, KL Divergence, feature drift, calibration drift, decision drift,
 * FP/FN trends, and root cause hints.
 */
export class DailyDeepAnalysis {
  /**
   * Runs a full deep analysis comparing current distribution to a baseline.
   *
   * @param currentDistribution  Array of recent predicted probabilities
   * @param baselineDistribution Array of baseline predicted probabilities
   */
  static run(
    currentDistribution: number[],
    baselineDistribution: number[],
    featureImportanceShift: Record<string, number> = {}
  ): DeepAnalysisReport {
    const psiScore = this.computePSI(currentDistribution, baselineDistribution);
    const klDivergence = this.computeKL(currentDistribution, baselineDistribution);

    // Feature drift: flag features where importance shifted > 20%
    const featureDrift: Record<string, number> = {};
    for (const [feature, shift] of Object.entries(featureImportanceShift)) {
      if (Math.abs(shift) > 0.2) featureDrift[feature] = shift;
    }

    // Simplified trends — would use real outcome windows in production
    const falsePositiveTrend = psiScore > 0.2 ? 'degrading' : 'stable';
    const falseNegativeTrend = klDivergence > 0.1 ? 'degrading' : 'stable';

    const rootCauseHints: string[] = [];
    if (psiScore > 0.2) rootCauseHints.push('High PSI: prediction distribution has significantly shifted. Check training data recency.');
    if (klDivergence > 0.1) rootCauseHints.push('High KL Divergence: model output distribution diverging from baseline.');
    if (Object.keys(featureDrift).length > 0) {
      rootCauseHints.push(`Feature importance drift detected: [${Object.keys(featureDrift).join(', ')}]. Retrain or re-weight may be needed.`);
    }

    return {
      psiScore: parseFloat(psiScore.toFixed(4)),
      klDivergence: parseFloat(klDivergence.toFixed(4)),
      featureDrift,
      calibrationDrift: psiScore,    // Approximation — use real calibration window in production
      decisionDrift: klDivergence,
      falsePositiveTrend,
      falseNegativeTrend,
      rootCauseHints,
      analysisDate: new Date(),
    };
  }

  /**
   * Population Stability Index (PSI).
   * PSI < 0.10 → stable, 0.10-0.20 → minor shift, > 0.20 → major shift.
   */
  private static computePSI(current: number[], baseline: number[]): number {
    const bins = 10;
    const binSize = 1.0 / bins;
    let psi = 0;
    for (let i = 0; i < bins; i++) {
      const lo = i * binSize, hi = (i + 1) * binSize;
      const curFrac = Math.max(0.0001, current.filter(v => v >= lo && v < hi).length / (current.length || 1));
      const baseFrac = Math.max(0.0001, baseline.filter(v => v >= lo && v < hi).length / (baseline.length || 1));
      psi += (curFrac - baseFrac) * Math.log(curFrac / baseFrac);
    }
    return Math.max(0, psi);
  }

  /**
   * KL Divergence from baseline to current.
   */
  private static computeKL(current: number[], baseline: number[]): number {
    const bins = 10;
    const binSize = 1.0 / bins;
    let kl = 0;
    for (let i = 0; i < bins; i++) {
      const lo = i * binSize, hi = (i + 1) * binSize;
      const p = Math.max(0.0001, current.filter(v => v >= lo && v < hi).length / (current.length || 1));
      const q = Math.max(0.0001, baseline.filter(v => v >= lo && v < hi).length / (baseline.length || 1));
      kl += p * Math.log(p / q);
    }
    return Math.max(0, kl);
  }
}
