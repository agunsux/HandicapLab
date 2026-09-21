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

export type ArchiveMarket = 'AH' | 'OU' | 'ML' | 'BTTS';

export type ArchiveDecision = 'VALUE_CANDIDATE' | 'WATCH' | 'NO_SIGNAL';

// Explicit Prediction Lifecycle (Gate 4)
export type PredictionLifecycle =
  | 'DRAFT'
  | 'PUBLISHED'
  | 'LIVE'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'VOID';

// Explicit Evidence & Validation Status (Gate 4)
export type EvidenceStatus =
  | 'DATA_VERIFIED'
  | 'MODEL_VERIFIED'
  | 'CLV_PENDING'
  | 'CLV_VERIFIED'
  | 'RESULT_VERIFIED';

export type ArchiveStatus =
  | PredictionLifecycle
  | 'GENERATED'
  | 'ACTIVE'
  | 'KICKED_OFF'
  | 'PENDING_SETTLEMENT'
  | 'SETTLED'
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
  resultReceivedAt?: string;
  resultProvider?: string;
  resultSource?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// THREE-SNAPSHOT EVIDENCE CONTRACTS (Gate 2 & 3)
// ────────────────────────────────────────────────────────────────────
export interface PriceSnapshot {
  snapshotId: string;
  provider: string; // 'OddsPapi'
  bookmaker: string; // 'Pinnacle' | 'Bet365' | string
  market: ArchiveMarket;
  selection: string;
  line: number | null;
  odds: number;
  timestamp?: string;
  timestampUtc?: string;
  fixtureId?: string;
  source?: string; // 'odds-by-tournaments' | 'odds-by-fixtures' | 'cache'
  provenanceHash?: string;
  impliedProbability?: number;
  devigProbability?: number;
  fixtureIdentity?: {
    fixtureId: string;
    homeTeam: string;
    awayTeam: string;
    kickoffUtc: string;
  };
}

export interface ClvBenchmarkRecord {
  status: 'PENDING' | 'CALCULATED' | 'VERIFIED' | 'VOID';
  entryBookmaker?: string;
  entryOdds?: number;
  entryTimestamp?: string;
  referenceBookmaker?: 'Pinnacle' | string;
  closingOdds: number | null;
  closingTimestamp?: string | null;
  closingTimestampUtc?: string | null;
  closingLine?: number | null;
  clv?: number | null; // (entryOdds / closingOdds) - 1
  clvValue?: number | null;
  clvRatio?: number | null;
  clvBps?: number | null;
  benchmarkSource?: string;
}

export interface SuggestedBet {
  bookmaker?: string; // e.g. 'Bet365' (or fallback 'Pinnacle')
  odds?: number;
  market?: ArchiveMarket;
  selection?: string;
  line?: number | null;
  edge?: number; // vs SALMO model fair odds
  expectedValue?: number;
  isSoftExecution?: boolean;
  qualifies?: boolean;
  timestamp?: string;
  // Aliases and rich fields
  qualified?: boolean;
  executionBookmaker?: string;
  executionOdds?: number;
  executionEdge?: number;
  ruleApplied?: string;
  disclaimer?: string;
}

// Disaggregated Pricing Pillars for API / Projections (Gate 2 & 5)
export interface ReferencePriceInfo {
  bookmaker: 'Pinnacle' | string;
  odds: number;
  devigProbability?: number;
  market: ArchiveMarket;
  line: number | null;
  selection: string;
  timestamp?: string;
  timestampUtc?: string;
}

export interface ModelPriceInfo {
  modelProbability: number;
  fairOdds: number;
  edge: number; // Model prob - devig market prob
  expectedValue: number; // (Model prob * Reference odds) - 1
  modelVersion: string;
}

export interface ExecutionPriceInfo {
  bookmaker: string; // 'Bet365'
  odds: number;
  market?: ArchiveMarket;
  selection?: string;
  line?: number | null;
  edge?: number; // vs model fair odds
  expectedValue?: number; // (Model prob * Execution odds) - 1
  isSuggested?: boolean;
  timestamp?: string;
  timestampUtc?: string;
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

  // Explicit Market Definition (strictly AH, OU, ML, BTTS)
  market: ArchiveMarket;
  line: number | null;
  selection: string;

  // Probabilities & Fair Values (SALMO Model)
  modelProbability: number;
  fairOdds: number;

  // Real Market Odds Snapshot (Pinnacle Benchmark)
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

  // Three-Snapshot Evidence Preservation (Gate 2 & 3)
  referenceSnapshot?: PriceSnapshot;
  executionSnapshot?: PriceSnapshot | null;
  closingSnapshot?: PriceSnapshot | null;

  // Disaggregated Pricing Pillars (Gate 2 & 5)
  referencePrice?: ReferencePriceInfo;
  modelPrice?: ModelPriceInfo;
  executionPrice?: ExecutionPriceInfo | null;

  // CLV Benchmark Governance (Pinnacle Benchmark - Gate 5)
  clvRecord?: ClvBenchmarkRecord;

  // Suggested Bet (Execution Qualification - Gate 3)
  suggestedBet?: SuggestedBet | null;

  // Disaggregated Lifecycle & Evidence State Machine (Gate 4)
  status: ArchiveStatus;
  lifecycle?: PredictionLifecycle;
  evidenceStatus?: EvidenceStatus;
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
  line: number | null;
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
  lifecycle?: PredictionLifecycle;
  evidenceStatus?: EvidenceStatus;
  modelVersion: string;
  horizonBucket: 'TODAY' | 'TOMORROW' | 'NEXT_7_DAYS';
  predictionTimestampUtc: string;
  oddsTimestampUtc: string;
  updatedAtUtc: string;

  // Three Disaggregated Pricing Pillars (Gate 2)
  referencePrice?: ReferencePriceInfo;
  modelPrice?: ModelPriceInfo;
  executionPrice?: ExecutionPriceInfo | null;
  suggestedBet?: SuggestedBet | null;
  clvStatus?: 'PENDING' | 'VERIFIED' | 'VOID';
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
