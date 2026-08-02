// EPIC 36 — Value Recommendation Classifier
// Classifies betting market opportunities into 5 categories based on Expected Value (EV),
// Probability Edge, Confidence, and Historical Evidence. Strictly blocks negative EV bets.

import { computeFairOdds, type MarketQuoteInput, type LiveSelection, type FairOddsCalculation } from './fair-odds-engine';
import { HistoricalSimilarityEngine, type HistoricalCohortEvidence } from './similarity-engine';

export type ValueCategory = 'STRONG_VALUE' | 'VALUE' | 'WATCHLIST' | 'NO_VALUE' | 'PASS';

export interface ValueRecommendationRecord {
  id: string;
  fixtureId: string;
  league: string;
  season: string;
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  market: 'moneyline' | 'asian_handicap' | 'over_under';
  selection: LiveSelection;
  line: number;
  modelProb: number;
  marketProb: number;
  probEdge: number;
  modelFairOdds: number;
  bookmakerOdds: number;
  expectedValue: number;
  clvProjection: number;
  category: ValueCategory;
  confidence: number;
  confidenceBucket: 'HIGH' | 'MEDIUM' | 'LOW';
  evidence: HistoricalCohortEvidence;
  actionable: boolean;
  reason: string;
  thresholdVersion?: string;
  dataAgeMs?: number;
}

export interface ClassifyInput {
  fixtureId: string;
  league: string;
  season: string;
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  quote: MarketQuoteInput;
  selection: LiveSelection;
  modelProb: number;
  modelPushProb?: number;
  confidence: number;
  dataAgeMs?: number;
  dataTimestamp?: string;
  maxDataAgeMs?: number;
  idFactory?: () => string;
}

export function classifyRecommendation(input: ClassifyInput): ValueRecommendationRecord {
  const probInput = input.modelPushProb !== undefined
    ? { win: input.modelProb, push: input.modelPushProb }
    : input.modelProb;

  const fair = computeFairOdds(input.quote, input.selection, probInput);
  const ev = fair.expectedValue;
  const edge = fair.probEdge;
  const conf = input.confidence;
  const thresholdVersion = 'v1.0';
  const ageMs = input.dataAgeMs || 0;

  let category: ValueCategory;
  let actionable = false;
  let reason = '';

  const isStale = (input.dataTimestamp && input.maxDataAgeMs
    ? (Date.now() - new Date(input.dataTimestamp).getTime()) > input.maxDataAgeMs
    : false) || (input.dataAgeMs && input.maxDataAgeMs ? input.dataAgeMs > input.maxDataAgeMs : false);

  if (fair.bookmakerOdds <= 1.0 || fair.marketImpliedProb >= 1.0 || fair.marketImpliedProb <= 0) {
    category = 'PASS';
    reason = 'ODDS_INVALID: Bookmaker odds are structurally invalid (<= 1.0) or implied probability is out of bounds.';
  } else if (isStale) {
    category = 'PASS';
    reason = 'STALE_DATA: Odds or features are too old to reliably calculate value.';
  } else if (ev < 0 || edge <= 0) {
    category = 'NO_VALUE';
    reason = ev < 0 ? 'Negative Expected Value (EV).' : 'No probability edge over the market.';
  } else if (conf < 0.50) {
    category = 'PASS';
    reason = 'Insufficient confidence (< 50%). Prediction is too uncertain to act upon.';
  } else if (ev >= 0.05 && edge >= 0.04 && conf >= 0.60) {
    category = 'STRONG_VALUE';
    actionable = true;
    reason = 'Strong Value Detected: EV and Edge safely exceed premium thresholds with high confidence.';
  } else if (ev >= 0.02 && edge >= 0.02) {
    category = 'VALUE';
    actionable = true;
    reason = 'Value Detected: Positive EV and Edge meet baseline thresholds for action.';
  } else if (ev > 0 && edge > 0) {
    category = 'WATCHLIST';
    reason = 'MARGINAL_EDGE';
  } else {
    category = 'NO_VALUE';
    reason = 'NO_VALUE_DETECTED';
  }

  const confidenceBucket = conf >= 0.70 ? 'HIGH' : conf >= 0.58 ? 'MEDIUM' : 'LOW';

  const evidence = HistoricalSimilarityEngine.queryHistoricalEvidence({
    league: input.league,
    market: input.quote.market,
    minOdds: fair.bookmakerOdds,
    maxOdds: fair.bookmakerOdds,
    minEv: fair.expectedValue,
  });

  const idFactory = input.idFactory ?? (() => `val-${input.fixtureId}-${input.quote.market}-${input.selection}`);

  return {
    id: idFactory(),
    fixtureId: input.fixtureId,
    league: input.league,
    season: input.season,
    homeTeam: input.homeTeam,
    awayTeam: input.awayTeam,
    kickoff: input.kickoff,
    market: input.quote.market,
    selection: input.selection,
    line: input.quote.line,
    modelProb: fair.modelProb,
    marketProb: fair.marketImpliedProb,
    probEdge: fair.probEdge,
    modelFairOdds: fair.modelFairOdds,
    bookmakerOdds: fair.bookmakerOdds,
    expectedValue: fair.expectedValue,
    clvProjection: Number((ev * 0.65).toFixed(4)),
    category,
    confidence: Number(conf.toFixed(4)),
    confidenceBucket,
    evidence,
    actionable,
    reason,
    thresholdVersion,
    dataAgeMs: ageMs
  };
}
