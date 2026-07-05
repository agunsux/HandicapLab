import { supabase } from '@/lib/supabase.server';
import { OddsSnapshot } from './types';

export class ReplayEngine {
  /**
   * Retrieves the latest odds snapshot for each bookmaker and market
   * exactly strictly prior to the specified timestamp.
   * This ensures Zero Data Leakage for backtesting.
   */
  public static async getMarketStateAtTimestamp(
    fixtureId: string,
    marketId: string,
    timestamp: string
  ): Promise<OddsSnapshot[]> {
    
    // We use a query to get the distinct latest snapshot per bookmaker before the timestamp
    // Because Supabase JS doesn't support complex distinct ON directly with filters easily,
    // we fetch ordered by timestamp desc and filter manually in code (or use an RPC).
    
    // For production scaling, this should be an RPC `get_market_state_at(fixture, market, timestamp)`
    // Here we implement the application layer logic.
    const { data, error } = await supabase
      .from('wh_market_snapshots')
      .select('*')
      .eq('fixture_id', fixtureId)
      .eq('market_id', marketId)
      .lt('timestamp', timestamp)
      .order('timestamp', { ascending: false });
      
    if (error) {
      console.error('[ReplayEngine] Error fetching market state:', error);
      return [];
    }

    if (!data) return [];

    // Filter to get only the latest snapshot per bookmaker + selection
    const latestSnapshots = new Map<string, OddsSnapshot>();
    
    for (const row of data) {
      const key = `${row.bookmaker_id}_${row.selection}`;
      if (!latestSnapshots.has(key)) {
        latestSnapshots.set(key, row as OddsSnapshot);
      }
    }
    
    return Array.from(latestSnapshots.values());
  }
}
