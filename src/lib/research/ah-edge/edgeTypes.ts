// AH EDGE ENGINE — Types.

import type { AhCategoryProbabilities } from './edgeProbability';
import type { AhFavoriteStatus, AhProvenance, AhSide } from '../ah-yield/ahTypes';

export interface EdgeMarketQuote {
  line: number;
  homeOdds: number;
  awayOdds: number;
}

export interface PointInTimeFeatures {
  eloHome: number;
  eloAway: number;
  eloDiff: number;
  homePpg5: number;
  awayPpg5: number;
  homeGf5: number;
  homeGa5: number;
  awayGf5: number;
  awayGa5: number;
  homeRestDays: number;
  awayRestDays: number;
  homeSeasonMatches: number;
  awaySeasonMatches: number;
  homeSeasonPpg: number;
  awaySeasonPpg: number;
  homeSeasonGfPerMatch: number;
  homeSeasonGaPerMatch: number;
  awaySeasonGfPerMatch: number;
  awaySeasonGaPerMatch: number;
  leagueHomeGoalsPerMatch: number;
  leagueAwayGoalsPerMatch: number;
  homeAdvantageGoals: number;
}

export interface EdgeMatch {
  canonicalId: string;
  leagueId: string;
  season: string;
  matchDate: string;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
  ah: EdgeMarketQuote;
  /** Earlier-snapshot AH quote for line movement; null when evaluating at opening. */
  ahOpening: EdgeMarketQuote | null;
  /** ML devig probabilities at the EVALUATION snapshot (opening or closing per cohort). */
  mlClosing: { pHome: number; pDraw: number; pAway: number } | null;
  mlOpening: { pHome: number; pDraw: number; pAway: number } | null;
  /** Over 2.5 devig probability at the EVALUATION snapshot. */
  ouClosingOver25: number | null;
  features: PointInTimeFeatures;
}

export interface EdgeCohortConfig {
  id: string;
  description: string;
  ahBookmakerLabel: string;
  ahObservation: 'opening' | 'closing';
  /**
   * Provenance required for the AH quote, resolved from the real source CSV
   * headers (never from the legacy bookmaker_source label). Excludes the
   * pre-2019 BetBrain rows that market_odds.jsonl mislabels as `pinnacle`.
   */
  ahRequiredProvenance: AhProvenance;
  mlBookmakerLabel: string;
  mlObservation: 'opening' | 'closing';
  ouBookmakerLabel: string;
  ouObservation: 'opening' | 'closing';
}

export type FeatureGroup = 'market' | 'form' | 'rest' | 'elo' | 'league';

export const ALL_FEATURE_GROUPS: FeatureGroup[] = ['market', 'form', 'rest', 'elo', 'league'];

export type EdgeModelId =
  | 'market_poisson'
  | 'league_line_prior'
  | 'form_poisson'
  | 'elo_poisson'
  | 'poisson_glm'
  | 'softmax_glm';

export interface EdgeModelConfig {
  groups: FeatureGroup[];
  /** Optional training overrides (used by tests to keep suites fast). */
  training?: {
    poissonEpochs?: number;
    softmaxEpochs?: number;
  };
}

export interface EdgeBetPrediction {
  canonicalId: string;
  matchDate: string;
  season: string;
  leagueId: string;
  side: AhSide;
  line: number;
  odds: number;
  oppositeOdds: number | null;
  favoriteStatus: AhFavoriteStatus;
  actualOutcome: string;
  actualCategoryIndex: number;
  /** Binary profit event (FULL_WIN/HALF_WIN = 1, HALF_LOSS/FULL_LOSS = 0, PUSH = null). */
  y: 0 | 1 | null;
  modelId: EdgeModelId | string;
  probabilities: AhCategoryProbabilities;
  fairOdds: number | null;
  modelEv: number;
  modelBinaryProbability: number;
  marketBinaryProbability: number | null;
  marketEv: number | null;
}
