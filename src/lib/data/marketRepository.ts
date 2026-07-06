// Market Repository
// Location: src/lib/data/marketRepository.ts

import { supabase } from '../supabase.server';

export interface MarketBookDb {
  id?: string;
  match_id: string;
  bookmaker: string;
  market_type: string;
  line?: number | null;
  source: string;
  timestamp: string;
}

export interface MarketOddDb {
  id?: string;
  book_id: string;
  selection: string;
  decimal_odds: number;
  implied_probability: number;
  fair_probability?: number | null;
}

export interface MarketEdgeDb {
  id?: string;
  match_id: string;
  market: string;
  selection: string;
  bookmaker: string;
  line?: number | null;
  model_probability: number;
  market_probability: number;
  edge_raw: number;
  edge_adjusted: number;
  expected_value: number;
  kelly_fraction: number;
  confidence_score: number;
  market_efficiency: number;
  volatility_score: number;
  recommended_stake: number;
  signal_rank: number;
  explanation_json: any;
}

export class MarketRepository {
  /**
   * Saves a full market book with its selections to the database.
   */
  public static async saveMarketBook(
    book: MarketBookDb,
    odds: Omit<MarketOddDb, 'book_id'>[]
  ): Promise<string | null> {
    const { data: bookData, error: bookErr } = await supabase
      .from('market_books')
      .insert({
        match_id: book.match_id,
        bookmaker: book.bookmaker,
        market_type: book.market_type,
        line: book.line || null,
        source: book.source,
        timestamp: book.timestamp
      })
      .select('id')
      .single();

    if (bookErr || !bookData) {
      console.error('[MarketRepository] saveMarketBook error:', bookErr?.message);
      return null;
    }

    const bookId = bookData.id;

    const oddsPayload = odds.map(o => ({
      book_id: bookId,
      selection: o.selection,
      decimal_odds: o.decimal_odds,
      implied_probability: o.implied_probability,
      fair_probability: o.fair_probability || null
    }));

    const { error: oddsErr } = await supabase.from('market_odds').insert(oddsPayload);
    if (oddsErr) {
      console.error('[MarketRepository] saveMarketOdds error:', oddsErr.message);
      return null;
    }

    return bookId;
  }

  /**
   * Retrieves the latest market books for a match.
   */
  public static async getLatestMarketBooks(matchId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('market_books')
      .select(`
        id,
        bookmaker,
        market_type,
        line,
        timestamp,
        market_odds (
          selection,
          decimal_odds,
          implied_probability,
          fair_probability
        )
      `)
      .eq('match_id', matchId)
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('[MarketRepository] getLatestMarketBooks error:', error.message);
      return [];
    }
    return data || [];
  }

  /**
   * Saves a closing line record.
   */
  public static async saveClosingLine(record: {
    match_id: string;
    bookmaker: string;
    market_type: string;
    selection: string;
    line?: number | null;
    closing_odds: number;
    closing_timestamp: string;
  }): Promise<boolean> {
    const { error } = await supabase.from('market_closing_lines').upsert({
      match_id: record.match_id,
      bookmaker: record.bookmaker,
      market_type: record.market_type,
      selection: record.selection,
      line: record.line || null,
      closing_odds: record.closing_odds,
      closing_timestamp: record.closing_timestamp
    });

    if (error) {
      console.error('[MarketRepository] saveClosingLine error:', error.message);
      return false;
    }
    return true;
  }

  /**
   * Saves a microstructure analytics log.
   */
  public static async saveMicrostructureLog(record: {
    match_id: string;
    market_type: string;
    bookmaker: string;
    spread: number;
    overround: number;
    sharp_price_lead_latency_sec?: number | null;
    timestamp: string;
  }): Promise<boolean> {
    const { error } = await supabase.from('market_microstructure_logs').insert({
      match_id: record.match_id,
      market_type: record.market_type,
      bookmaker: record.bookmaker,
      spread: record.spread,
      overround: record.overround,
      sharp_price_lead_latency_sec: record.sharp_price_lead_latency_sec || null,
      timestamp: record.timestamp
    });

    if (error) {
      console.error('[MarketRepository] saveMicrostructureLog error:', error.message);
      return false;
    }
    return true;
  }

  /**
   * Saves calculated market edges.
   */
  public static async saveMarketEdges(edges: MarketEdgeDb[]): Promise<boolean> {
    if (edges.length === 0) return true;

    // Delete existing edges for this match first to avoid duplicates
    const matchId = edges[0].match_id;
    await supabase.from('market_edges').delete().eq('match_id', matchId);

    const { error } = await supabase.from('market_edges').insert(edges);
    if (error) {
      console.error('[MarketRepository] saveMarketEdges error:', error.message);
      return false;
    }
    return true;
  }

  /**
   * Saves rolling bias stats.
   */
  public static async saveRollingBias(record: {
    as_of_date: string;
    segment_type: string;
    segment_value: string;
    sample_size: number;
    avg_overround: number;
    brier_score: number;
    average_clv: number;
    historical_profitability: number;
  }): Promise<boolean> {
    const { error } = await supabase.from('market_rolling_bias').upsert(record);
    if (error) {
      console.error('[MarketRepository] saveRollingBias error:', error.message);
      return false;
    }
    return true;
  }

  /**
   * Fetches active rolling bias up to a specific date.
   */
  public static async getRollingBias(asOfDate: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('market_rolling_bias')
      .select('*')
      .lte('as_of_date', asOfDate)
      .order('as_of_date', { ascending: false });

    if (error) {
      console.error('[MarketRepository] getRollingBias error:', error.message);
      return [];
    }
    return data || [];
  }
}
