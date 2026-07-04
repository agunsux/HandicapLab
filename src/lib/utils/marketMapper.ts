import { DbPrediction } from '../data/match';

export interface OddsQuote {
  homeOdds: number;
  awayOdds: number;
  drawOdds?: number;
}

export interface MarketOdds {
  bookmaker: string;
  marketType: 'ML' | 'AH' | 'OU';
  line: number | null;
  opening: OddsQuote | null;
  current: OddsQuote | null;
  closing: OddsQuote | null;
  timestamp: string | null;
  source: string;
}

export interface MatchMarketData {
  matchId: string;
  moneyline: MarketOdds | null;
  asianHandicap: MarketOdds | null;
  overUnder: MarketOdds | null;
}

export function mapMarketOdds(preds: DbPrediction[]): MatchMarketData {
  const result: MatchMarketData = {
    matchId: preds.length > 0 ? preds[0].match_id : '',
    moneyline: null,
    asianHandicap: null,
    overUnder: null
  };

  for (const p of preds) {
    const type = p.market_type as 'ML' | 'AH' | 'OU';
    if (type !== 'ML' && type !== 'AH' && type !== 'OU') continue;

    const timestamp = p.prediction_timestamp || p.generated_at || null;
    let bookmaker = 'Pinnacle';

    // 1. Current Odds from odds_snapshot JSONB
    let current: OddsQuote | null = null;
    let line: number | null = null;

    if (p.odds_snapshot && typeof p.odds_snapshot === 'object') {
      const snap = p.odds_snapshot;
      bookmaker = snap.bookmaker || 'Pinnacle';
      
      // Parse Line (line is present in AH and OU)
      if (typeof snap.line === 'number') {
        line = snap.line;
      }

      // Parse Odds values supporting both camelCase and snake_case
      const hOdds = Number(snap.homeOdds ?? snap.home_odds ?? 0);
      const aOdds = Number(snap.awayOdds ?? snap.away_odds ?? 0);
      const dOdds = Number(snap.drawOdds ?? snap.draw_odds ?? 0);

      if (hOdds > 0 && aOdds > 0) {
        if (type === 'ML') {
          current = {
            homeOdds: hOdds,
            awayOdds: aOdds,
            drawOdds: dOdds > 0 ? dOdds : undefined
          };
        } else {
          current = {
            homeOdds: hOdds,
            awayOdds: aOdds
          };
        }
      }
    }

    // 2. Opening Odds from entry_odds
    // In HandicapLab, entry_odds represents opening odds for the model selection.
    // If opening odds are not present in current, or to represent opening market state,
    // we use a clean fallback. Since predictions are selection-specific, we check if
    // entry_odds is present and map it.
    let opening: OddsQuote | null = null;
    if (typeof p.entry_odds === 'number' && p.entry_odds > 0) {
      if (type === 'ML') {
        opening = {
          homeOdds: p.entry_odds,
          awayOdds: 0,
          drawOdds: 0
        };
      } else {
        opening = {
          homeOdds: p.entry_odds,
          awayOdds: 0
        };
      }
    }

    // 3. Closing Odds from closing_odds JSONB or fallback
    let closing: OddsQuote | null = null;
    if (p.closing_odds && typeof p.closing_odds === 'object') {
      const close = p.closing_odds as any;
      const hClose = Number(close.homeOdds ?? close.home_odds ?? 0);
      const aClose = Number(close.awayOdds ?? close.away_odds ?? 0);
      const dClose = Number(close.drawOdds ?? close.draw_odds ?? 0);

      if (hClose > 0 && aClose > 0) {
        if (type === 'ML') {
          closing = {
            homeOdds: hClose,
            awayOdds: aClose,
            drawOdds: dClose > 0 ? dClose : undefined
          };
        } else {
          closing = {
            homeOdds: hClose,
            awayOdds: aClose
          };
        }
      }
    }

    const marketOdds: MarketOdds = {
      bookmaker,
      marketType: type,
      line,
      opening,
      current,
      closing,
      timestamp,
      source: 'predictions'
    };

    if (type === 'ML') {
      result.moneyline = marketOdds;
    } else if (type === 'AH') {
      result.asianHandicap = marketOdds;
    } else if (type === 'OU') {
      result.overUnder = marketOdds;
    }
  }

  return result;
}
