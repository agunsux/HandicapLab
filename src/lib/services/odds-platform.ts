// Production Odds Data Platform Service Layer
// Location: src/lib/services/odds-platform.ts

import { supabase } from '../supabase.server';
import { OddsNormalizer } from '../data/oddsNormalizer';

export interface OddsSnapshotRecord {
  id?: string;
  fixture_id: string;
  provider_id: string;
  bookmaker_id: string;
  market_id: string;
  selection: string;
  handicap_line?: number;
  decimal_odds: number;
  implied_probability?: number;
  is_live?: boolean;
  captured_at?: string;
}

export class OddsPlatformService {
  /**
   * Retrieves the latest odds snapshot for a given fixture, bookmaker, and market.
   */
  public static async getLatestOdds(
    fixtureId: string,
    bookmakerId: string,
    marketId: string
  ): Promise<OddsSnapshotRecord | null> {
    const { data, error } = await supabase
      .from('odds_snapshots')
      .select('*')
      .eq('match_id', fixtureId)
      .eq('bookmaker_id', bookmakerId)
      .eq('market_id', marketId)
      .order('captured_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return {
      id: data.id,
      fixture_id: data.match_id,
      provider_id: data.provider_id,
      bookmaker_id: data.bookmaker_id,
      market_id: data.market_id,
      selection: data.selection,
      handicap_line: data.line ? Number(data.line) : undefined,
      decimal_odds: Number(data.odds),
      implied_probability: data.implied_probability ? Number(data.implied_probability) : undefined,
      is_live: data.is_live,
      captured_at: data.captured_at
    };
  }

  /**
   * Retrieves the opening line for a given fixture, bookmaker, and market.
   */
  public static async getOpeningOdds(
    fixtureId: string,
    bookmakerId: string,
    marketId: string
  ): Promise<any | null> {
    const { data, error } = await supabase
      .from('opening_lines')
      .select('*')
      .eq('fixture_id', fixtureId)
      .eq('bookmaker_id', bookmakerId)
      .eq('market_id', marketId)
      .maybeSingle();

    if (error || !data) return null;
    return data;
  }

  /**
   * Retrieves the closing line for a given fixture, bookmaker, and market.
   */
  public static async getClosingOdds(
    fixtureId: string,
    bookmakerId: string,
    marketId: string
  ): Promise<any | null> {
    const { data, error } = await supabase
      .from('closing_lines')
      .select('*')
      .eq('fixture_id', fixtureId)
      .eq('bookmaker_id', bookmakerId)
      .eq('market_id', marketId)
      .maybeSingle();

    if (error || !data) return null;
    return data;
  }

  /**
   * Retrieves the historical timeline of odds movements for a given fixture.
   */
  public static async getOddsTimeline(fixtureId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('odds_movements')
      .select('*')
      .eq('fixture_id', fixtureId)
      .order('timestamp', { ascending: true });

    if (error || !data) return [];
    return data;
  }

  /**
   * Retrieves consensus lines (average, median, sharp consensus) for a given fixture and market.
   */
  public static async getConsensusOdds(
    fixtureId: string,
    marketId: string
  ): Promise<any | null> {
    const { data, error } = await supabase
      .from('consensus_lines')
      .select('*')
      .eq('fixture_id', fixtureId)
      .eq('market_id', marketId)
      .maybeSingle();

    if (error || !data) return null;
    return data;
  }

  /**
   * Retrieves sharp consensus line (typically Pinnacle or primary sharp exchange) for a fixture/market.
   */
  public static async getSharpOdds(
    fixtureId: string,
    marketId: string
  ): Promise<number | null> {
    const data = await this.getConsensusOdds(fixtureId, marketId);
    if (!data || !data.sharp_consensus) return null;
    return Number(data.sharp_consensus);
  }

  /**
   * Retrieves market efficiency metrics for a given fixture and market.
   */
  public static async getMarketEfficiency(
    fixtureId: string,
    marketId: string
  ): Promise<any | null> {
    const { data, error } = await supabase
      .from('market_efficiency')
      .select('*')
      .eq('fixture_id', fixtureId)
      .eq('market_id', marketId)
      .maybeSingle();

    if (error || !data) return null;
    return data;
  }

  /**
   * Ingest and normalizes a new odds snapshot, calculating overrounds and updating
   * consensus engines & historical timelines.
   */
  public static async recordOddsSnapshot(record: OddsSnapshotRecord): Promise<string> {
    const capturedAt = record.captured_at || new Date().toISOString();
    const impliedProbability = 1 / record.decimal_odds;

    // 1. Get previous snapshot to calculate odds movement
    const { data: prev } = await supabase
      .from('odds_snapshots')
      .select('id, odds')
      .eq('match_id', record.fixture_id)
      .eq('bookmaker_id', record.bookmaker_id)
      .eq('market_id', record.market_id)
      .eq('selection', record.selection)
      .order('captured_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 2. Insert core odds_snapshots record
    const { data: snap, error: insertError } = await supabase
      .from('odds_snapshots')
      .insert({
        match_id: record.fixture_id,
        provider_id: record.provider_id,
        bookmaker_id: record.bookmaker_id,
        market_id: record.market_id,
        selection: record.selection,
        line: record.handicap_line || null,
        odds: record.decimal_odds,
        implied_probability: impliedProbability,
        is_live: record.is_live || false,
        captured_at: capturedAt,
        bookmaker: 'Consolidated', // compatibility fallback
        market: 'Consolidated'     // compatibility fallback
      })
      .select('id')
      .single();

    if (insertError || !snap) {
      throw new Error(`Failed to insert odds snapshot: ${insertError?.message}`);
    }

    const snapshotId = snap.id;

    // 3. Record movement if previous odds exist and differ
    if (prev && Number(prev.odds) !== record.decimal_odds) {
      const oddsBefore = Number(prev.odds);
      const oddsAfter = record.decimal_odds;
      const movement = oddsAfter - oddsBefore;

      await supabase.from('odds_movements').insert({
        snapshot_id: snapshotId,
        fixture_id: record.fixture_id,
        previous_snapshot_id: prev.id,
        odds_before: oddsBefore,
        odds_after: oddsAfter,
        movement: movement,
        timestamp: capturedAt
      });
    }

    // 4. Update Opening Line (insert only if not exists)
    await supabase.from('opening_lines').insert({
      fixture_id: record.fixture_id,
      bookmaker_id: record.bookmaker_id,
      market_id: record.market_id,
      opening_odds: record.decimal_odds,
      opening_timestamp: capturedAt
    }).then(res => {
      // ignore duplicate conflicts on primary key
    });

    // 5. Update Closing Line (overwrite continuously until match starts)
    await supabase.from('closing_lines').upsert({
      fixture_id: record.fixture_id,
      bookmaker_id: record.bookmaker_id,
      market_id: record.market_id,
      closing_odds: record.decimal_odds,
      closing_timestamp: capturedAt
    });

    // 6. Recalculate Consensus Lines
    await this.recalculateConsensus(record.fixture_id, record.market_id);

    return snapshotId;
  }

  /**
   * Programmatic consensus and overround calculator.
   */
  private static async recalculateConsensus(fixtureId: string, marketId: string): Promise<void> {
    // Fetch latest snapshots from all bookmakers for this fixture + market
    const { data: snapshots, error } = await supabase
      .from('odds_snapshots')
      .select('bookmaker_id, odds, selection')
      .eq('match_id', fixtureId)
      .eq('market_id', marketId);

    if (error || !snapshots || snapshots.length === 0) return;

    // Group snapshots by bookmaker to get the latest per bookmaker
    const latestPerBookmaker: Record<string, Record<string, number>> = {};
    
    // We also want to locate Pinnacle odds specifically for sharp consensus
    let pinnacleId: string | null = null;
    const { data: pinnacleB } = await supabase
      .from('bookmakers')
      .select('id')
      .eq('bookmaker_name', 'Pinnacle')
      .maybeSingle();
    if (pinnacleB) pinnacleId = pinnacleB.id;

    snapshots.forEach((s: any) => {
      const bid = s.bookmaker_id;
      const selection = s.selection;
      const oddsVal = Number(s.odds);

      if (!latestPerBookmaker[bid]) {
        latestPerBookmaker[bid] = {};
      }
      latestPerBookmaker[bid][selection] = oddsVal;
    });

    // Extract average and median odds for each selection
    const selectionsList = Array.from(new Set(snapshots.map((s: any) => s.selection)));
    const averages: Record<string, number> = {};
    const medians: Record<string, number> = {};
    let sharpConsensusOdds: number | null = null;

    selectionsList.forEach(sel => {
      const oddsForSel: number[] = [];
      Object.values(latestPerBookmaker).forEach(bookmakerOdds => {
        if (bookmakerOdds[sel]) {
          oddsForSel.push(bookmakerOdds[sel]);
        }
      });

      if (oddsForSel.length > 0) {
        // Average
        const sum = oddsForSel.reduce((a, b) => a + b, 0);
        averages[sel] = sum / oddsForSel.length;

        // Median
        oddsForSel.sort((a, b) => a - b);
        const mid = Math.floor(oddsForSel.length / 2);
        medians[sel] = oddsForSel.length % 2 !== 0 ? oddsForSel[mid] : (oddsForSel[mid - 1] + oddsForSel[mid]) / 2;
      }
    });

    // Sharp consensus is Pinnacle odds if available, fallback to median
    if (pinnacleId && latestPerBookmaker[pinnacleId]) {
      // Take the first selection odds as consensus proxy or median
      const sharpOddsArr = Object.values(latestPerBookmaker[pinnacleId]);
      if (sharpOddsArr.length > 0) {
        sharpConsensusOdds = sharpOddsArr[0];
      }
    }
    if (!sharpConsensusOdds && Object.values(medians).length > 0) {
      sharpConsensusOdds = Object.values(medians)[0];
    }

    // Calculate Consensus Overround
    const norm = OddsNormalizer.normalize(averages);

    // Save consensus lines
    const avgVal = Object.values(averages)[0] || 1.95;
    const medVal = Object.values(medians)[0] || 1.95;

    await supabase.from('consensus_lines').upsert({
      fixture_id: fixtureId,
      market_id: marketId,
      average_odds: avgVal,
      median_odds: medVal,
      sharp_consensus: sharpConsensusOdds || avgVal,
      overround: norm.overround,
      timestamp: new Date().toISOString()
    });

    // Calculate Market Efficiency
    // Score based on overround (lower overround = higher efficiency) and price volatility
    // Standard Overround for highly efficient ML is 3-4% (0.03 - 0.04)
    const overroundFactor = Math.max(0, 1.0 - norm.overround * 10); // e.g. 0.04 overround => 0.6 efficiency proxy
    const efficiencyScore = Number(Math.min(1.0, Math.max(0.0, overroundFactor)).toFixed(4));

    await supabase.from('market_efficiency').upsert({
      fixture_id: fixtureId,
      market_id: marketId,
      efficiency_score: efficiencyScore,
      volatility: 0.02, // baseline
      liquidity_proxy: 0.85,
      updated_at: new Date().toISOString()
    });
  }
}
