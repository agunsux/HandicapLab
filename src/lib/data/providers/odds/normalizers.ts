// The Odds API Response Normalizers — Raw API Response → Normalized OddsSnapshot
// Location: src/lib/data/providers/odds/normalizers.ts

import type { OddsSnapshot, MarketType } from '../types';

export interface RawOddsApiOutcome {
  name: string;
  price: number;
  point?: number;
}

export interface RawOddsApiMarket {
  key: string;
  last_update: string;
  outcomes: RawOddsApiOutcome[];
}

export interface RawOddsApiBookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: RawOddsApiMarket[];
}

export interface RawOddsApiMatch {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: RawOddsApiBookmaker[];
}

export interface RawOddsApiOddsResponse {
  timestamp?: string;
  data?: RawOddsApiMatch[];
}

function mapMarketKeyToType(key: string): MarketType {
  switch (key) {
    case 'h2h':
    case 'h2h_lay':
      return 'moneyline';
    case 'spreads':
      return 'asian_handicap';
    case 'totals':
      return 'over_under';
    default:
      return 'moneyline';
  }
}

function extractLine(outcomes: RawOddsApiOutcome[], marketKey: string): number {
  if (marketKey === 'h2h' || marketKey === 'h2h_lay') return 0;
  // For spreads/totals, get the point from first outcome
  const withPoint = outcomes.find(o => o.point !== undefined);
  return withPoint?.point ?? 0;
}

export function normalizeOddsSnapshot(
  rawMatch: RawOddsApiMatch,
  bookmaker: RawOddsApiBookmaker,
  market: RawOddsApiMarket
): OddsSnapshot {
  const marketType = mapMarketKeyToType(market.key);
  const line = extractLine(market.outcomes, market.key);

  let priceHome = 0;
  let priceAway = 0;
  let priceDraw: number | null = null;

  for (const outcome of market.outcomes) {
    if (outcome.name === rawMatch.home_team || outcome.name === 'Home') {
      priceHome = outcome.price;
    } else if (outcome.name === rawMatch.away_team || outcome.name === 'Away') {
      priceAway = outcome.price;
    } else if (outcome.name === 'Draw') {
      priceDraw = outcome.price;
    } else if (outcome.name === 'Over') {
      priceHome = outcome.price;
    } else if (outcome.name === 'Under') {
      priceAway = outcome.price;
    }
  }

  return {
    id: `odds_${rawMatch.id}_${bookmaker.key}_${market.key}_${Date.now()}`,
    fixtureId: `oddsapi_${rawMatch.id}`,
    bookmaker: bookmaker.key,
    marketType,
    line,
    priceHome,
    priceAway,
    priceDraw,
    capturedAt: new Date(),
    providerName: 'the-odds-api',
    rawResponseHash: '',
  };
}

export function normalizeOddsSnapshots(rawResponse: RawOddsApiOddsResponse): OddsSnapshot[] {
  const matches = rawResponse.data ?? (Array.isArray(rawResponse) ? rawResponse : []);
  const snapshots: OddsSnapshot[] = [];

  for (const match of matches) {
    if (!match.bookmakers) continue;
    for (const bookmaker of match.bookmakers) {
      if (!bookmaker.markets) continue;
      for (const market of bookmaker.markets) {
        snapshots.push(normalizeOddsSnapshot(match, bookmaker, market));
      }
    }
  }

  return snapshots;
}

export function extractSportKey(rawMatch: RawOddsApiMatch): string {
  return rawMatch.sport_key ?? 'unknown';
}
