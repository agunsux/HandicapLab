// EPIC 35 — Live Validation Platform — Core Domain Types
// ========================================================
// This subsystem is an OBSERVER. It never modifies predictions, never
// retrains, never tunes. Every record is immutable once appended.
//
// All timestamps are ISO-8601 strings so records are JSON-serializable
// and replay-deterministic across store implementations.

// ─── Shared primitives ──────────────────────────────────────────────────

export type LiveMarketKind = 'moneyline' | 'asian_handicap' | 'over_under';

export type LiveSelection = 'home' | 'draw' | 'away' | 'over' | 'under';

export type OddsPhase = 'opening' | 'prediction' | 'closing';

export type SettlementOutcome = 'win' | 'loss' | 'push' | 'half_win' | 'half_loss' | 'void';

export type RollingWindowDays = 7 | 30 | 90 | 365;

export const ROLLING_WINDOWS: RollingWindowDays[] = [7, 30, 90, 365];

/** Audit fields required on every persisted record (Data Model requirement). */
export interface AuditFields {
  /** ISO timestamp the record was created */
  createdAt: string;
  /** Component that produced the record, e.g. 'scheduler', 'settlement-engine' */
  createdBy: string;
  /** Record schema version for forward-compatible reads */
  schemaVersion: string;
  /** Correlation id linking a record to the run that produced it */
  correlationId: string;
}

// ─── Fixture / market views ─────────────────────────────────────────────

/** Minimal fixture view used inside the live-validation subsystem. */
export interface LiveFixture {
  fixtureId: string;
  league: string;
  season: string;
  homeTeam: string;
  awayTeam: string;
  /** ISO kickoff timestamp */
  kickoff: string;
  status?: 'upcoming' | 'live' | 'finished' | 'cancelled';
  homeScore?: number | null;
  awayScore?: number | null;
}

/** A single market quote (decimal odds) at a moment in time. */
export interface MarketQuote {
  market: LiveMarketKind;
  line: number;
  priceHome: number;
  priceAway: number;
  /** Only for moneyline */
  priceDraw: number | null;
  bookmaker: string;
}

/** The set of quotes available for one fixture at capture time. */
export interface FixtureOddsSet {
  fixtureId: string;
  capturedAt: string;
  quotes: MarketQuote[];
}

// ─── EPIC 35.2 — Immutable Prediction Snapshot ──────────────────────────

/** One market recommendation embedded in a prediction snapshot. */
export interface MarketRecommendation {
  market: LiveMarketKind;
  selection: LiveSelection;
  line: number;
  /** Model probability for the selection */
  modelProb: number;
  /** Vig-removed market implied probability for the selection */
  marketProb: number;
  /** Decimal odds available at prediction time */
  odds: number;
  /** modelProb - marketProb */
  edge: number;
  /** modelProb * odds - 1 */
  expectedValue: number;
  action: 'bet' | 'no_bet';
}

export interface PredictionSnapshotRecord extends AuditFields {
  id: string;

  // Fixture Information
  fixture: LiveFixture;

  // Model Information
  model: {
    modelVersion: string;
    featureVersion: string;
    calibrationVersion: string;
    researchManifestVersion: string;
    gitCommit: string;
    /** ISO timestamp the prediction was generated */
    predictionTimestamp: string;
  };

  // Prediction
  prediction: {
    homeProb: number;
    drawProb: number;
    awayProb: number;
    expectedGoalsHome: number;
    expectedGoalsAway: number;
    asianHandicap: MarketRecommendation | null;
    overUnder: MarketRecommendation | null;
    moneyline: MarketRecommendation | null;
    confidence: number;
    /** Best expected value across recommended markets */
    expectedValue: number;
  };

  // Market (odds at prediction time; opening/closing live in odds_snapshots)
  market: {
    predictionOdds: MarketQuote[];
  };

  /** Idempotency key: one prediction per fixture per model version. */
  idempotencyKey: string;
  /** SHA-256 of prediction inputs for reproducibility. */
  inputHash: string;
  /** SHA-256 chained with the previous snapshot — tamper-evident audit chain. */
  chainHash: string;
  previousSnapshotId: string | null;
}

// ─── EPIC 35.3 — Odds Tracking ──────────────────────────────────────────

export interface OddsSnapshotRecordLV extends AuditFields {
  id: string;
  fixtureId: string;
  phase: OddsPhase;
  quote: MarketQuote;
  capturedAt: string;
  chainHash: string;
  previousSnapshotId: string | null;
}

/** Derived market movement analytics for one fixture+market. */
export interface MarketMovement {
  fixtureId: string;
  market: LiveMarketKind;
  line: number;
  openingOdds: number | null;
  predictionOdds: number | null;
  closingOdds: number | null;
  /** (oddsTaken / closingOdds) - 1 for the recommended selection */
  clv: number | null;
  /** closing line minus opening line (AH/OU) or implied prob shift (ML) */
  lineMovement: number | null;
  /** True when odds shortened > steamThreshold between phases */
  steamMove: boolean;
  /** 1 - overround of the closing quote; higher = more efficient */
  marketEfficiency: number | null;
}

// ─── EPIC 35.4 — Settlement ─────────────────────────────────────────────

export interface SettlementRecordLV extends AuditFields {
  id: string;
  predictionId: string;
  fixtureId: string;
  league: string;
  market: LiveMarketKind;
  selection: LiveSelection;
  line: number;
  /** Flat 1-unit stake for validation accounting */
  stake: number;
  oddsTaken: number;
  closingOdds: number | null;
  homeScore: number;
  awayScore: number;
  outcome: SettlementOutcome;
  /** Total units returned including stake (e.g. win at 1.9 → 1.9) */
  unitsReturned: number;
  /** unitsReturned - stake */
  profit: number;
  /** profit / stake */
  roi: number;
  /** (oddsTaken / closingOdds) - 1, null when closing odds missing */
  clv: number | null;
  settledAt: string;
  /** Idempotency: one settlement per prediction+market */
  idempotencyKey: string;
}

// ─── EPIC 35.5 — Rolling Metrics ────────────────────────────────────────

export interface BreakdownMetrics {
  bets: number;
  roi: number;
  hitRate: number;
  profit: number;
  avgOdds: number;
  avgClv: number | null;
}

export interface RollingMetricsRecord extends AuditFields {
  id: string;
  /** ISO timestamp metrics were computed for */
  asOf: string;
  windowDays: RollingWindowDays;
  predictions: number;
  settledBets: number;
  roi: number;
  /** Profit per bet (yield) */
  yield: number;
  hitRate: number;
  avgOdds: number;
  avgExpectedValue: number;
  avgEdge: number;
  avgClv: number | null;
  /** Multiclass Brier on 1X2 probabilities */
  brierScore: number | null;
  logLoss: number | null;
  /** Mean absolute error of predicted total xG vs actual total goals */
  expectedGoalsError: number | null;
  maxDrawdown: number;
  sharpeRatio: number | null;
  kellyEfficiency: number | null;
  calibrationError: number | null;
  totalProfit: number;
  totalStaked: number;
  edgeDistribution: Array<{ bucket: string; count: number }>;
  leagueBreakdown: Record<string, BreakdownMetrics>;
  marketBreakdown: Record<string, BreakdownMetrics>;
  confidenceBreakdown: Record<string, BreakdownMetrics>;
}

// ─── EPIC 35.6 — Calibration Monitor ────────────────────────────────────

export interface CalibrationBucketLV {
  range: string;
  expected: number;
  observed: number;
  sampleSize: number;
}

export interface CalibrationHistoryRecord extends AuditFields {
  id: string;
  asOf: string;
  windowDays: number;
  sampleSize: number;
  ece: number;
  mce: number;
  buckets: CalibrationBucketLV[];
  /** ECE delta vs the previous calibration record (positive = degrading) */
  eceDrift: number | null;
}

// ─── EPIC 35.7 — Drift Detection ────────────────────────────────────────

export type DriftDimension =
  | 'feature'
  | 'prediction'
  | 'probability'
  | 'market'
  | 'league';

export type DriftSeverity = 'none' | 'warning' | 'critical';

export interface DriftEventRecord extends AuditFields {
  id: string;
  asOf: string;
  dimension: DriftDimension;
  metric: string;
  /** Population Stability Index between reference and current windows */
  psi: number;
  severity: DriftSeverity;
  referenceWindowDays: number;
  currentWindowDays: number;
  referenceSampleSize: number;
  currentSampleSize: number;
  detail: string;
}

// ─── EPIC 35.9 — Alerts ─────────────────────────────────────────────────

export type AlertSeverity = 'info' | 'warning' | 'critical';

export type AlertChannelKind = 'email' | 'discord' | 'slack' | 'webhook';

export interface AlertRecord extends AuditFields {
  id: string;
  rule: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  metric: string | null;
  value: number | null;
  threshold: number | null;
  channelsNotified: AlertChannelKind[];
  firedAt: string;
}

// ─── EPIC 35.10 — Weekly Scientific Report ──────────────────────────────

export interface WeeklyReportRecord extends AuditFields {
  id: string;
  /** ISO date the reporting week starts (inclusive) */
  weekStart: string;
  /** ISO date the reporting week ends (exclusive) */
  weekEnd: string;
  summary: {
    predictionCount: number;
    settledCount: number;
    roi: number;
    clv: number | null;
    calibrationError: number | null;
    hitRate: number;
    totalProfit: number;
  };
  confidenceDistribution: Record<string, number>;
  leagueComparison: Record<string, BreakdownMetrics>;
  marketComparison: Record<string, BreakdownMetrics>;
  bestCases: Array<{ predictionId: string; fixture: string; profit: number; market: string }>;
  worstCases: Array<{ predictionId: string; fixture: string; profit: number; market: string }>;
  modelStability: {
    driftEvents: number;
    criticalDriftEvents: number;
    confidenceDrift: number | null;
  };
  recommendations: string[];
  /** Exportable markdown rendering of the report */
  markdown: string;
}

// ─── Operational run reports (scheduler / settlement health) ────────────

export interface SchedulerRunReport {
  runId: string;
  startedAt: string;
  finishedAt: string;
  fixturesDiscovered: number;
  predictionsCreated: number;
  duplicatesSkipped: number;
  failures: Array<{ fixtureId: string; error: string }>;
  success: boolean;
}

export interface SettlementRunReport {
  runId: string;
  startedAt: string;
  finishedAt: string;
  candidates: number;
  settled: number;
  duplicatesSkipped: number;
  failures: Array<{ predictionId: string; error: string }>;
  success: boolean;
}
