// EPIC 56 — Asian Handicap Solo: Core Types & Interfaces
// Location: src/lib/research/ah-solo/ahTypes.ts

export type SettlementOutcome = 'FULL_WIN' | 'HALF_WIN' | 'PUSH' | 'HALF_LOSS' | 'FULL_LOSS' | 'VOID';

export type AhSide = 'home' | 'away';

export type SampleSizeStatus = 'ADEQUATE' | 'LIMITED' | 'INSUFFICIENT';

export type ValueQualificationState =
  | 'NO_EDGE'
  | 'LOW_CONFIDENCE_EDGE'
  | 'POSITIVE_EDGE'
  | 'QUALIFIED_VALUE'
  | 'INSUFFICIENT_DATA'
  | 'NOT_VALIDATED';

export interface CanonicalMatch {
  canonicalId: string;
  leagueId: string;
  cluster: string;
  season: string;
  matchDate: string; // YYYY-MM-DD
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
  result: 'H' | 'D' | 'A';
  resultVerified: boolean;
  totalGoals: number;
  odds?: {
    bookmakerSource?: string;
    ahLine?: number;
    ahHome?: number;
    ahAway?: number;
    h1?: number;
    d1?: number;
    a1?: number;
    ch1?: number;
    cd1?: number;
    ca1?: number;
    ouLine?: number;
    over?: number;
    under?: number;
  };
}

export interface AhMarketOddsRow {
  odds_id: string;
  canonical_id: string;
  league_id: string;
  cluster: string;
  season: string;
  match_date: string;
  market: 'AH' | 'ML' | 'OU';
  observation: 'opening' | 'closing';
  bookmaker_source: string;
  line: number;
  home_odds: number;
  away_odds: number;
}

export interface MergedAhObservation {
  canonicalId: string;
  leagueId: string;
  season: string;
  matchDate: string;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
  line: number; // e.g. -0.75, -0.5, -0.25, 0.0, +0.25, etc.
  side: AhSide;
  takenOdds: number;
  closingOdds?: number;
  bookmaker: string;
  isOpening: boolean;
}

export interface PointInTimeFootballState {
  matchDate: string;
  homeTeam: string;
  awayTeam: string;
  leagueId: string;
  homeAttack: number;
  homeDefense: number;
  awayAttack: number;
  awayDefense: number;
  homeAdvantage: number;
  leagueAvgGoals: number;
  homeRestDays: number;
  awayRestDays: number;
  expectedHomeGoals: number; // lambda_home
  expectedAwayGoals: number; // lambda_away
}

export interface GoalDifferencePmf {
  pmf: Record<number, number>;
  expectedGd: number;
}

export interface AhLineSettlementProbabilities {
  line: number;
  side: AhSide;
  pFullWin: number;
  pHalfWin: number;
  pPush: number;
  pHalfLoss: number;
  pFullLoss: number;
  pCover: number;
  fairOdds: number;
}

export interface AhPredictionOutput {
  fixtureId: string;
  predictionCutoff: string;
  modelVersion: string;
  featureVersion: string;
  line: number;
  side: AhSide;
  settlementProbabilities: AhLineSettlementProbabilities;
  fairPrice: number;
  marketTakenOdds: number;
  marketClosingOdds?: number;
  devigFairProb: number;
  edge: number;
  ev: number;
  clv?: number;
  uncertainty: {
    probCi95: [number, number];
    evCi95: [number, number];
    edgeClassification: 'STRONG_EVIDENCE' | 'POSSIBLE_EDGE' | 'NOISE' | 'INSUFFICIENT_DATA';
  };
  sampleStatus: SampleSizeStatus;
}

export interface WalkForwardFold {
  foldIndex: number;
  trainStart: string;
  trainEnd: string;
  trainSeasons: string[];
  valStart: string;
  valEnd: string;
  valSeason: string;
  trainMatchesCount: number;
  valMatchesCount: number;
  valAhObservationsCount: number;
}

export interface LineEvaluationMetrics {
  line: number;
  sampleSize: number;
  status: SampleSizeStatus;
  brierScore: number;
  logLoss: number;
  ece: number;
  clvMean: number;
  clvCoveragePct: number;
  evMean: number;
  roiRealized: number;
  hitRate: number;
  roiCi95: [number, number];
  positiveFoldsCount: number;
  totalFoldsCount: number;
}

export interface ModelTournamentMetrics {
  modelId: string;
  modelName: string;
  modelVersion: string;
  overallBrier: number;
  overallLogLoss: number;
  overallEce: number;
  overallClv: number;
  overallEv: number;
  overallRoi: number;
  overallHitRate: number;
  roiCi95: [number, number];
  lineMetrics: Record<string, LineEvaluationMetrics>;
  folds: Array<{
    foldIndex: number;
    valSeason: string;
    brier: number;
    logLoss: number;
    ece: number;
    clv: number;
    ev: number;
    roi: number;
  }>;
  persistence: {
    positiveFoldRate: number;
    meanFoldEv: number;
    medianFoldEv: number;
    evStdDev: number;
    bestFoldEv: number;
    worstFoldEv: number;
  };
}
