// EPIC 35 — In-Memory Live Validation Store
// Append-only: appended records are deep-frozen and duplicates are rejected.
// Used for tests, historical replay, and as the engine behind the file store.

import {
  DuplicateRecordError,
  type LiveValidationStore,
} from './types';
import type {
  PredictionSnapshotRecord,
  OddsSnapshotRecordLV,
  SettlementRecordLV,
  RollingMetricsRecord,
  CalibrationHistoryRecord,
  DriftEventRecord,
  AlertRecord,
  WeeklyReportRecord,
  OddsPhase,
  LiveMarketKind,
} from '../types';

function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    for (const value of Object.values(obj as Record<string, unknown>)) {
      deepFreeze(value);
    }
  }
  return obj;
}

/** Deep-clone then freeze, so callers can never mutate stored state. */
function seal<T>(record: T): T {
  return deepFreeze(JSON.parse(JSON.stringify(record)) as T);
}

function inRange(ts: string, from?: string, to?: string): boolean {
  if (from && ts < from) return false;
  if (to && ts >= to) return false;
  return true;
}

export class MemoryLiveValidationStore implements LiveValidationStore {
  protected predictions: PredictionSnapshotRecord[] = [];
  protected oddsSnapshots: OddsSnapshotRecordLV[] = [];
  protected settlements: SettlementRecordLV[] = [];
  protected rollingMetrics: RollingMetricsRecord[] = [];
  protected calibrationHistory: CalibrationHistoryRecord[] = [];
  protected driftEvents: DriftEventRecord[] = [];
  protected alerts: AlertRecord[] = [];
  protected weeklyReports: WeeklyReportRecord[] = [];

  private predictionIds = new Set<string>();
  private predictionKeys = new Set<string>();
  private predictionFixtures = new Set<string>();
  private oddsIds = new Set<string>();
  private settlementKeys = new Set<string>();
  private settlementPredictionMarkets = new Set<string>();

  /** Hook for persistent subclasses — called after a successful append. */
  protected onAppend(_collection: string, _record: unknown): void {
    // no-op in memory store
  }

  // ── prediction_snapshots ──────────────────────────────────────────────

  async appendPrediction(record: PredictionSnapshotRecord): Promise<void> {
    if (this.predictionIds.has(record.id)) {
      throw new DuplicateRecordError('prediction_snapshots', record.id);
    }
    if (this.predictionKeys.has(record.idempotencyKey)) {
      throw new DuplicateRecordError('prediction_snapshots', record.idempotencyKey);
    }
    const sealed = seal(record);
    this.predictions.push(sealed);
    this.predictionIds.add(record.id);
    this.predictionKeys.add(record.idempotencyKey);
    this.predictionFixtures.add(record.fixture.fixtureId);
    this.onAppend('prediction_snapshots', sealed);
  }

  async getPrediction(id: string): Promise<PredictionSnapshotRecord | null> {
    return this.predictions.find(p => p.id === id) ?? null;
  }

  async getPredictionByIdempotencyKey(key: string): Promise<PredictionSnapshotRecord | null> {
    return this.predictions.find(p => p.idempotencyKey === key) ?? null;
  }

  async hasPredictionForFixture(fixtureId: string): Promise<boolean> {
    return this.predictionFixtures.has(fixtureId);
  }

  async listPredictions(filter?: {
    from?: string;
    to?: string;
    league?: string;
    fixtureId?: string;
  }): Promise<PredictionSnapshotRecord[]> {
    return this.predictions
      .filter(p => {
        if (filter?.fixtureId && p.fixture.fixtureId !== filter.fixtureId) return false;
        if (filter?.league && p.fixture.league !== filter.league) return false;
        return inRange(p.model.predictionTimestamp, filter?.from, filter?.to);
      })
      .sort((a, b) => a.model.predictionTimestamp.localeCompare(b.model.predictionTimestamp));
  }

  async getLastPrediction(): Promise<PredictionSnapshotRecord | null> {
    return this.predictions.length > 0 ? this.predictions[this.predictions.length - 1] : null;
  }

  // ── odds_snapshots ────────────────────────────────────────────────────

  async appendOddsSnapshot(record: OddsSnapshotRecordLV): Promise<void> {
    if (this.oddsIds.has(record.id)) {
      throw new DuplicateRecordError('odds_snapshots', record.id);
    }
    const sealed = seal(record);
    this.oddsSnapshots.push(sealed);
    this.oddsIds.add(record.id);
    this.onAppend('odds_snapshots', sealed);
  }

  async listOddsSnapshots(fixtureId: string): Promise<OddsSnapshotRecordLV[]> {
    return this.oddsSnapshots
      .filter(o => o.fixtureId === fixtureId)
      .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  }

  async getOddsByPhase(
    fixtureId: string,
    market: LiveMarketKind,
    line: number,
    phase: OddsPhase
  ): Promise<OddsSnapshotRecordLV | null> {
    const matches = this.oddsSnapshots
      .filter(
        o =>
          o.fixtureId === fixtureId &&
          o.phase === phase &&
          o.quote.market === market &&
          o.quote.line === line
      )
      .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
    // opening = first capture; prediction/closing = latest capture in phase
    if (matches.length === 0) return null;
    return phase === 'opening' ? matches[0] : matches[matches.length - 1];
  }

  async getLastOddsSnapshot(fixtureId: string): Promise<OddsSnapshotRecordLV | null> {
    const list = await this.listOddsSnapshots(fixtureId);
    return list.length > 0 ? list[list.length - 1] : null;
  }

  // ── settlements ───────────────────────────────────────────────────────

  async appendSettlement(record: SettlementRecordLV): Promise<void> {
    if (this.settlementKeys.has(record.idempotencyKey)) {
      throw new DuplicateRecordError('settlements', record.idempotencyKey);
    }
    const predictionMarketKey = `${record.predictionId}:${record.market}`;
    if (this.settlementPredictionMarkets.has(predictionMarketKey)) {
      throw new DuplicateRecordError('settlements', predictionMarketKey);
    }
    const sealed = seal(record);
    this.settlements.push(sealed);
    this.settlementKeys.add(record.idempotencyKey);
    this.settlementPredictionMarkets.add(predictionMarketKey);
    this.onAppend('settlements', sealed);
  }

  async getSettlementByIdempotencyKey(key: string): Promise<SettlementRecordLV | null> {
    return this.settlements.find(s => s.idempotencyKey === key) ?? null;
  }

  async hasSettlementForPrediction(predictionId: string, market: LiveMarketKind): Promise<boolean> {
    return this.settlementPredictionMarkets.has(`${predictionId}:${market}`);
  }

  async listSettlements(filter?: { from?: string; to?: string; league?: string }): Promise<SettlementRecordLV[]> {
    return this.settlements
      .filter(s => {
        if (filter?.league && s.league !== filter.league) return false;
        return inRange(s.settledAt, filter?.from, filter?.to);
      })
      .sort((a, b) => a.settledAt.localeCompare(b.settledAt));
  }

  // ── rolling_metrics ───────────────────────────────────────────────────

  async appendRollingMetrics(record: RollingMetricsRecord): Promise<void> {
    const sealed = seal(record);
    this.rollingMetrics.push(sealed);
    this.onAppend('rolling_metrics', sealed);
  }

  async getLatestRollingMetrics(windowDays: number): Promise<RollingMetricsRecord | null> {
    const matching = this.rollingMetrics.filter(m => m.windowDays === windowDays);
    return matching.length > 0 ? matching[matching.length - 1] : null;
  }

  async listRollingMetrics(windowDays?: number): Promise<RollingMetricsRecord[]> {
    return windowDays === undefined
      ? [...this.rollingMetrics]
      : this.rollingMetrics.filter(m => m.windowDays === windowDays);
  }

  // ── calibration_history ───────────────────────────────────────────────

  async appendCalibrationRecord(record: CalibrationHistoryRecord): Promise<void> {
    const sealed = seal(record);
    this.calibrationHistory.push(sealed);
    this.onAppend('calibration_history', sealed);
  }

  async getLatestCalibration(): Promise<CalibrationHistoryRecord | null> {
    return this.calibrationHistory.length > 0
      ? this.calibrationHistory[this.calibrationHistory.length - 1]
      : null;
  }

  async listCalibrationHistory(): Promise<CalibrationHistoryRecord[]> {
    return [...this.calibrationHistory];
  }

  // ── drift_events ──────────────────────────────────────────────────────

  async appendDriftEvent(record: DriftEventRecord): Promise<void> {
    const sealed = seal(record);
    this.driftEvents.push(sealed);
    this.onAppend('drift_events', sealed);
  }

  async listDriftEvents(filter?: { from?: string; to?: string }): Promise<DriftEventRecord[]> {
    return this.driftEvents.filter(d => inRange(d.asOf, filter?.from, filter?.to));
  }

  // ── alert_history ─────────────────────────────────────────────────────

  async appendAlert(record: AlertRecord): Promise<void> {
    const sealed = seal(record);
    this.alerts.push(sealed);
    this.onAppend('alert_history', sealed);
  }

  async listAlerts(filter?: { from?: string; to?: string; rule?: string }): Promise<AlertRecord[]> {
    return this.alerts.filter(a => {
      if (filter?.rule && a.rule !== filter.rule) return false;
      return inRange(a.firedAt, filter?.from, filter?.to);
    });
  }

  // ── weekly_reports ────────────────────────────────────────────────────

  async appendWeeklyReport(record: WeeklyReportRecord): Promise<void> {
    const sealed = seal(record);
    this.weeklyReports.push(sealed);
    this.onAppend('weekly_reports', sealed);
  }

  async listWeeklyReports(): Promise<WeeklyReportRecord[]> {
    return [...this.weeklyReports];
  }
}
