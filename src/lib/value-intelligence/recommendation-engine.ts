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
  confidence: number;
  idFactory?: () => string;
}

export function classifyRecommendation(input: ClassifyInput): ValueRecommendationRecord {
  const fair = computeFairOdds(input.quote, input.selection, input.modelProb);
  const ev = fair.expectedValue;
  const edge = fair.probEdge;
  const conf = input.confidence;

  let category: ValueCategory;
  let actionable = false;

  if (ev < 0 || edge <= 0) {
    category = 'NO_VALUE';
  } else if (conf < 0.50) {
    category = 'PASS';
  } else if (ev >= 0.05 && edge >= 0.04 && conf >= 0.60) {
    category = 'STRONG_VALUE';
    actionable = true;
  } else if (ev >= 0.02 && edge >= 0.02) {
    category = 'VALUE';
    actionable = true;
  } else {
    category = 'WATCHLIST';
  }

  const confidenceBucket = conf >= 0.70 ? 'HIGH' : conf >= 0.58 ? 'MEDIUM' : 'LOW';
  const clvProjection = Number((ev * 0.65).toFixed(4));

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
    clvProjection,
    category,
    confidence: Number(conf.toFixed(4)),
    confidenceBucket,
    evidence,
    actionable,
  };
}
