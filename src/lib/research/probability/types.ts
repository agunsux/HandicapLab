// ============================================================================
// PROBABILITY ENGINE CONTRACTS & TYPES
// ============================================================================
// Location: src/lib/research/probability/types.ts
//
// Governs goal distribution models (Poisson, Dixon-Coles) and market derivations
// across Asian Handicap, Over/Under, BTTS, and Moneyline.
// ============================================================================

export interface GoalModelMatch {
  matchId: string;
  leagueId: string;
  matchDate: string; // YYYY-MM-DD
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
}

export interface BivariateScoreDistribution {
  matrix: number[][]; // matrix[h][a] = P(Home = h, Away = a)
  maxGoals: number;
  homeLambda: number;
  awayLambda: number;
  rho: number;
  sum: number;
}

export interface FittedModelParameters {
  modelType: 'POISSON' | 'DIXON_COLES_FLAT' | 'DIXON_COLES_HIERARCHICAL';
  leagueId: string;
  referenceDate: string;
  mu: number;
  gamma: number; // home advantage
  alpha: Record<string, number>; // attack
  beta: Record<string, number>;  // defense
  rho: number; // low-score correlation (0.0 for Poisson)
  nMatches: number;
  nTeams: number;
}

export interface MoneylineProbabilities {
  pHome: number;
  pDraw: number;
  pAway: number;
  fairOddsHome: number;
  fairOddsDraw: number;
  fairOddsAway: number;
}

export interface AsianHandicapProbabilities {
  line: number; // from home perspective (e.g. -0.25, 0.0, +0.5)
  pWin: number;
  pHalfWin: number;
  pPush: number;
  pHalfLoss: number;
  pLoss: number;
  pCover: number; // pWin + 0.5 * pHalfWin
  fairOdds: number;
}

export interface OverUnderProbabilities {
  line: number; // goal total (e.g. 2.25, 2.5, 2.75)
  over: {
    pWin: number;
    pHalfWin: number;
    pPush: number;
    pHalfLoss: number;
    pLoss: number;
    pCover: number;
    fairOdds: number;
  };
  under: {
    pWin: number;
    pHalfWin: number;
    pPush: number;
    pHalfLoss: number;
    pLoss: number;
    pCover: number;
    fairOdds: number;
  };
}

export interface BttsProbabilities {
  pYes: number;
  pNo: number;
  fairOddsYes: number;
  fairOddsNo: number;
}

export interface DerivedMarketsResult {
  scoreDistribution: BivariateScoreDistribution;
  moneyline: MoneylineProbabilities;
  asianHandicap: Record<number, AsianHandicapProbabilities>; // line -> probs
  overUnder: Record<number, OverUnderProbabilities>;         // line -> probs
  btts: BttsProbabilities;
}

