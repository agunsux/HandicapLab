// EPIC 36 — Fair Odds & Market Edge Engine
// Calculates Model Fair Odds (1 / modelProb), vig-removed bookmaker implied probability,
// Probability Edge, Odds Edge, and Expected Value (EV).

import { removeVig } from '../math/metrics';

export type LiveMarketKind = 'moneyline' | 'asian_handicap' | 'over_under';
export type LiveSelection = 'home' | 'draw' | 'away' | 'over' | 'under';

export interface MarketQuoteInput {
  market: LiveMarketKind;
  line: number;
  priceHome: number;
  priceAway: number;
  priceDraw?: number | null;
  bookmaker: string;
}

export interface FairOddsCalculation {
  market: LiveMarketKind;
  selection: LiveSelection;
  line: number;
  modelProb: number;
  marketImpliedProb: number;
  modelFairOdds: number;
  bookmakerOdds: number;
  probEdge: number;
  oddsEdge: number;
  expectedValue: number;
  overround: number;
}

/** Vig-removed implied probability for a quote selection */
export function calculateImpliedProb(quote: MarketQuoteInput, selection: LiveSelection): number {
  if (quote.market === 'moneyline' && quote.priceDraw) {
    const fair = removeVig(quote.priceHome, quote.priceDraw, quote.priceAway);
    if (selection === 'home') return fair.homeProb;
    if (selection === 'draw') return fair.drawProb;
    return fair.awayProb;
  }
  const invHome = 1 / quote.priceHome;
  const invAway = 1 / quote.priceAway;
  const margin = invHome + invAway;
  const isHomeSide = selection === 'home' || selection === 'over';
  return (isHomeSide ? invHome : invAway) / margin;
}

/** Compute market overround (margin) */
export function calculateOverround(quote: MarketQuoteInput): number {
  if (quote.market === 'moneyline' && quote.priceDraw) {
    return 1 / quote.priceHome + 1 / quote.priceDraw + 1 / quote.priceAway - 1;
  }
  return 1 / quote.priceHome + 1 / quote.priceAway - 1;
}

/** Compute Model Fair Odds & EV for a single selection */
export function computeFairOdds(
  quote: MarketQuoteInput,
  selection: LiveSelection,
  modelProb: number
): FairOddsCalculation {
  const bookmakerOdds = selection === 'draw' ? (quote.priceDraw ?? 0) : (selection === 'home' || selection === 'over' ? quote.priceHome : quote.priceAway);
  const marketImpliedProb = calculateImpliedProb(quote, selection);
  const modelFairOdds = modelProb > 0 ? Number((1 / modelProb).toFixed(3)) : 999;
  const probEdge = Number((modelProb - marketImpliedProb).toFixed(4));
  const oddsEdge = Number((bookmakerOdds - modelFairOdds).toFixed(3));
  const expectedValue = Number((modelProb * bookmakerOdds - 1).toFixed(4));
  const overround = Number(calculateOverround(quote).toFixed(4));

  return {
    market: quote.market,
    selection,
    line: quote.line,
    modelProb: Number(modelProb.toFixed(4)),
    marketImpliedProb: Number(marketImpliedProb.toFixed(4)),
    modelFairOdds,
    bookmakerOdds,
    probEdge,
    oddsEdge,
    expectedValue,
    overround,
  };
}
