import { HealthSnapshot, HealthScoreBreakdown, HealthStatus } from './types';

/**
 * Layer 4: HealthScore
 *
 * Produces a single, weighted 0-100 score from all metric dimensions.
 * Enables the dashboard to show a single headline number without
 * operators needing to interpret 7 independent metrics.
 *
 * Score thresholds:
 *   >= 80 → HEALTHY
 *   >= 60 → DEGRADED
 *   <  60 → CRITICAL
 *
 * If sample size is insufficient, returns INSUFFICIENT_DATA.
 */

const WEIGHTS = {
  predictionQuality: 0.25,
  calibration: 0.20,
  decisionQuality: 0.20,
  dataQuality: 0.15,
  drift: 0.10,
  latency: 0.05,
  coverage: 0.05,
};

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}

function statusFromScore(score: number, hasData: boolean): HealthStatus {
  if (!hasData) return 'INSUFFICIENT_DATA';
  if (score >= 80) return 'HEALTHY';
  if (score >= 60) return 'DEGRADED';
  return 'CRITICAL';
}

export class HealthScore {
  /**
   * Calculates the weighted health score from a HealthSnapshot.
   *
   * @param snapshot   The HealthSnapshot to score.
   * @param driftScore A 0-100 score representing drift health (100 = no drift, 0 = severe drift).
   *                   Computed externally from DriftDetector output.
   * @param latencyMs  Current average latency in ms. Used for latency component.
   * @param coveragePct Percentage of available matches covered (0-1).
   */
  static calculate(
    snapshot: HealthSnapshot,
    driftScore: number = 100,
    latencyMs: number = 0,
    coveragePct: number = 1.0
  ): HealthScoreBreakdown {
    const hasData = snapshot.winRate > 0 || snapshot.brierScore < 0.25;

    // 1. Prediction Quality (win rate, CLV) — 25%
    //    Win rate: 50% → 50pts, 60% → 100pts, <40% → 0pts
    const winRateScore = clamp((snapshot.winRate - 0.4) / 0.25 * 100);
    const clvScore = snapshot.avgClv !== null ? clamp(50 + snapshot.avgClv * 10) : 50;
    const predictionQuality = clamp((winRateScore + clvScore) / 2);

    // 2. Calibration (Brier + ECE) — 20%
    //    Brier: 0.20 → 100pts, 0.25 → 50pts, 0.30 → 0pts
    const brierScore = clamp((0.30 - snapshot.brierScore) / 0.10 * 100);
    //    ECE: 0 → 100pts, 0.05 → 50pts, 0.10 → 0pts
    const eceScore = clamp((0.10 - snapshot.ece) / 0.10 * 100);
    const calibration = clamp((brierScore + eceScore) / 2);

    // 3. Decision Quality (accuracy + missed opportunity) — 20%
    const decAccScore = clamp((snapshot.decisionAccuracy - 0.4) / 0.35 * 100);
    const moScore = clamp((0.5 - snapshot.missedOpportunityRate) / 0.5 * 100);
    const decisionQuality = clamp((decAccScore + moScore) / 2);

    // 4. Data Quality — 15%
    const dataQuality = clamp(snapshot.dataQualityScore * 100);

    // 5. Drift (from external DriftDetector) — 10%
    const drift = clamp(driftScore);

    // 6. Latency — 5%
    //    < 100ms → 100pts, 500ms → 50pts, > 1000ms → 0pts
    const latency = clamp((1000 - latencyMs) / 1000 * 100);

    // 7. Coverage — 5%
    const coverage = clamp(coveragePct * 100);

    const rawScore =
      predictionQuality * WEIGHTS.predictionQuality +
      calibration       * WEIGHTS.calibration +
      decisionQuality   * WEIGHTS.decisionQuality +
      dataQuality       * WEIGHTS.dataQuality +
      drift             * WEIGHTS.drift +
      latency           * WEIGHTS.latency +
      coverage          * WEIGHTS.coverage;

    const score = Math.round(clamp(rawScore));
    const status = statusFromScore(score, hasData);

    return {
      score,
      status,
      components: {
        predictionQuality: Math.round(predictionQuality),
        calibration: Math.round(calibration),
        decisionQuality: Math.round(decisionQuality),
        dataQuality: Math.round(dataQuality),
        drift: Math.round(drift),
        latency: Math.round(latency),
        coverage: Math.round(coverage),
      },
    };
  }
}
