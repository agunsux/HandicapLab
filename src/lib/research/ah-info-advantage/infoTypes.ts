// AH INFORMATION ADVANTAGE RESEARCH — Type Definitions.
// Strict Snapshot Semantics: EARLY/OPENING SNAPSHOT vs CLOSING SNAPSHOT.
// Zero closing leakage into early prediction vectors.

import type { AhCategoryProbabilities } from '../ah-edge/edgeProbability';
import type { AhFavoriteStatus, AhSide } from '../ah-yield/ahTypes';

export type FeatureGroup = 'market' | 'movement' | 'form' | 'strength' | 'context' | 'goal_env';

export interface InfoMarketQuote {
  line: number;
  homeOdds: number;
  awayOdds: number;
}

export interface Devigged1X2 {
  pHome: number;
  pDraw: number;
  pAway: number;
}

export type MovementPattern =
  | 'LINE_MOVES_TOWARD_FAVORITE'
  | 'LINE_MOVES_TOWARD_UNDERDOG'
  | 'PRICE_COMPRESSION'
  | 'PRICE_EXPANSION'
  | 'LINE_UNCHANGED_PRICE_CHANGES'
  | 'PRICE_UNCHANGED_LINE_CHANGES'
  | 'NO_MOVEMENT';

export interface InfoPointInTimeFeatures {
  // GROUP C — TEAM FORM
  formPpg3Home: number;
  formPpg3Away: number;
  formGf3Home: number;
  formGf3Away: number;
  formGa3Home: number;
  formGa3Away: number;
  formGd3Home: number;
  formGd3Away: number;

  formPpg5Home: number;
  formPpg5Away: number;
  formGf5Home: number;
  formGf5Away: number;
  formGa5Home: number;
  formGa5Away: number;
  formGd5Home: number;
  formGd5Away: number;

  formPpg10Home: number;
  formPpg10Away: number;
  formGf10Home: number;
  formGf10Away: number;
  formGa10Home: number;
  formGa10Away: number;
  formGd10Home: number;
  formGd10Away: number;

  homeFormPpg: number; // venue specific
  homeFormGf: number;
  homeFormGa: number;
  awayFormPpg: number;
  awayFormGf: number;
  awayFormGa: number;

  ppmHome: number;
  ppmAway: number;

  // GROUP D — TEAM STRENGTH
  eloHome: number;
  eloAway: number;
  eloDiff: number; // eloHome + HA - eloAway
  rollingStrengthHome: number; // goal superiority
  rollingStrengthAway: number;
  oppAdjustedStrengthHome: number;
  oppAdjustedStrengthAway: number;

  // GROUP E — MATCH CONTEXT
  restDaysHome: number;
  restDaysAway: number;
  restDiff: number; // home - away
  homeAdvantageGoals: number;
  seasonProgressionHome: number; // matches played in season
  seasonProgressionAway: number;
  scheduleDensity14dHome: number; // matches in last 14 days
  scheduleDensity14dAway: number;

  // GROUP F — GOAL ENVIRONMENT
  leagueGoalsPerMatch: number;
  teamSeasonGfHome: number;
  teamSeasonGaHome: number;
  teamSeasonGfAway: number;
  teamSeasonGaAway: number;
}

export interface InfoMatch {
  canonicalId: string;
  leagueId: string;
  season: string;
  matchDate: string;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;

  // EARLY / OPENING SNAPSHOT
  earlyAh: InfoMarketQuote | null;
  earlyMl: Devigged1X2 | null;
  earlyOuOver25: number | null;

  // CLOSING SNAPSHOT
  closingAh: InfoMarketQuote | null;
  closingMl: Devigged1X2 | null;
  closingOuOver25: number | null;

  // Structural movement (Opening -> Closing)
  movementPattern: MovementPattern;
  lineMovementHome: number; // closingLine - earlyLine
  priceMovementHome: number; // closingPrice - earlyPrice
  probMovementHome: number; // closingProb - earlyProb

  features: InfoPointInTimeFeatures;
}

export type AblationModelId =
  | 'M0' // Market only
  | 'M1' // Market + Form
  | 'M2' // Market + Strength
  | 'M3' // Market + Context
  | 'M4' // Market + Goal Environment
  | 'M5' // Market + Form + Strength
  | 'M6' // Market + Form + Strength + Context
  | 'M7' // Market + all valid information
  | 'F0'; // Football only

export type EarlyVsClosingModelId =
  | 'A_early_market'
  | 'B_closing_market'
  | 'C_early_plus_football'
  | 'D_early_plus_football_plus_movement'
  | 'E_football_only';

export interface InfoBetPrediction {
  canonicalId: string;
  matchDate: string;
  season: string;
  leagueId: string;
  side: AhSide;
  line: number;
  odds: number; // odds at which bet was placed
  oppositeOdds: number | null;
  closingOdds: number | null; // closing price for CLV calculation only
  closingLine: number | null;
  favoriteStatus: AhFavoriteStatus;
  actualOutcome: string;
  actualCategoryIndex: number;
  y: 0 | 1 | null; // profit event (win/half-win = 1, loss/half-loss = 0, push = null)
  pnl: number; // realized P&L per unit stake
  modelId: string;
  probabilities: AhCategoryProbabilities;
  modelBinaryProbability: number;
  marketBinaryProbability: number | null;
  modelEv: number;
  clv: number | null; // (odds / closingOdds) - 1 if same line
  movementPattern: MovementPattern;
}

export interface MetricSummaryStats {
  bets: number;
  pushes: number;
  brier: number;
  logLoss: number;
  ece: number;
  hitRate: number;
  allBetsRoi: number;
  evPositiveBets: number;
  evPositiveRoi: number;
  evPositiveCi95: [number, number];
  evPositiveClv: number | null;
  positiveFolds: number;
  medianFoldRoi: number;
  deltaBrierVsBaseline: number;
  deltaBrierCi95: [number, number];
  deltaBrierPValue: number;
  deltaBrierZ: number;
}
