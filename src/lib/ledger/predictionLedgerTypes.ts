// ============================================================================
// CANONICAL PREDICTION LEDGER & BETTING PERFORMANCE TYPES
// ============================================================================
// Location: src/lib/ledger/predictionLedgerTypes.ts
//
// Invariants enforced:
// 1. Every prediction is permanently recorded (VALUE, NO_VALUE, HIGH, MEDIUM, LOW).
// 2. Canonical Prediction ID: Globally unique, immutable, deterministic.
// 3. Line-aware settlement: AH quarter lines, OU full/half/quarter lines, BTTS.
// 4. Default research stake: 1.0 unit.
// 5. Canonical ROI / Yield: total_profit / total_staked (losses never excluded).
// 6. CLV: Line-aware, never fabricated, status PENDING / AVAILABLE / UNAVAILABLE / INVALID.
// 7. Reconciliation: total = settled + pending + void + cancelled.
// ============================================================================

export type MarketType = 'AH' | 'OU' | 'BTTS';

export type LineType = 'FULL' | 'HALF' | 'QUARTER' | 'NONE';

export type PredictionConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'PASS';

export type ValueStatus = 'VALUE' | 'NO_VALUE' | 'DATA_UNAVAILABLE' | 'QUALIFIED' | 'RESEARCH_ONLY';

export type PredictionStatus = 'PENDING' | 'SETTLED' | 'VOID' | 'CANCELLED' | 'REJECTED';

export type SettlementOutcome =
  | 'WIN'
  | 'HALF_WIN'
  | 'PUSH'
  | 'HALF_LOSS'
  | 'LOSS'
  | 'VOID'
  | 'CANCELLED';

export type ClvStatus = 'PENDING' | 'AVAILABLE' | 'UNAVAILABLE' | 'INVALID';

export interface SettlementRevision {
  revisionId: string;
  previousOutcome: SettlementOutcome;
  newOutcome: SettlementOutcome;
  previousProfitUnits: number;
  newProfitUnits: number;
  timestampUtc: string;
  source: string;
  reason: string;
}

export interface CanonicalSettlementRecord {
  settlementId: string;
  predictionId: string;
  canonicalFixtureId: string;
  homeGoals: number;
  awayGoals: number;
  totalGoals: number;
  matchStatus: string; // 'FT', 'AET', 'PEN', 'CANC', 'ABD'
  outcome: SettlementOutcome;
  stakeUnits: number; // 1.0 default
  profitUnits: number; // WIN: stake * (odds - 1), HALF_WIN: stake * (odds - 1)/2, PUSH: 0, HALF_LOSS: -stake/2, LOSS: -stake, VOID: 0
  returnUnits: number; // stakeUnits + profitUnits
  closingOdds?: number | null;
  closingLine?: number | null;
  clv?: number | null;
  settledAt: string; // ISO 8601 UTC
  resultProvider: string;
  resultReceivedAt: string;
  revisions?: SettlementRevision[];
}

export interface CanonicalClvRecord {
  predictionOdds: number;
  predictionOddsTimestamp: string;
  closingOdds: number | null;
  closingOddsTimestamp: string | null;
  closingLine: number | null;
  clvAbsolute: number | null; // predictionOdds - closingOdds
  clvPercentage: number | null; // (predictionOdds / closingOdds) - 1
  clvStatus: ClvStatus;
  lineMatch: boolean;
  benchmarkSource: string; // 'Pinnacle'
}

export interface CanonicalPredictionRecord {
  // Identity & Keys
  predictionId: string;
  canonicalFixtureId: string;
  fixtureId?: string; // Provider fixture ID
  fixture: string; // 'Home vs Away'
  league: string; // 'Premier League'
  competition: string;
  country?: string;
  season?: string;
  homeTeam: string;
  awayTeam: string;
  kickoffTimestamp: string; // ISO 8601 UTC

  // Market & Selection
  market: MarketType;
  selection: string; // 'HOME', 'AWAY', 'OVER', 'UNDER', 'YES', 'NO'
  line: number | null; // e.g. 2.25, -0.75, null
  lineType: LineType;

  // Odds & Model at Prediction Time
  provider: string; // 'OddsPapi'
  bookmaker: string; // 'Pinnacle'
  marketOdds: number; // Decimal odds e.g. 1.95
  oddsTimestamp: string;
  modelProbability: number;
  calibratedProbability?: number;
  fairOdds: number;
  expectedValue: number; // (modelProbability * marketOdds) - 1 or settlement-aware EV
  edge: number; // modelProbability - marketImpliedProbability
  confidence: PredictionConfidence;
  confidenceScore: number; // 0..100
  valueStatus: ValueStatus;

  // Provenance & Versioning
  predictionTimestamp: string; // ISO 8601 UTC
  featureTimestamp: string;
  modelVersion: string;
  pipelineVersion: string;
  dataVersion: string;
  rawPredictionPayloadHash: string; // SHA-256
  inputSnapshotHash: string; // SHA-256

  // Lifecycle & Settlement
  status: PredictionStatus;
  settlement: CanonicalSettlementRecord | null;
  clvRecord: CanonicalClvRecord | null;
  revisions: SettlementRevision[];

  // Aliases for compatibility with legacy readers
  odds?: number;
  match?: string;
  ev?: number;
  createdAt: string;
  updatedAt: string;

  // Quota & Provenance metadata
  qualificationTier?: 'TIER_A' | 'TIER_B' | 'TIER_C' | 'TIER_D';
  quotaRequestId?: string;
  quotaCost?: number;
  sourceFeatures?: Record<string, any>;
  kickoffUtc?: string;
  predictionTimestampUtc?: string;
  oddsTimestampUtc?: string;
  oddsProvider?: string;
}

export interface BankrollCurvePoint {
  index: number;
  date: string;
  predictionId: string;
  fixture: string;
  market: MarketType;
  selection: string;
  line: number | null;
  odds: number;
  outcome: SettlementOutcome;
  stake: number;
  profit: number;
  grossReturn: number;
  bankroll: number;
  drawdownUnits: number;
  drawdownPct: number;
}

export interface DrawdownReport {
  peakBankroll: number;
  currentBankroll: number;
  currentDrawdownUnits: number;
  currentDrawdownPct: number;
  maxDrawdownUnits: number;
  maxDrawdownPct: number;
  peakDate: string | null;
  maxDrawdownDate: string | null;
  isRecovered: boolean;
}

export interface CalibrationBucket {
  bucketRange: string; // e.g. '0.50 - 0.60'
  minProb: number;
  maxProb: number;
  predictionsCount: number;
  empiricalWins: number;
  empiricalWinRatePct: number;
  expectedWinRatePct: number;
  brierScoreContribution: number;
}

export interface CalibrationReport {
  totalSettledWithProb: number;
  overallBrierScore: number;
  buckets: CalibrationBucket[];
}

export interface ClvProfitMatrix {
  positiveClvProfitCount: number;
  positiveClvProfitUnits: number;
  positiveClvLossCount: number;
  positiveClvLossUnits: number;
  negativeClvProfitCount: number;
  negativeClvProfitUnits: number;
  negativeClvLossCount: number;
  negativeClvLossUnits: number;
  neutralClvCount: number;
  totalWithClv: number;
}

export interface ValueBetMetrics {
  totalValueBets: number;
  settledValueBets: number;
  pendingValueBets: number;
  wins: number;
  losses: number;
  pushes: number;
  halfWins: number;
  halfLosses: number;
  hitRatePct: number; // (wins + 0.5 * halfWins) / settled * 100
  totalStaked: number;
  totalProfit: number;
  roiPct: number;
  yieldPct: number;
  averageEvPct: number;
  averageClvPct: number;
}

export interface DimensionMetricRow {
  key: string;
  label: string;
  totalPredictions: number;
  settledPredictions: number;
  pendingPredictions: number;
  wins: number;
  losses: number;
  pushes: number;
  halfWins: number;
  halfLosses: number;
  voids: number;
  totalStaked: number;
  totalProfit: number;
  totalReturn: number;
  roiPct: number;
  yieldPct: number;
  winRatePct: number;
  avgOdds: number;
  avgEvPct: number;
  avgClvPct: number;
  positiveClvRatePct: number;
}

export interface CanonicalPerformanceReport {
  generatedAtUtc: string;
  mode: 'UNIT_STAKE_RESEARCH' | 'USER_BANKROLL_SIMULATION';
  stakeUnit: number; // 1.0

  // Counts
  totalPredictions: number;
  settledPredictions: number;
  pendingPredictions: number;
  wins: number;
  losses: number;
  pushes: number;
  halfWins: number;
  halfLosses: number;
  voids: number;
  cancelled: number;

  // Financials
  totalStaked: number;
  totalProfit: number;
  totalReturn: number;
  roiDecimal: number;
  roiPct: number;
  yieldDecimal: number;
  yieldPct: number;

  // Rates
  winRatePct: number;
  pushRatePct: number;
  lossRatePct: number;

  // Odds & Model Metrics
  averageOdds: number;
  medianOdds: number;
  averageModelProbabilityPct: number;
  averageFairOdds: number;
  averageMarketOdds: number;
  averageEvPct: number;
  medianEvPct: number;

  // CLV Metrics
  averageClvPct: number;
  medianClvPct: number;
  positiveClvRatePct: number;
  totalClvAvailable: number;

  // Risk & Bankroll
  startingBankroll: number;
  currentBankroll: number;
  drawdown: DrawdownReport;
  sharpeRatio: number;

  // EV vs Realized P/L
  expectedProfitUnits: number;
  realizedProfitUnits: number;
  evErrorUnits: number; // realized - expected

  // Value Bets & Tiers
  valueBets: ValueBetMetrics;
  confidenceTiers: {
    high: DimensionMetricRow;
    medium: DimensionMetricRow;
    low: DimensionMetricRow;
  };

  // Breakdowns
  byMarket: Record<string, DimensionMetricRow>;
  byLineFamily: Record<string, DimensionMetricRow>;
  bySelection: Record<string, DimensionMetricRow>;
  byLeague: Record<string, DimensionMetricRow>;
  byBookmaker: Record<string, DimensionMetricRow>;
  byTime: Record<string, DimensionMetricRow>;

  // Diagnostics
  calibration: CalibrationReport;
  clvProfitMatrix: ClvProfitMatrix;
}

export interface ReconciliationReport {
  timestampUtc: string;
  status: 'RECONCILIATION_PASS' | 'RECONCILIATION_FAILURE';
  totalPredictions: number;
  settledCount: number;
  pendingCount: number;
  voidCount: number;
  cancelledCount: number;
  lifecycleBalanceValid: boolean; // total === settled + pending + void + cancelled
  stakedBalanceValid: boolean; // totalStaked === settledCount * 1.0 (for unit stake)
  profitSumValid: boolean; // totalProfit === sum(individual profit)
  oddsIntegrityValid: boolean; // stored odds === immutable entry odds
  clvIntegrityValid: boolean; // clv calculated only when valid closing odds exist
  discrepancies: string[];
}
