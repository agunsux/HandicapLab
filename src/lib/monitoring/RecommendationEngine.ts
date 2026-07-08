import { DriftReport, HealthScoreBreakdown, HealthSnapshot, Recommendation, CalibrationCandidate } from './types';

/**
 * Layer 6: Tiered Recommendation Engine
 *
 * Three levels of recommendations as per product spec:
 *
 * L1 — Human readable: What is happening?
 * L2 — Actionable: What should the operator do?
 * L3 — References: Which specific artifacts are relevant? (CalibrationRegistry cross-reference)
 *
 * Operator approval is always required. No automatic rollback.
 */

export class RecommendationEngine {
  static generate(
    snapshot: HealthSnapshot,
    drift: DriftReport,
    scoreBreakdown: HealthScoreBreakdown,
    calibrationCandidates: CalibrationCandidate[] = []
  ): Recommendation[] {
    const recs: Recommendation[] = [];

    // ── Calibration ──────────────────────────────────────────────────────────
    if (snapshot.ece > 0.07) {
      recs.push({
        level: 1,
        message: `Calibration is deteriorating. ECE is ${snapshot.ece.toFixed(3)} (threshold: 0.07).`,
      });
      recs.push({
        level: 2,
        action: 'Re-run calibration benchmark pipeline and compare against current method.',
        message: 'Suggested action: re-run calibration.',
      });
      if (calibrationCandidates.length > 0) {
        recs.push({
          level: 3,
          message: 'CalibrationRegistry candidates available for promotion:',
          calibratorCandidates: calibrationCandidates,
        });
      }
    }

    // ── Brier Score ──────────────────────────────────────────────────────────
    if (snapshot.brierScore > 0.24) {
      recs.push({
        level: 1,
        message: `Brier score is rising (${snapshot.brierScore.toFixed(3)}). Prediction quality is weakening.`,
      });
      recs.push({
        level: 2,
        action: 'Inspect recent match data for anomalies. Check feature pipeline for stale or shifted inputs.',
        message: 'Suggested action: inspect feature pipeline.',
      });
    }

    // ── Decision Quality ─────────────────────────────────────────────────────
    if (snapshot.decisionAccuracy < 0.52) {
      recs.push({
        level: 1,
        message: `Decision accuracy has dropped to ${(snapshot.decisionAccuracy * 100).toFixed(1)}%. Consider increasing DecisionGate thresholds.`,
      });
      recs.push({
        level: 2,
        action: 'Review DecisionGate confidence and EV thresholds. Cross-check with EvidenceAgreement failure rate.',
        message: 'Suggested action: tighten DecisionGate thresholds.',
      });
    }

    // ── Missed Opportunity Rate ───────────────────────────────────────────────
    if (snapshot.missedOpportunityRate > 0.35) {
      recs.push({
        level: 1,
        message: `Missed opportunity rate is ${(snapshot.missedOpportunityRate * 100).toFixed(1)}%. The model may be over-filtering.`,
      });
      recs.push({
        level: 2,
        action: 'Loosen confidence thresholds cautiously. Review skip rate distribution in RealtimeMetrics.',
        message: 'Suggested action: loosen skip threshold.',
      });
    }

    // ── Data Quality ──────────────────────────────────────────────────────────
    if (snapshot.dataQualityScore < 0.70) {
      recs.push({
        level: 1,
        message: `Data quality score is low (${(snapshot.dataQualityScore * 100).toFixed(0)}/100). Upstream data sources may be degraded.`,
      });
      recs.push({
        level: 2,
        action: 'Investigate upstream data pipelines. Check for missing features or stale market data.',
        message: 'Suggested action: investigate data sources.',
      });
    }

    // ── Structural Drift ──────────────────────────────────────────────────────
    if (drift.structuralDrift.isDrifted) {
      const drifted = drift.structuralDrift.details.map(d => d.metric).join(', ');
      recs.push({
        level: 1,
        message: `Structural drift detected vs Golden Baseline ${drift.structuralDrift.baselineVersion}: [${drifted}].`,
      });
      recs.push({
        level: 2,
        action: 'Rebuild and approve a new golden baseline if the drift is intentional (e.g., new season). Otherwise investigate root cause.',
        message: 'Suggested action: rebuild golden baseline or investigate root cause.',
      });
    }

    // ── Operational Drift ─────────────────────────────────────────────────────
    if (drift.operationalDrift.severity === 'critical') {
      recs.push({
        level: 1,
        message: `Critical operational drift detected in the last 24h. Metrics are deteriorating rapidly.`,
      });
      recs.push({
        level: 2,
        action: 'Immediately increase monitoring frequency. Pause betting signal generation pending investigation.',
        message: 'Suggested action: pause signal generation.',
      });
    }

    return recs;
  }
}
