/**
 * Model A: Hierarchical Dixon-Coles Asian Handicap Baseline — Type Definitions
 * Location: src/lib/research/model-a/types.ts
 */

export interface CanonicalMatch {
  canonicalId: string;
  leagueId: string;
  season: string;
  matchDate: string;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
}

export interface MarketOddsRecord {
  odds_id: string;
  canonical_id: string;
  league_id: string;
  season: string;
  match_date: string;
  market: string;
  observation: string;
  bookmaker_source: string;
  line: number;
  home_odds: number;
  away_odds: number;
}

export interface FittedLeagueModel {
  leagueId: string;
  referenceDate: string;
  mu: number; // League intercept (log scale)
  gamma: number; // Home advantage (log scale)
  alpha: Record<string, number>; // Team attack strength (log scale)
  beta: Record<string, number>; // Team defense weakness (log scale)
  rho: number; // Dixon-Coles low-score dependence parameter
  nMatches: number;
  nTeams: number;
}

export interface BivariateScoreDistribution {
  matrix: number[][]; // (maxGoals + 1) x (maxGoals + 1)
  maxGoals: number;
  homeLambda: number;
  awayLambda: number;
  rho: number;
}

export interface GoalDifferenceDistribution {
  pmf: Record<number, number>; // goal difference d -> P(GD = d)
  expectedGd: number;
}

export type AhSide = 'HOME' | 'AWAY';

export interface AhLineProbability {
  line: number;
  side: AhSide;
  pWin: number;
  pHalfWin: number;
  pPush: number;
  pHalfLoss: number;
  pLoss: number;
  pCover: number; // pWin + 0.5 * pHalfWin
  fairOdds: number | null;
  ev: number; // calculated relative to 1 unit stake
}

export interface MatchPrediction {
  canonicalId: string;
  matchDate: string;
  leagueId: string;
  homeTeam: string;
  awayTeam: string;
  actualHomeGoals: number;
  actualAwayGoals: number;
  homeLambda: number;
  awayLambda: number;
  pHomeWin: number;
  pDraw: number;
  pAwayWin: number;
  scoreDistribution: BivariateScoreDistribution;
  ahProbabilities: Record<string, { HOME: AhLineProbability; AWAY: AhLineProbability }>;
}

export interface MatchOutcomeMetrics {
  logLoss: number;
  brierScore: number;
  maeHomeGoals: number;
  maeAwayGoals: number;
  totalMatches: number;
}

export interface AhEvaluationMetrics {
  ahBrierScore: number;
  ahLogLoss: number;
  ece: number; // Expected Calibration Error
  numEvaluatedOdds: number;
}

export interface BettingDiagnostic {
  selectionRule: string; // e.g. "Fixed 1-unit stake where EV > 0"
  totalBets: number;
  turnover: number;
  totalProfit: number;
  roi: number; // profit / turnover
  maxDrawdown: number;
  winCount: number;
  halfWinCount: number;
  pushCount: number;
  halfLossCount: number;
  lossCount: number;
}

export interface WalkForwardFold {
  foldIndex: number;
  trainSeasons: string[];
  trainStart: string;
  trainEnd: string;
  trainMatchesCount: number;
  testSeason: string;
  testStart: string;
  testEnd: string;
  testMatchesCount: number;
  testOddsCount: number;
  metrics: {
    matchOutcome: MatchOutcomeMetrics;
    ahOutcome: AhEvaluationMetrics;
    bettingDiagnostic: BettingDiagnostic;
  };
}

export interface ModelAExecutionResults {
  modelVersion: string;
  datasetHash: string;
  executedAt: string;
  totalMatches: number;
  totalAhOdds: number;
  leagues: string[];
  splits: {
    trainSeasons: string[];
    validationSeason: string;
    oosTestSeasons: string[];
  };
  validationMetrics: {
    matchOutcome: MatchOutcomeMetrics;
    ahOutcome: AhEvaluationMetrics;
    bettingDiagnostic: BettingDiagnostic;
  };
  oosTestMetrics: {
    matchOutcome: MatchOutcomeMetrics;
    ahOutcome: AhEvaluationMetrics;
    bettingDiagnostic: BettingDiagnostic;
  };
  walkForwardFolds: WalkForwardFold[];
  baselineComparison: {
    modelA_DixonColes: {
      logLoss: number;
      brierScore: number;
      ahBrierScore: number;
      roi: number;
    };
    baseline_IndependentPoisson: {
      logLoss: number;
      brierScore: number;
      ahBrierScore: number;
      roi: number;
    };
    diff: {
      logLossDelta: number;
      brierScoreDelta: number;
      ahBrierDelta: number;
    };
  };
  invariantsAudit: {
    scoreMatrixSumOne: boolean;
    nonNegativeProbabilities: boolean;
    settlementPayoutSymmetry: boolean;
    zeroFutureLeakage: boolean;
    reproducible: boolean;
  };
}

