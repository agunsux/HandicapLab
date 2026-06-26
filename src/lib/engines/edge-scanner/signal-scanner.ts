import { supabase } from '../../supabase.server';
import { EdgePick } from './types';

// Ensure this module is only imported/run on the server side
if (typeof window !== 'undefined') {
  throw new Error('SignalScanner can only be used on the server side.');
}

export interface MatchMetaData {
  league?: string;
  home_team: string;
  away_team: string;
  kickoff_utc: string;
}

export class SignalScanner {
  /**
   * Safe batch ingestion of EdgePicks into the signals database table.
   * - Prevents duplicate signals.
   * - Respects unique constraint on (match_id, market, handicap_line).
   * - Batch inserts/upserts all records in a single query.
   * - Confidence score is derived strictly from model inputs (no arbitrary constants).
   */
  public static async saveSignals(
    picks: EdgePick[],
    meta: MatchMetaData
  ): Promise<void> {
    if (picks.length === 0) {
      console.log('[SignalScanner] No picks available to save.');
      return;
    }

    // Map EdgePicks to Supabase signals payload structure
    const payloads = picks.map(pick => {
      // Confidence score derivation (e.g. from expected value and model probability)
      // Standardizes to a model-derived float with no arbitrary bounds/constants.
      const derivedConfidence = pick.modelProbability * (1.0 + Math.max(0, pick.expectedValue));

      // Resolve db market name: asian_handicap, over_under, moneyline
      let dbMarket = 'moneyline';
      if (pick.marketType === 'AH') {
        dbMarket = 'asian_handicap';
      } else if (pick.marketType === 'OU') {
        dbMarket = 'over_under';
      }

      // Parse handicap line
      const lineNum = pick.line && pick.line !== '1X2' ? parseFloat(pick.line) : 0.0;

      return {
        match_id: pick.matchId,
        league: meta.league || null,
        home_team: meta.home_team,
        away_team: meta.away_team,
        kickoff_utc: meta.kickoff_utc,
        market: dbMarket,
        handicap_line: lineNum,
        selection: pick.outcome,
        odds: pick.marketOdds,
        fair_odds: pick.modelProbability > 0 ? 1 / pick.modelProbability : 0,
        probability: pick.modelProbability,
        edge_pct: pick.expectedValue * 100, // represent edge as percentage (e.g. 10.5%)
        confidence: Number(derivedConfidence.toFixed(4)),
        status: 'pending',
        updated_at: new Date().toISOString()
      };
    });

    console.log(`[SignalScanner] Saving batch of ${payloads.length} signals for match ${meta.home_team} vs ${meta.away_team}...`);

    // Perform batch upsert on the UNIQUE constraint (match_id, market, handicap_line)
    const { error } = await supabase
      .from('signals')
      .upsert(payloads, {
        onConflict: 'match_id,market,handicap_line',
        ignoreDuplicates: false // overwrite with latest odds/edge if already exists
      });

    if (error) {
      console.error('[SignalScanner] Error saving signals to database:', error);
      throw error;
    }

    console.log(`[SignalScanner] Successfully batch inserted ${payloads.length} signals.`);
  }
}
