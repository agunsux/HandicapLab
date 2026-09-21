// ============================================================================
// HANDICAPLAB CANONICAL PREDICTION ARCHIVE & PROVENANCE TYPES
// ============================================================================
// Location: src/lib/archive/types.ts
//
// Invariants enforced:
// 1. Markets strictly: AH, OU, BTTS only.
// 2. Archive is the permanent historical evidence record; Daily Picks is a projection.
// 3. Quarter-line outcomes: WIN, HALF_WIN, PUSH, HALF_LOSS, LOSS.
// 4. Yield is strictly total_profit / total_staked.
// 5. Model versioning is immutable: historical predictions are never rewritten.
// ============================================================================

export type ArchiveMarket = 'AH' | 'OU' | 'BTTS';

export type ArchiveDecision = 'VALUE_CANDIDATE' | 'WATCH' | 'NO_SIGNAL';

export type ArchiveStatus =
  | 'GENERATED'
  | 'ACTIVE'
  | 'KICKED_OFF'
  | 'PENDING_SETTLEMENT'
  | 'SETTLED'
  | 'VOID'
  | 'CANCELLED'
  | 'REJECTED';

export type QuarterLineOutcome =
  | 'WIN'
  | 'HALF_WIN'
  | 'PUSH'
  | 'HALF_LOSS'
  | 'LOSS'
  | 'VOID';

export interface ScoreGridSummary {
  homeXG: number;
  awayXG: number;
  rho: number;
  scoreGridHash?: string;
}

export interface PredictionSettlementRecord {
  settlementId?: string;
  outcome: QuarterLineOutcome;
  profitUnits: number; // 1 unit basis: WIN -> (odds - 1), HALF_WIN -> (odds - 1)/2, PUSH -> 0, HALF_LOSS -> -0.5, LOSS -> -1.0
  stakeUnits?: number;  // Default 1.0 unit
  returnUnits?: number; // stake + profit
  homeGoals: number;
  awayGoals: number;
  finalStatus?: string; // FT, AET, PEN, CANC, ABD, etc.
  closingOdds?: number;
  clv?: number; // (entryOdds / closingOdds) - 1
  settledAt: string;
  resultProvider?: string;
  resultSource?: string;
}

export interface PredictionArchiveRecord {
  // Identity
  predictionId: string;
  fixtureId: string;
  canonicalMatchId: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  leagueKey: string;

  // Market definition (strictly AH, OU, BTTS)
  market: ArchiveMarket;
  line: number;
  selection: string;

  // Probabilities & Fair Values
  modelProbability: number;
  fairOdds: number;

  // Real Market Odds Snapshot
  marketOdds: number;
  bookmaker: string; // Pinnacle ground truth
  oddsProvider: string; // OddsPapi

  // Gating & Edge
  edge: number;
  expectedValue: number;
  decision: ArchiveDecision;
  confidence: number;
  strengthLevel: 'STRONG' | 'MODERATE' | 'SPECULATIVE' | 'WEAK' | 'INSUFFICIENT' | string;
  signalColor: 'green' | 'amber' | 'yellow' | 'gray' | 'red' | string;

  // Timestamps
  predictionTimestamp: string;
  oddsTimestamp: string;
  kickoffTimestamp: string;

  // Model & Provenance Versioning
  modelVersion: string;
  modelParametersVersion: string;
  dataVersion: string;
  featureSnapshotId: string;
  oddsSnapshotId: string;
  provenanceHash: string;

  // Mathematical state for forensic reconstruction
  scoreGridSummary: ScoreGridSummary;

  // Lifecycle State Machine
  status: ArchiveStatus;
  rejectionReason?: string | null;

  // Result & Settlement
  settlement: PredictionSettlementRecord | null;

  // Audit timestamps
  createdAt: string;
  updatedAt: string;
}

export interface DailyPickProjection {
  predictionId: string;
  fixtureId: string;
  canonicalMatchId: string;
  match: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  leagueKey: string;
  kickoffUtc: string;
  market: ArchiveMarket;
  line: number;
  selection: string;
  modelProbability: number;
  fairOdds: number;
  marketOdds: number;
  marketBookmaker: string;
  edge: number;
  expectedValue: number;
  confidence: number;
  decision: ArchiveDecision;
  verdict: 'LAYAK' | 'PANTAU' | 'LEWATI';
  signalColor: 'green' | 'amber' | 'yellow' | 'gray' | 'red' | string;
  status: ArchiveStatus;
  modelVersion: string;
  horizonBucket: 'TODAY' | 'TOMORROW' | 'NEXT_7_DAYS';
  predictionTimestampUtc: string;
  oddsTimestampUtc: string;
  updatedAtUtc: string;
}

export interface DailyPickRunSnapshot {
  runId: string;
  runTimestamp: string;
  coverageStart: string;
  coverageEnd: string;
  fixturesScanned: number;
  fixturesWithOdds: number;
  predictionsGenerated: number;
  actionablePicks: number;
  modelVersion: string;
}

export interface SalmoSyncResponse {
  success: boolean;
  timestampUtc: string;
  syncChecksum: string;
  dataState: 'REAL' | 'CACHED' | 'NO_FIXTURES' | 'NO_QUALIFIED_PICKS' | 'DATA_UNAVAILABLE';
  counts: {
    totalArchived: number;
    dailyPicks: number;
    settled: number;
    pending: number;
  };
  dailyPicks: DailyPickProjection[];
  predictions: PredictionArchiveRecord[];
  performance: {
    today: any;
    yesterday: any;
    last7Days: any;
    last30Days: any;
    season: any;
    allTime: any;
  };
  discrepanciesCount?: number;
}

export interface ReconciliationDiscrepancy {
  discrepancyId: string;
  type: 'MISSING_IN_SALMO' | 'STALE_SNAPSHOT' | 'SETTLEMENT_MISMATCH' | 'ODDS_MISMATCH' | 'DUPLICATE';
  recordId: string;
  expected: any;
  actual: any;
  detectedAt: string;
  severity: 'WARNING' | 'CRITICAL';
}

export interface ReconciliationReport {
  reconciledAtUtc: string;
  handicapLabCount: number;
  salmoCount: number;
  isConsistent: boolean;
  discrepancies: ReconciliationDiscrepancy[];
  syncLagSeconds: number;
}
