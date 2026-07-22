// EPIC 35 — Live Validation Store Contract
// Append-only by design: there is deliberately NO update or delete API.
// Records become immutable the moment they are appended.

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

export class DuplicateRecordError extends Error {
  constructor(collection: string, key: string) {
    super(`Duplicate record rejected in ${collection}: ${key}`);
    this.name = 'DuplicateRecordError';
  }
}

export class ImmutabilityViolationError extends Error {
  constructor(detail: string) {
    super(`Immutability violation: ${detail}`);
    this.name = 'ImmutabilityViolationError';
  }
}

export interface LiveValidationStore {
  // prediction_snapshots — append only, unique on idempotencyKey
  appendPrediction(record: PredictionSnapshotRecord): Promise<void>;
  getPrediction(id: string): Promise<PredictionSnapshotRecord | null>;
  getPredictionByIdempotencyKey(key: string): Promise<PredictionSnapshotRecord | null>;
  hasPredictionForFixture(fixtureId: string): Promise<boolean>;
  listPredictions(filter?: {
    from?: string;
    to?: string;
    league?: string;
    fixtureId?: string;
  }): Promise<PredictionSnapshotRecord[]>;
  getLastPrediction(): Promise<PredictionSnapshotRecord | null>;

  // odds_snapshots — append only
  appendOddsSnapshot(record: OddsSnapshotRecordLV): Promise<void>;
  listOddsSnapshots(fixtureId: string): Promise<OddsSnapshotRecordLV[]>;
  getOddsByPhase(
    fixtureId: string,
    market: LiveMarketKind,
    line: number,
    phase: OddsPhase
  ): Promise<OddsSnapshotRecordLV | null>;
  getLastOddsSnapshot(fixtureId: string): Promise<OddsSnapshotRecordLV | null>;

  // settlements — append only, unique on idempotencyKey
  appendSettlement(record: SettlementRecordLV): Promise<void>;
  getSettlementByIdempotencyKey(key: string): Promise<SettlementRecordLV | null>;
  hasSettlementForPrediction(predictionId: string, market: LiveMarketKind): Promise<boolean>;
  listSettlements(filter?: { from?: string; to?: string; league?: string }): Promise<SettlementRecordLV[]>;

  // rolling_metrics — append only (history preserved)
  appendRollingMetrics(record: RollingMetricsRecord): Promise<void>;
  getLatestRollingMetrics(windowDays: number): Promise<RollingMetricsRecord | null>;
  listRollingMetrics(windowDays?: number): Promise<RollingMetricsRecord[]>;

  // calibration_history — append only
  appendCalibrationRecord(record: CalibrationHistoryRecord): Promise<void>;
  getLatestCalibration(): Promise<CalibrationHistoryRecord | null>;
  listCalibrationHistory(): Promise<CalibrationHistoryRecord[]>;

  // drift_events — append only
  appendDriftEvent(record: DriftEventRecord): Promise<void>;
  listDriftEvents(filter?: { from?: string; to?: string }): Promise<DriftEventRecord[]>;

  // alert_history — append only
  appendAlert(record: AlertRecord): Promise<void>;
  listAlerts(filter?: { from?: string; to?: string; rule?: string }): Promise<AlertRecord[]>;

  // weekly_reports — append only
  appendWeeklyReport(record: WeeklyReportRecord): Promise<void>;
  listWeeklyReports(): Promise<WeeklyReportRecord[]>;
}
