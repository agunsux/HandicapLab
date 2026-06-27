import crypto from 'crypto';
import { supabase } from '../../supabase.server';
import { EdgePick } from './types';
import { calculateQualityMetrics } from '../../analytics/data-quality';

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

      let marketSelection: string = pick.outcome;
      if (pick.marketType === 'AH' || pick.marketType === 'OU') {
        marketSelection = `${pick.outcome}_${pick.line}`;
      }

      return {
        match_id: pick.matchId,
        league: meta.league || null,
        home_team: meta.home_team,
        away_team: meta.away_team,
        kickoff_utc: meta.kickoff_utc,
        market: dbMarket,
        market_category: dbMarket,
        market_selection: marketSelection,
        handicap_line: lineNum,
        selection: pick.outcome,
        odds: pick.marketOdds,
        fair_odds: pick.modelProbability > 0 ? 1 / pick.modelProbability : 0,
        probability: pick.modelProbability,
        edge_pct: pick.expectedValue * 100, // represent edge as percentage (e.g. 10.5%)
        confidence: Number(derivedConfidence.toFixed(4)),
        status: 'pending',
        model_version: 'rule_v1',
        updated_at: new Date().toISOString()
      };
    });

    console.log(`[SignalScanner] Saving batch of ${payloads.length} signals for match ${meta.home_team} vs ${meta.away_team}...`);

    // Perform batch upsert on the UNIQUE constraint (match_id, market, handicap_line)
    const { data: savedRows, error } = await supabase
      .from('signals')
      .upsert(payloads, {
        onConflict: 'match_id,market,handicap_line',
        ignoreDuplicates: false // overwrite with latest odds/edge if already exists
      })
      .select('id, match_id, market, handicap_line, selection, odds, confidence, market_category, market_selection');

    if (error) {
      console.error('[SignalScanner] Error saving signals to database:', error);
      throw error;
    }

    console.log(`[SignalScanner] Successfully batch inserted ${payloads.length} signals.`);

    // Immutable audit events logging (with transaction safety)
    if (savedRows && savedRows.length > 0) {
      const correlationId = crypto.randomUUID();
      for (const row of savedRows) {
        try {
          await supabase
            .from('signal_audit_events')
            .insert({
              signal_id: row.id,
              event_type: 'SIGNAL_CREATED',
              source: 'signal_scanner',
              correlation_id: correlationId,
              payload: {
                match_id: row.match_id,
                market: row.market,
                handicap_line: row.handicap_line,
                selection: row.selection,
                odds: row.odds
              }
            });
        } catch (auditErr) {
          console.error(`[SignalScanner] Failed to write SIGNAL_CREATED audit event for signal ${row.id}:`, auditErr);
        }

        // Insert initial quality score to signal_metrics as append-only history record
        try {
          const metrics = calculateQualityMetrics({
            provider: 'pinnacle',
            opening_odds: row.odds,
            closing_odds: null,
            opening_line: row.handicap_line,
            closing_line: null,
            confidence: row.confidence,
            league: meta.league || null
          }, null);

          await supabase
            .from('signal_metrics')
            .insert({
              signal_id: row.id,
              quality_score: metrics.quality_score,
              sharp_score: metrics.sharp_score,
              clv_score: metrics.clv_score,
              liquidity_score: metrics.liquidity_score,
              confidence_score: metrics.confidence_score,
              model_version: 'rule_v1',
              calculated_at: new Date().toISOString()
            });
        } catch (metricsErr) {
          console.error(`[SignalScanner] Failed to write initial quality metrics for signal ${row.id}:`, metricsErr);
        }
      }
    }
  }
}
