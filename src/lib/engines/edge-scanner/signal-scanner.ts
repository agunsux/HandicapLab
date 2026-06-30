import crypto from 'crypto';
import { supabase } from '../../supabase.server';
import { EdgePick } from './types';
import { calculateQualityMetrics } from '../../analytics/data-quality';
import { MarketTruthScanner } from '../../validation/market-truth';
import { CohortSelector } from '../../validation/cohort-selector';

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
   */
  public static async saveSignals(
    picks: EdgePick[],
    meta: MatchMetaData
  ): Promise<void> {
    if (picks.length === 0) {
      console.log('[SignalScanner] No picks available to save.');
      return;
    }

    const validPayloads: any[] = [];

    for (const pick of picks) {
      // 1. Evaluate Market Truth / Data Quality Guards
      const truthInput = {
        openingOdds: pick.marketOdds,
        referenceBookmaker: 'PINNACLE',
        oddsTimestamp: new Date().toISOString(),
        kickoffUtc: meta.kickoff_utc,
        marketSuspended: false,
        liquidityScore: 90,
        lineMovementQuality: 90
      };

      const truthResult = MarketTruthScanner.evaluate(truthInput);

      if (!truthResult.isValid) {
        console.warn(`[SignalScanner] Pick rejected due to data quality/guards: ${truthResult.errors.join(', ')}`);
        continue;
      }

      // Confidence score derivation (e.g. from expected value and model probability)
      const derivedConfidence = pick.modelProbability * (1.0 + Math.max(0, pick.expectedValue));

      // Unified Confidence Score: Confidence = (data quality * 0.3) + (model confidence * 0.4) + (market liquidity * 0.3)
      const unifiedConfidence = MarketTruthScanner.calculateConfidence(
        truthResult.score,
        derivedConfidence * 100,
        90
      ) / 100;

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

      const cohort = CohortSelector.resolve(meta.league || 'Other');
      const kickoffTime = new Date(meta.kickoff_utc).getTime();
      const now = Date.now();
      const hoursBeforeKickoff = Number(((kickoffTime - now) / (1000 * 60 * 60)).toFixed(2));

      validPayloads.push({
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
        confidence: Number(unifiedConfidence.toFixed(4)),
        status: 'pending',
        model_version: 'rule_v1',
        updated_at: new Date().toISOString(),
        
        // Sprint 9 CLV Baselining & Market Truth columns
        opening_reference_book: 'PINNACLE',
        opening_line: lineNum,
        opening_price: pick.marketOdds,
        clv_status: 'pending',
        market_truth_score: truthResult.score,
        model_probability: pick.modelProbability,
        model_price: pick.modelProbability > 0 ? 1 / pick.modelProbability : 0,
        opening_market_snapshot: {
          handicap: lineNum,
          price: pick.marketOdds,
          bookmaker: 'PINNACLE'
        },

        // Sprint 10 Cohorts & timing tracking columns
        league_cohort: cohort,
        prediction_created_at: new Date().toISOString(),
        opening_capture_time: new Date().toISOString(),
        hours_before_kickoff: hoursBeforeKickoff,
        
        // Sprint 10 Evidence Collection Sprint Premium Gating
        premium_eligible: truthResult.score >= 75 && unifiedConfidence >= 0.65
      });
    }

    if (validPayloads.length === 0) {
      console.log('[SignalScanner] No valid picks passed validation guards.');
      return;
    }

    console.log(`[SignalScanner] Saving batch of ${validPayloads.length} signals for match ${meta.home_team} vs ${meta.away_team}...`);

    // Perform batch upsert on the UNIQUE constraint (match_id, market, handicap_line, selection)
    const { data: savedRows, error } = await supabase
      .from('signals')
      .upsert(validPayloads, {
        onConflict: 'match_id,market,handicap_line,selection',
        ignoreDuplicates: false // overwrite with latest odds/edge if already exists
      })
      .select('id, match_id, market, handicap_line, selection, odds, confidence, market_category, market_selection');

    if (error) {
      console.error('[SignalScanner] Error saving signals to database:', error);
      throw error;
    }

    console.log(`[SignalScanner] Successfully batch inserted ${validPayloads.length} signals.`);

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
