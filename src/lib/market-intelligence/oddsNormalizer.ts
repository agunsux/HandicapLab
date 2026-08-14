/**
 * HANDICAP_LAB — Odds Normalization Engine (Phase 8)
 * ===================================================
 * Normalizes market odds across Pinnacle, Circa, and SBO:
 * - Moneyline: HOME, DRAW, AWAY
 * - Asian Handicap: Exact lines (-0.25, -0.5, +0.25, +0.5, -0.75, +0.75, etc.)
 * - Over/Under: Exact lines (2.0, 2.25, 2.5, 2.75, 3.0, etc.)
 * - BTTS: YES, NO
 *
 * Invariant: Never compare different lines.
 */

export type BookmakerKey = 'pinnacle' | 'circa' | 'sbo';

export type MarketKey = 'moneyline' | 'asian_handicap' | 'over_under' | 'btts';

export interface NormalizedOddsQuote {
  provider_id: string;
  fixture_id: string;
  bookmaker: BookmakerKey;
  market: MarketKey;
  selection: string;
  line: number | null;
  odds: number;
  timestamp: string;
  source_type: 'REAL_PROVIDER' | 'HISTORICAL';
}

export class OddsNormalizer {
  private static AUTHORIZED_BOOKS: BookmakerKey[] = ['pinnacle', 'circa', 'sbo'];

  public static normalizeBookmaker(rawName: string): BookmakerKey | null {
    const s = rawName.toLowerCase();
    if (s.includes('pinnacle')) return 'pinnacle';
    if (s.includes('circa')) return 'circa';
    if (s.includes('sbo')) return 'sbo';
    return null;
  }

  public static normalizeMoneyline(
    selection: string,
    odds: number,
    bookmaker: string,
    fixtureId: string,
    timestamp: string,
    providerId: string = 'oddspapi'
  ): NormalizedOddsQuote | null {
    const book = this.normalizeBookmaker(bookmaker);
    if (!book) return null;

    const sel = selection.toLowerCase();
    let normSel = 'DRAW';
    if (sel.includes('home') || sel === '1') normSel = 'HOME';
    else if (sel.includes('away') || sel === '2') normSel = 'AWAY';
    else if (sel.includes('draw') || sel === 'x') normSel = 'DRAW';

    return {
      provider_id: providerId,
      fixture_id: fixtureId,
      bookmaker: book,
      market: 'moneyline',
      selection: normSel,
      line: null,
      odds: Number(odds.toFixed(3)),
      timestamp,
      source_type: 'REAL_PROVIDER',
    };
  }

  public static normalizeAsianHandicap(
    selection: 'home' | 'away',
    line: number,
    odds: number,
    bookmaker: string,
    fixtureId: string,
    timestamp: string,
    providerId: string = 'oddspapi'
  ): NormalizedOddsQuote | null {
    const book = this.normalizeBookmaker(bookmaker);
    if (!book) return null;

    return {
      provider_id: providerId,
      fixture_id: fixtureId,
      bookmaker: book,
      market: 'asian_handicap',
      selection: selection.toUpperCase(),
      line: Number(line.toFixed(2)),
      odds: Number(odds.toFixed(3)),
      timestamp,
      source_type: 'REAL_PROVIDER',
    };
  }

  public static normalizeOverUnder(
    selection: 'over' | 'under',
    line: number,
    odds: number,
    bookmaker: string,
    fixtureId: string,
    timestamp: string,
    providerId: string = 'oddspapi'
  ): NormalizedOddsQuote | null {
    const book = this.normalizeBookmaker(bookmaker);
    if (!book) return null;

    return {
      provider_id: providerId,
      fixture_id: fixtureId,
      bookmaker: book,
      market: 'over_under',
      selection: selection.toUpperCase(),
      line: Number(line.toFixed(2)),
      odds: Number(odds.toFixed(3)),
      timestamp,
      source_type: 'REAL_PROVIDER',
    };
  }

  public static normalizeBtts(
    selection: 'yes' | 'no',
    odds: number,
    bookmaker: string,
    fixtureId: string,
    timestamp: string,
    providerId: string = 'oddspapi'
  ): NormalizedOddsQuote | null {
    const book = this.normalizeBookmaker(bookmaker);
    if (!book) return null;

    return {
      provider_id: providerId,
      fixture_id: fixtureId,
      bookmaker: book,
      market: 'btts',
      selection: selection.toUpperCase(),
      line: null,
      odds: Number(odds.toFixed(3)),
      timestamp,
      source_type: 'REAL_PROVIDER',
    };
  }
}
