import { HealthSnapshot, ModelHealthReport, DriftReport } from './types';
import { HealthScore } from './HealthScore';
import { DriftDetector } from './DriftDetector';
import { GoldenBaselineRegistry } from './GoldenBaselineRegistry';
import { RecommendationEngine } from './RecommendationEngine';
import { HealthEventLog } from './HealthEvent';
import { HealthSnapshotWriter } from './HealthSnapshotWriter';
import { dispatchModelAlert } from './alerts';

/**
 * Layer 10: ModelHealthMonitor — Full Pipeline Orchestrator
 *
 * Single entry point that wires together:
 *   MetricCollector → DriftDetector → HealthScore → HealthReport → AlertDispatcher → HealthEvent
 *
 * Called by the hourly cron job. Emits events, writes snapshots, dispatches alerts.
 *
 * Design principle: This module NEVER takes automatic action on the model.
 * It only observes, measures, recommends, and alerts.
 */
export class ModelHealthMonitor {
  /**
   * Run the full monitoring pipeline given a current HealthSnapshot.
   *
   * @param current            Freshly computed HealthSnapshot for this cycle
   * @param avgLatencyMs       Average inference latency from RealtimeMetrics
   * @param coveragePct        Fraction of available matches covered (0-1)
   * @param calibrationCandidates   Optional: candidates from CalibrationRegistry for L3 recs
   */
  static async run(
    current: HealthSnapshot,
    avgLatencyMs: number = 0,
    coveragePct: number = 1.0,
    calibrationCandidates: import('./types').CalibrationCandidate[] = []
  ): Promise<ModelHealthReport> {
    const modelVersion = current.modelVersion;

    // 1. Fetch reference snapshots for drift comparison
    const prev24h = HealthSnapshotWriter.getAtOffset(modelVersion, 24);
    const goldenBaseline = GoldenBaselineRegistry.getActive();
    const goldenSnapshot = goldenBaseline?.snapshot ?? null;
    const goldenVersion = goldenBaseline?.version ?? 'none';

    // 2. Detect drift (operational + structural)
    const drift: DriftReport = DriftDetector.detect(current, prev24h, goldenSnapshot, goldenVersion);

    // 3. Convert drift severity to a numeric score (100 = no drift, 0 = critical drift)
    const driftScore =
      drift.overallSeverity === 'critical' ? 20
      : drift.overallSeverity === 'warning' ? 60
      : 100;

    // 4. Calculate HealthScore
    const healthScoreBreakdown = HealthScore.calculate(current, driftScore, avgLatencyMs, coveragePct);

    // Enrich snapshot with score and status
    const enrichedSnapshot: HealthSnapshot = {
      ...current,
      healthScore: healthScoreBreakdown.score,
      healthStatus: healthScoreBreakdown.status,
    };

    // 5. Write immutable snapshot
    HealthSnapshotWriter.write(enrichedSnapshot);

    // 6. Generate tiered recommendations
    const recommendations = RecommendationEngine.generate(
      enrichedSnapshot,
      drift,
      healthScoreBreakdown,
      calibrationCandidates
    );

    // 7. Emit health events
    HealthEventLog.emit(
      'SNAPSHOT_WRITTEN',
      'info',
      modelVersion,
      `Hourly snapshot written. HealthScore: ${healthScoreBreakdown.score}/100 (${healthScoreBreakdown.status}).`,
      { score: healthScoreBreakdown.score, status: healthScoreBreakdown.status }
    );

    if (drift.operationalDrift.isDrifted) {
      HealthEventLog.emit(
        'CALIBRATION_DRIFT',
        drift.operationalDrift.severity === 'critical' ? 'critical' : 'warning',
        modelVersion,
        `Operational drift detected: [${drift.operationalDrift.details.map(d => d.metric).join(', ')}].`,
        { drift: drift.operationalDrift }
      );
    }

    if (drift.structuralDrift.isDrifted) {
      HealthEventLog.emit(
        'BASELINE_COMPARISON_FAILED',
        drift.structuralDrift.severity === 'critical' ? 'critical' : 'warning',
        modelVersion,
        `Structural drift vs Golden Baseline ${goldenVersion}: [${drift.structuralDrift.details.map(d => d.metric).join(', ')}].`,
        { drift: drift.structuralDrift }
      );
    }

    if (healthScoreBreakdown.status === 'CRITICAL' || healthScoreBreakdown.status === 'DEGRADED') {
      HealthEventLog.emit(
        'HEALTH_SCORE_DROPPED',
        healthScoreBreakdown.status === 'CRITICAL' ? 'critical' : 'warning',
        modelVersion,
        `Health score dropped to ${healthScoreBreakdown.score}/100 (${healthScoreBreakdown.status}).`,
        { score: healthScoreBreakdown.score }
      );
    }

    // 8. Dispatch alert to system_alerts table (respects cooldown in insertAlert)
    const allDriftedMetrics = [
      ...drift.operationalDrift.details.map(d => d.metric),
      ...drift.structuralDrift.details.map(d => d.metric),
    ];

    await dispatchModelAlert(
      modelVersion,
      healthScoreBreakdown.status,
      healthScoreBreakdown.score,
      [...new Set(allDriftedMetrics)]
    );

    // 9. Return the full report
    const events = HealthEventLog.recent(modelVersion, 50);

    return {
      status: healthScoreBreakdown.status,
      healthScore: healthScoreBreakdown,
      snapshot: enrichedSnapshot,
      drift,
      recommendations,
      events,
      generatedAt: new Date(),
    };
  }
}
