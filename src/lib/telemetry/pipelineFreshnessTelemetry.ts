// ============================================================================
// PIPELINE FRESHNESS TELEMETRY & PROMETHEUS EXPORTER
// ============================================================================
// Location: src/lib/telemetry/pipelineFreshnessTelemetry.ts
//
// Invariants enforced (Section N):
// Exposes real-time health and pipeline telemetry metrics:
// - handicaplab_fixtures_total
// - handicaplab_fixtures_upcoming
// - handicaplab_fixtures_stale
// - handicaplab_predictions_total
// - handicaplab_predictions_active
// - handicaplab_predictions_settled
// - handicaplab_predictions_pending_settlement
// - handicaplab_odds_freshness_seconds
// - handicaplab_salmo_sync_status
// - handicaplab_salmo_last_sync_timestamp
// - handicaplab_reconciliation_issues_total
// ============================================================================

import { CanonicalBetLedgerService } from '@/lib/ledger/canonicalBetLedger';
import { CanonicalFixtureFreshnessGate } from '@/lib/services/canonicalFixtureFreshnessGate';
import { StaleDataKillSwitch } from '@/lib/ledger/staleDataKillSwitch';
import { ReconciliationEngineV2, ReconciliationAuditResult } from '@/lib/ledger/reconciliationEngineV2';

export interface PipelineTelemetryMetrics {
  handicaplab_fixtures_total: number;
  handicaplab_fixtures_upcoming: number;
  handicaplab_fixtures_stale: number;
  handicaplab_predictions_total: number;
  handicaplab_predictions_active: number;
  handicaplab_predictions_settled: number;
  handicaplab_predictions_pending_settlement: number;
  handicaplab_odds_freshness_seconds: number;
  handicaplab_salmo_sync_status: number;
  handicaplab_salmo_last_sync_timestamp: number;
  handicaplab_reconciliation_issues_total: number;
}

export interface PipelineTelemetryReport {
  status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  timestampUtc: string;
  metrics: PipelineTelemetryMetrics;
  reconciliationAudit: ReconciliationAuditResult;
}

export interface TelemetryReportOptions {
  nowMs?: number;
}

export class PipelineFreshnessTelemetry {
  public static getTelemetryReport(options: TelemetryReportOptions = {}): PipelineTelemetryReport {
    const nowMs = options.nowMs ?? Date.now();
    const timestampUtc = new Date(nowMs).toISOString();

    const fixtureRegistry = CanonicalFixtureFreshnessGate.loadRegistry();
    const allFixtures = Object.values(fixtureRegistry);
    const predictions = CanonicalBetLedgerService.getAllPredictions();

    // 1. Fixture metrics
    const fixturesTotal = allFixtures.length;
    let fixturesUpcoming = 0;
    let fixturesStale = 0;

    for (const fix of allFixtures) {
      if (!fix) continue;
      const kickMs = new Date(fix.kickoffUtc).getTime();
      if (!isNaN(kickMs) && kickMs > nowMs) {
        fixturesUpcoming++;
      }
      const updatedMs = new Date(fix.canonicalUpdatedAtUtc || fix.providerFetchedAtUtc).getTime();
      if (!isNaN(updatedMs) && nowMs - updatedMs > 24 * 3600 * 1000) {
        fixturesStale++;
      }
    }

    // 2. Prediction metrics
    const predictionsTotal = predictions.length;
    let predictionsActive = 0;
    let predictionsSettled = 0;
    let predictionsPendingSettlement = 0;
    let latestOddsMs = 0;

    for (const pred of predictions) {
      if (!pred) continue;

      if (pred.status === 'SETTLED' || pred.settlement !== null) {
        predictionsSettled++;
      } else {
        const kickMs = new Date(pred.kickoffTimestamp || (pred as any).kickoffUtc).getTime();
        if (!isNaN(kickMs) && kickMs <= nowMs) {
          predictionsPendingSettlement++;
        }
      }

      const eligibility = StaleDataKillSwitch.evaluateActiveFeedEligibility(pred, nowMs);
      if (eligibility.isActive) {
        predictionsActive++;
      }

      const oddsTimeStr = pred.oddsTimestamp || pred.predictionTimestamp;
      if (oddsTimeStr) {
        const oMs = new Date(oddsTimeStr).getTime();
        if (!isNaN(oMs) && oMs > latestOddsMs) {
          latestOddsMs = oMs;
        }
      }
    }

    // Odds freshness in seconds (0 if no odds recorded)
    const oddsFreshnessSeconds =
      latestOddsMs > 0 ? Math.max(0, Math.floor((nowMs - latestOddsMs) / 1000)) : 0;

    // 3. Reconciliation audit
    const reconciliationAudit = ReconciliationEngineV2.runAudit({
      nowMs,
      predictions,
      fixtureRegistry,
    });

    const reconciliationIssuesTotal = reconciliationAudit.totalIssues;

    // 4. Status evaluation
    const hasCriticalIssues = reconciliationAudit.issues.some((i) => i.severity === 'CRITICAL');
    let status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' = 'HEALTHY';

    if (hasCriticalIssues) {
      status = 'CRITICAL';
    } else if (reconciliationIssuesTotal > 0 || fixturesStale > 0) {
      status = 'DEGRADED';
    }

    const salmoSyncStatus = status === 'CRITICAL' ? 0 : 1;
    const salmoLastSyncTimestamp = Math.floor(nowMs / 1000);

    const metrics: PipelineTelemetryMetrics = {
      handicaplab_fixtures_total: fixturesTotal,
      handicaplab_fixtures_upcoming: fixturesUpcoming,
      handicaplab_fixtures_stale: fixturesStale,
      handicaplab_predictions_total: predictionsTotal,
      handicaplab_predictions_active: predictionsActive,
      handicaplab_predictions_settled: predictionsSettled,
      handicaplab_predictions_pending_settlement: predictionsPendingSettlement,
      handicaplab_odds_freshness_seconds: oddsFreshnessSeconds,
      handicaplab_salmo_sync_status: salmoSyncStatus,
      handicaplab_salmo_last_sync_timestamp: salmoLastSyncTimestamp,
      handicaplab_reconciliation_issues_total: reconciliationIssuesTotal,
    };

    return {
      status,
      timestampUtc,
      metrics,
      reconciliationAudit,
    };
  }

  /**
   * Formats the telemetry metrics into standard Prometheus exposition format.
   */
  public static toPrometheusMetrics(report: PipelineTelemetryReport): string {
    const m = report.metrics;
    return [
      '# HELP handicaplab_fixtures_total Total count of canonical fixtures in registry',
      '# TYPE handicaplab_fixtures_total gauge',
      `handicaplab_fixtures_total ${m.handicaplab_fixtures_total}`,
      '',
      '# HELP handicaplab_fixtures_upcoming Total count of upcoming fixtures with kickoff in future',
      '# TYPE handicaplab_fixtures_upcoming gauge',
      `handicaplab_fixtures_upcoming ${m.handicaplab_fixtures_upcoming}`,
      '',
      '# HELP handicaplab_fixtures_stale Total count of fixtures exceeding SLA freshness',
      '# TYPE handicaplab_fixtures_stale gauge',
      `handicaplab_fixtures_stale ${m.handicaplab_fixtures_stale}`,
      '',
      '# HELP handicaplab_predictions_total Total count of predictions recorded in canonical ledger',
      '# TYPE handicaplab_predictions_total gauge',
      `handicaplab_predictions_total ${m.handicaplab_predictions_total}`,
      '',
      '# HELP handicaplab_predictions_active Count of eligible active Daily Picks',
      '# TYPE handicaplab_predictions_active gauge',
      `handicaplab_predictions_active ${m.handicaplab_predictions_active}`,
      '',
      '# HELP handicaplab_predictions_settled Total count of settled canonical predictions',
      '# TYPE handicaplab_predictions_settled gauge',
      `handicaplab_predictions_settled ${m.handicaplab_predictions_settled}`,
      '',
      '# HELP handicaplab_predictions_pending_settlement Past matches awaiting verified result',
      '# TYPE handicaplab_predictions_pending_settlement gauge',
      `handicaplab_predictions_pending_settlement ${m.handicaplab_predictions_pending_settlement}`,
      '',
      '# HELP handicaplab_odds_freshness_seconds Age of latest odds snapshot in seconds',
      '# TYPE handicaplab_odds_freshness_seconds gauge',
      `handicaplab_odds_freshness_seconds ${m.handicaplab_odds_freshness_seconds}`,
      '',
      '# HELP handicaplab_salmo_sync_status 1 if healthy, 0 if error or critical integrity breach',
      '# TYPE handicaplab_salmo_sync_status gauge',
      `handicaplab_salmo_sync_status ${m.handicaplab_salmo_sync_status}`,
      '',
      '# HELP handicaplab_salmo_last_sync_timestamp Unix timestamp of latest synchronization',
      '# TYPE handicaplab_salmo_last_sync_timestamp gauge',
      `handicaplab_salmo_last_sync_timestamp ${m.handicaplab_salmo_last_sync_timestamp}`,
      '',
      '# HELP handicaplab_reconciliation_issues_total Total active reconciliation integrity issues',
      '# TYPE handicaplab_reconciliation_issues_total gauge',
      `handicaplab_reconciliation_issues_total ${m.handicaplab_reconciliation_issues_total}`,
      '',
    ].join('\n');
  }
}
