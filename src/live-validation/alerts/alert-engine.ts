// EPIC 35.9 — Alert Engine (rules + dispatch)
// Evaluates health rules over rolling metrics, calibration, drift and
// operational run reports. Fires alerts with per-rule cooldown, records
// every alert immutably, and dispatches to configured channels.
//
// Rules covered (spec):
//   ROI below threshold, CLV negative, calibration deterioration,
//   Brier increase, drawdown limit, abnormal prediction volume,
//   scheduler failure, settlement failure, odds capture failure.

import * as crypto from 'crypto';
import type {
  AlertChannelKind,
  AlertRecord,
  AlertSeverity,
  SchedulerRunReport,
  SettlementRunReport,
} from '../types';
import type { LiveValidationStore } from '../store/types';
import type { LiveValidationConfig } from '../config';
import type { Clock } from '../scheduler/prediction-scheduler';
import type { AlertChannel } from './channels';

export interface AlertCandidate {
  rule: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  metric: string | null;
  value: number | null;
  threshold: number | null;
}

export class AlertEngine {
  constructor(
    private deps: {
      store: LiveValidationStore;
      config: LiveValidationConfig;
      channels: AlertChannel[];
      clock?: Clock;
      idFactory?: () => string;
    }
  ) {}

  private now(): Date {
    return this.deps.clock ? this.deps.clock() : new Date();
  }

  private newId(): string {
    return this.deps.idFactory ? this.deps.idFactory() : crypto.randomUUID();
  }

  /** Evaluate all metric-based rules and fire any breaches. */
  async run(correlationId = 'alert-engine'): Promise<AlertRecord[]> {
    const candidates = await this.evaluateRules();
    const fired: AlertRecord[] = [];
    for (const candidate of candidates) {
      const record = await this.fire(candidate, correlationId);
      if (record) fired.push(record);
    }
    return fired;
  }

  /** Rule evaluation over the latest 30d rolling metrics + calibration. */
  async evaluateRules(): Promise<AlertCandidate[]> {
    const { store, config } = this.deps;
    const t = config.alerts;
    const candidates: AlertCandidate[] = [];

    const m30 = await store.getLatestRollingMetrics(30);
    if (m30) {
      if (m30.roi < t.minRoi30d) {
        candidates.push({
          rule: 'roi_below_threshold',
          severity: 'critical',
          title: '30-day ROI below threshold',
          message: `Rolling 30d ROI is ${(m30.roi * 100).toFixed(2)}% (threshold ${(t.minRoi30d * 100).toFixed(2)}%).`,
          metric: 'roi_30d',
          value: m30.roi,
          threshold: t.minRoi30d,
        });
      }
      if (m30.avgClv !== null && m30.avgClv < t.minClv30d) {
        candidates.push({
          rule: 'clv_negative',
          severity: 'warning',
          title: '30-day CLV negative',
          message: `Rolling 30d average CLV is ${(m30.avgClv * 100).toFixed(2)}% (threshold ${(t.minClv30d * 100).toFixed(2)}%).`,
          metric: 'clv_30d',
          value: m30.avgClv,
          threshold: t.minClv30d,
        });
      }
      if (m30.brierScore !== null && m30.brierScore > t.maxBrier30d) {
        candidates.push({
          rule: 'brier_increased',
          severity: 'warning',
          title: '30-day Brier score elevated',
          message: `Rolling 30d Brier is ${m30.brierScore} (threshold ${t.maxBrier30d}).`,
          metric: 'brier_30d',
          value: m30.brierScore,
          threshold: t.maxBrier30d,
        });
      }
      if (m30.maxDrawdown > t.maxDrawdown30d) {
        candidates.push({
          rule: 'drawdown_exceeded',
          severity: 'critical',
          title: '30-day drawdown limit exceeded',
          message: `Rolling 30d max drawdown is ${m30.maxDrawdown} units (limit ${t.maxDrawdown30d}).`,
          metric: 'max_drawdown_30d',
          value: m30.maxDrawdown,
          threshold: t.maxDrawdown30d,
        });
      }
    }

    const calibration = await store.getLatestCalibration();
    if (calibration && calibration.ece > t.maxEce30d) {
      candidates.push({
        rule: 'calibration_deteriorated',
        severity: 'warning',
        title: 'Calibration error above threshold',
        message: `Latest ECE is ${calibration.ece} on ${calibration.sampleSize} samples (threshold ${t.maxEce30d}).`,
        metric: 'ece',
        value: calibration.ece,
        threshold: t.maxEce30d,
      });
    }

    // Prediction volume over the last 24h
    const asOf = this.now().toISOString();
    const dayAgo = new Date(this.now().getTime() - 86_400_000).toISOString();
    const daily = await store.listPredictions({ from: dayAgo, to: asOf });
    if (daily.length < t.minDailyPredictions || daily.length > t.maxDailyPredictions) {
      candidates.push({
        rule: 'prediction_volume_abnormal',
        severity: 'warning',
        title: 'Prediction volume abnormal',
        message: `${daily.length} predictions in the last 24h (expected ${t.minDailyPredictions}..${t.maxDailyPredictions}).`,
        metric: 'daily_predictions',
        value: daily.length,
        threshold: t.minDailyPredictions,
      });
    }

    return candidates;
  }

  /** Alert on a failed scheduler run (operational health). */
  async reportSchedulerRun(report: SchedulerRunReport, correlationId = 'scheduler-health'): Promise<AlertRecord | null> {
    if (report.success && report.failures.length === 0) return null;
    return this.fire(
      {
        rule: 'scheduler_failure',
        severity: 'critical',
        title: 'Prediction scheduler failure',
        message: `Scheduler run ${report.runId} had ${report.failures.length} failure(s): ${report.failures.map(f => `${f.fixtureId}: ${f.error}`).join('; ')}`,
        metric: 'scheduler_failures',
        value: report.failures.length,
        threshold: 0,
      },
      correlationId
    );
  }

  /** Alert on a failed settlement run (operational health). */
  async reportSettlementRun(report: SettlementRunReport, correlationId = 'settlement-health'): Promise<AlertRecord | null> {
    if (report.success && report.failures.length === 0) return null;
    return this.fire(
      {
        rule: 'settlement_failure',
        severity: 'critical',
        title: 'Settlement engine failure',
        message: `Settlement run ${report.runId} had ${report.failures.length} failure(s): ${report.failures.map(f => `${f.predictionId}: ${f.error}`).join('; ')}`,
        metric: 'settlement_failures',
        value: report.failures.length,
        threshold: 0,
      },
      correlationId
    );
  }

  /** Alert on odds capture failures (operational health). */
  async reportOddsCaptureFailure(fixtureId: string, error: string, correlationId = 'odds-health'): Promise<AlertRecord | null> {
    return this.fire(
      {
        rule: 'odds_capture_failure',
        severity: 'warning',
        title: 'Odds capture failure',
        message: `Failed to capture odds for fixture ${fixtureId}: ${error}`,
        metric: 'odds_capture_failures',
        value: 1,
        threshold: 0,
      },
      correlationId
    );
  }

  /** Fire a single alert with cooldown + immutable recording + dispatch. */
  async fire(candidate: AlertCandidate, correlationId: string): Promise<AlertRecord | null> {
    const { store, config, channels } = this.deps;
    const firedAt = this.now().toISOString();

    // Cooldown — suppress the same rule within cooldownHours
    const cooldownFrom = new Date(
      this.now().getTime() - config.alerts.cooldownHours * 3_600_000
    ).toISOString();
    const recent = await store.listAlerts({ from: cooldownFrom, rule: candidate.rule });
    if (recent.length > 0) return null;

    // Dispatch best-effort — record which channels succeeded
    const notified: AlertChannelKind[] = [];
    const draft: AlertRecord = {
      id: this.newId(),
      rule: candidate.rule,
      severity: candidate.severity,
      title: candidate.title,
      message: candidate.message,
      metric: candidate.metric,
      value: candidate.value,
      threshold: candidate.threshold,
      channelsNotified: [],
      firedAt,
      createdAt: firedAt,
      createdBy: 'alert-engine',
      schemaVersion: config.schemaVersion,
      correlationId,
    };

    for (const channel of channels) {
      try {
        await channel.send(draft);
        notified.push(channel.kind);
      } catch {
        // Delivery failure must never block alert recording
      }
    }

    const record: AlertRecord = { ...draft, channelsNotified: notified };
    await store.appendAlert(record);
    return record;
  }
}
