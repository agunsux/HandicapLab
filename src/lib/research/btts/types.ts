// ============================================================================
// BTTS VALUE ENGINE v1 — TYPE DEFINITIONS & SCHEMAS
// ============================================================================
// Location: src/lib/research/btts/types.ts
//
// Invariants:
//   - Strict BTTS Market Scope (YES / NO only).
//   - Zero Lookahead: all timestamps must satisfy ts < kickoff.
//   - Explicit Statuses: INSUFFICIENT_DATA | RESEARCH_ONLY | NO_VALUE | VALUE | INVALID.
//   - No Kelly, no bet execution, no bankroll management.
// ============================================================================

export type BttsSelection = 'YES' | 'NO';
export type BttsOutcome = 'WIN' | 'LOSS';

export type BttsValueStatus =
  | 'INSUFFICIENT_DATA' // Not enough sample size to establish statistical edge
  | 'RESEARCH_ONLY'     // Probability calculated but model unvalidated or sample size low
  | 'NO_VALUE'          // Defensible model exists, but EV < threshold or Edge < threshold
  | 'VALUE'             // All statistical gates passed (strictly requires sample >= min_sample)
  | 'INVALID';          // Lookahead violation, missing data, or corrupted timestamps

export interface RollingTeamStats {
  matchesCount: number;
  goalsScored: number;
  goalsConceded: number;
  scoringRate: number;      // goalsScored / matchesCount
  concedingRate: number;    // goalsConceded / matchesCount
  cleanSheetCount: number;
  cleanSheetRate: number;
  failedToScoreCount: number;
  failedToScoreRate: number;
  bttsYesCount: number;
  bttsRate: number;         // bttsYesCount / matchesCount
  asOfTimestamp: string;
}

export interface BttsPreMatchFeatures {
  canonicalMatchId: string;
  kickoffTimestamp: string;
  homeTeam: string;
  awayTeam: string;
  leagueId: string;
  season: string;

  // Rolling windows for home team (overall & home-only)
  homeOverall: RollingTeamStats;
  homeVenue: RollingTeamStats;

  // Rolling windows for away team (overall & away-only)
  awayOverall: RollingTeamStats;
  awayVenue: RollingTeamStats;

  // League baseline prior to kickoff
  leagueBaseline: {
    seasonMatchesCount: number;
    leagueBttsRate: number;
    avgHomeGoals: number;
    avgAwayGoals: number;
    avgTotalGoals: number;
    asOfTimestamp: string;
  };

  // Provenance & Lookahead Verification
  featureCutoffTimestamp: string;
  isLookaheadFree: boolean;
}

export interface BttsProbabilities {
  pYes: number; // 0 <= pYes <= 1
  pNo: number;  // pNo = 1 - pYes
}

export interface BttsMarketOdds {
  bookmaker: string;
  openingYesOdds: number | null;
  openingNoOdds: number | null;
  openingTimestamp: string | null;

  closingYesOdds: number;
  closingNoOdds: number;
  closingTimestamp: string;

  // Implied probabilities (raw)
  rawImpliedYes: number;
  rawImpliedNo: number;
  overround: number;

  // No-vig fair market probabilities
  noVigProbYes: number;
  noVigProbNo: number;

  // Odds timing verification
  isPreMatch: boolean;
}

export interface BttsGateResult {
  gateName: string;
  passed: boolean;
  actualValue: number | string | boolean;
  requiredThreshold: number | string | boolean;
  detail: string;
}

export interface BttsValueEvaluation {
  canonicalMatchId: string;
  kickoffTimestamp: string;
  homeTeam: string;
  awayTeam: string;

  modelVersion: string;
  predictionTimestamp: string;
  featureCutoffTimestamp: string;
  trainingSampleSize: number;

  // Probabilities
  modelProbYes: number;
  modelProbNo: number;
  fairOddsYes: number; // 1 / modelProbYes
  fairOddsNo: number;  // 1 / modelProbNo

  // Market comparison (Pinnacle closing pre-match)
  marketOddsYes: number;
  marketOddsNo: number;
  noVigMarketProbYes: number;
  noVigMarketProbNo: number;

  // Edge & EV
  edgeYes: number; // modelProbYes - noVigMarketProbYes
  edgeNo: number;  // modelProbNo - noVigMarketProbNo
  evYes: number;   // (modelProbYes * marketOddsYes) - 1
  evNo: number;    // (modelProbNo * marketOddsNo) - 1

  // Recommended side if any
  recommendedSide: BttsSelection | null;

  // Gates & Status
  status: BttsValueStatus;
  gates: BttsGateResult[];
  reason: string;

  // Baselines comparison
  baselineLeagueProbYes: number;
  baselineTeamFormProbYes: number;

  // Actual match outcome (if settled)
  actualHomeGoals?: number;
  actualAwayGoals?: number;
  actualBttsOutcome?: boolean; // true = YES, false = NO
  settlementResult?: 'WIN' | 'LOSS' | 'VOID' | 'UNSETTLED';
  settlementReturn?: number; // (odds - 1) on win, -1 on loss, 0 on unsettled/no-bet
}

export interface BttsBacktestSummary {
  datasetName: string;
  totalMatches: number;
  evaluatedMatches: number;
  lookaheadViolations: number;

  // Status breakdown
  statusCounts: Record<BttsValueStatus, number>;

  // Sample size verification
  sampleSize: number;
  minSampleSizeRequired: number;
  isSampleSufficient: boolean;

  // Baselines vs Model Metrics
  metrics: {
    model: {
      brierScore: number;
      logLoss: number;
      meanPredictedProb: number;
    };
    market: {
      brierScore: number;
      logLoss: number;
      meanMarketProb: number;
    };
    leagueBaseline: {
      brierScore: number;
      logLoss: number;
      baselineProb: number;
    };
  };

  // Calibration Buckets (0.50-0.55, 0.55-0.60, 0.60-0.65, etc.)
  calibrationBuckets: Array<{
    bucketRange: string;
    predictedMean: number;
    observedRate: number;
    count: number;
  }>;

  // Edge & EV realization
  signalsCount: number;
  winsCount: number;
  lossesCount: number;
  hitRate: number;
  avgOdds: number;
  avgEdge: number;
  avgEV: number;
  totalStaked: number; // For flat 1-unit hypothetical tracking (NO STAKING RECOMMENDATION)
  totalReturn: number;
  roi: number;
  yieldPct: number;

  // Audit certification
  dataSufficiencyVerdict: 'INSUFFICIENT_DATA' | 'SUFFICIENT_FOR_RESEARCH';
  researchConclusion: string;
}
