// ============================================================================
// HIGH-CONFIDENCE PREDICTION LEDGER & SETTLEMENT DATA CONTRACTS
// ============================================================================
// Location: src/lib/ledger/types.ts
//
// Invariants:
// 1. High confidence qualification is strictly confidence_score > 70.
// 2. Virtual Research bet: stake_units = 1.0 (zero real money claims).
// 3. Immutable snapshot preserved at prediction time.
// 4. Point-in-time guarantee: prediction_created_at < kickoff_utc.
// 5. Atomic state machine: QUALIFIED -> RECORDED -> LOCKED -> AWAITING_RESULT -> SETTLED.
// ============================================================================

import { CanonicalMarket } from '@/lib/daily-picks/types';

export type LedgerState =
  | 'QUALIFIED'
  | 'RECORDED'
  | 'LOCKED'
  | 'AWAITING_RESULT'
  | 'SETTLED'
  | 'REJECTED'
  | 'VOID'
  | 'CANCELLED'
  | 'DATA_ERROR';

export type SettlementOutcome = 'WIN' | 'HALF_WIN' | 'PUSH' | 'HALF_LOSS' | 'LOSS' | 'VOID';

export interface HighConfidenceLedgerEntry {
  // Identity & Links
  ledgerId: string; // Deterministic: led_{fixtureId}_{market}_{line}_{selection}
  signalId: string;
  fixtureId: string;
  canonicalMatchId: string;

  // Market & Selection
  market: CanonicalMarket;
  line: number | null;
  selection: string;
  verdict: string;

  // Model & Probability (at prediction time)
  confidenceScore: number; // strictly > 70.0
  modelProbability: number;
  modelFairOdds: number;

  // Odds & Bookmaker (at prediction time)
  odds: number;
  bookmaker: string; // e.g. "Pinnacle"

  // Bet Parameters
  stakeUnits: number; // Exactly 1.0
  betType: 'VIRTUAL_RESEARCH';

  // Timestamps & Lifecycle
  predictionCreatedAt: string; // ISO 8601 UTC
  predictionLockedAt: string | null; // ISO 8601 UTC (at kickoff)
  kickoffUtc: string; // ISO 8601 UTC

  // System & Model Versioning
  sourceSystem: 'HandicapLab';
  destinationSystem: 'SALMO';
  pipelineVersion: string;
  modelVersion: string;

  // State Tracking
  status: LedgerState;
  settlementStatus: SettlementOutcome | null;
  rejectionReason?: string;

  // Integrity & Hash Verification
  payloadHash: string; // SHA-256
  idempotencyKey: string;

  // League & Match Details for Reporting
  competitionName: string;
  competitionId: number;
  homeTeam: string;
  awayTeam: string;
}

export interface SettlementDetails {
  settlementId: string;
  ledgerId: string;
  signalId: string;
  fixtureId: string;

  // Match Outcome
  homeGoals: number;
  awayGoals: number;
  finalStatus: string; // 'FT', 'AET', 'PEN'

  // Settlement Result
  outcome: SettlementOutcome;
  profitUnits: number; // WIN: odds - 1, LOSS: -1, PUSH: 0, HALF_WIN: (odds - 1)/2, HALF_LOSS: -0.5
  returnUnits: number; // stakeUnits + profitUnits
  closingOdds: number;
  closingProbability: number;
  clv: number;

  // Execution & Provenance
  settledAt: string; // ISO 8601 UTC
  resultProvider: string; // e.g. 'api-football'
  resultReceivedAt: string;
  resultVersion: string;
}

export interface DailyPerformanceSummary {
  date: string; // YYYY-MM-DD UTC
  timezone: 'UTC';
  threshold: number; // 70

  // Funnel counts
  qualified: number;
  recorded: number;
  locked: number;
  settled: number;

  // Outcome counts
  wins: number;
  losses: number;
  pushes: number;
  halfWins: number;
  halfLosses: number;
  voids: number;

  // Financials & Yield (Settled only)
  stakeUnits: number;
  profitUnits: number;
  yieldPct: number; // (profitUnits / stakeUnits) * 100

  // Open Exposure (Unsettled)
  openBets: number;
  openStakeUnits: number;

  // Quality metrics
  averageOdds: number;
  averageConfidence: number;
  strikeRatePct: number; // (wins + 0.5 * halfWins) / settled * 100
}

export interface DimensionPerformance {
  dimensionKey: string;
  label: string;
  settledBets: number;
  wins: number;
  losses: number;
  pushes: number;
  halfWins: number;
  halfLosses: number;
  stakeUnits: number;
  profitUnits: number;
  yieldPct: number;
  avgOdds: number;
  avgConfidence: number;
}

export interface OverallPerformanceReport {
  generatedAtUtc: string;
  canonicalDomain: 'salmo.dev';
  threshold: number; // 70
  totalQualified: number;
  totalSettled: number;
  totalOpenBets: number;
  openStakeUnits: number;
  totalStakedUnits: number;
  totalProfitUnits: number;
  realizedYieldPct: number;

  // Horizonal aggregates
  today: DailyPerformanceSummary;
  yesterday?: DailyPerformanceSummary | null;
  last7Days: DimensionPerformance;
  last30Days: DimensionPerformance;
  allTime: DimensionPerformance;

  // Dimensions
  byMarket: DimensionPerformance[];
  byConfidenceBand: DimensionPerformance[];
  byLeague: DimensionPerformance[];

  // Recent Settled Bets (latest 10)
  recentSettlements: Array<{
    ledgerId: string;
    fixture: string;
    market: string;
    line: number | null;
    selection: string;
    odds: number;
    score: string;
    outcome: SettlementOutcome;
    profitUnits: number;
    settledAt: string;
  }>;
}

export interface LedgerTransitionEvent {
  eventId: string;
  ledgerId: string;
  signalId: string;
  fromState: LedgerState;
  toState: LedgerState;
  reason: string;
  timestampUtc: string;
  actor: 'HIGH_CONFIDENCE_QUALIFIER' | 'KICKOFF_LOCKER' | 'SETTLEMENT_ENGINE' | 'MANUAL_AUDIT';
  payloadHash?: string;
}
