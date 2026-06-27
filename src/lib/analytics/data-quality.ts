import { supabase } from '../supabase.server';

export interface QualityMetrics {
  quality_score: number;
  sharp_score: number;
  clv_score: number;
  liquidity_score: number;
  confidence_score: number;
}

export function calculateQualityMetrics(signal: {
  provider?: string;
  opening_odds?: number | null;
  closing_odds?: number | null;
  opening_line?: number | null;
  closing_line?: number | null;
  confidence?: number | null;
  league?: string | null;
}, clv: number | null): QualityMetrics {
  const sharp_score = (signal.provider === 'pinnacle' || !signal.provider) ? 100 : 70;
  
  const hasOpening = signal.opening_odds !== null && signal.opening_odds !== undefined;
  const hasClosing = signal.closing_odds !== null && signal.closing_odds !== undefined;
  
  const clv_score = (clv !== null) ? 100 : 50;
  
  const confidence_score = signal.confidence ? Math.min(100, Math.max(0, signal.confidence * 100)) : 50;
  
  const majorLeagues = [
    'English Premier League', 'Premier League', 'La Liga', 'LaLiga', 'Serie A', 'Bundesliga', 'Ligue 1', 
    'UEFA Champions League', 'Champions League', 'EPL'
  ];
  const leagueName = signal.league || '';
  const liquidity_score = majorLeagues.some(l => leagueName.toLowerCase().includes(l.toLowerCase())) ? 100 : 70;

  // Weighted average: sharp (20%), clv (30%), confidence (30%), liquidity (20%)
  const quality_score = Math.round(
    (sharp_score * 0.20) + 
    (clv_score * 0.30) + 
    (confidence_score * 0.30) + 
    (liquidity_score * 0.20)
  );

  return {
    quality_score,
    sharp_score,
    clv_score,
    liquidity_score,
    confidence_score
  };
}

export interface DataQualityReport {
  score: number;
  status: 'healthy' | 'warning' | 'broken';
  metrics: {
    totalSignals: number;
    orphanSignals: number;
    missingOdds: number;
    missingCorrelationIds: number;
    missingSettlementEvents: number;
    staleOddsCount: number;
    invalidSettlementStates: number;
  };
}

export class DataQualityEngine {
  public static async evaluate(): Promise<DataQualityReport> {
    let orphanSignals = 0;
    let missingOdds = 0;
    let missingCorrelationIds = 0;
    let missingSettlementEvents = 0;
    let staleOddsCount = 0;
    let invalidSettlementStates = 0;

    try {
      // 1. Get all signals
      const { data: signals, error: sigErr } = await supabase
        .from('signals')
        .select('id, settled_at, kickoff_utc, opening_odds, closing_odds, correlation_id, match_id');
      if (sigErr) throw sigErr;

      // Get all matches
      const { data: matches, error: matchErr } = await supabase
        .from('matches')
        .select('id');
      if (matchErr) throw matchErr;
      const matchIds = new Set((matches || []).map(m => String(m.id)));

      // Get all audit events
      const { data: auditEvents, error: auditErr } = await supabase
        .from('signal_audit_events')
        .select('signal_id, event_type, correlation_id');
      if (auditErr) throw auditErr;
      
      const settledEventIds = new Set(
        (auditEvents || [])
          .filter(e => e.event_type === 'SIGNAL_SETTLED')
          .map(e => e.signal_id)
      );

      // Get all odds history
      const { data: oddsHistory, error: oddsErr } = await supabase
        .from('odds_history')
        .select('signal_id, recorded_at, correlation_id');
      if (oddsErr) throw oddsErr;

      const totalSignals = signals?.length || 0;

      for (const sig of (signals || [])) {
        // Orphan signal check (non-matching match_id)
        if (!sig.match_id || !matchIds.has(String(sig.match_id))) {
          orphanSignals++;
        }

        // Missing correlation ID check
        if (!sig.correlation_id) {
          missingCorrelationIds++;
        }

        // Settled checks
        if (sig.settled_at) {
          if (sig.opening_odds === null || sig.closing_odds === null) {
            missingOdds++;
          }
          if (!settledEventIds.has(sig.id)) {
            missingSettlementEvents++;
          }
        }
      }

      // Check missing correlation IDs and staleness on odds history
      const now = new Date();
      for (const odds of (oddsHistory || [])) {
        if (!odds.correlation_id) {
          missingCorrelationIds++;
        }
        if (odds.recorded_at) {
          const recDate = new Date(odds.recorded_at);
          const diffHours = (now.getTime() - recDate.getTime()) / (1000 * 60 * 60);
          if (diffHours > 24) {
            staleOddsCount++;
          }
        }
      }

      // Check for audit events with missing correlation ID
      for (const ev of (auditEvents || [])) {
        if (!ev.correlation_id) {
          missingCorrelationIds++;
        }
      }

      // Check prediction_results table for invalid settlement states
      const { data: results, error: resErr } = await supabase
        .from('prediction_results')
        .select('prediction_id, profit_ah, profit_1x2, profit_ou, actual_home_score');
      if (resErr) throw resErr;

      for (const res of (results || [])) {
        const hasScore = res.actual_home_score !== null;
        const hasProfit = res.profit_ah !== null || res.profit_1x2 !== null || res.profit_ou !== null;
        if (hasScore && !hasProfit) {
          invalidSettlementStates++;
        }
      }

      // Calculate health score: 100 - (deductions per violation)
      let score = 100;
      score -= orphanSignals * 15;
      score -= missingOdds * 10;
      score -= missingCorrelationIds * 5;
      score -= missingSettlementEvents * 10;
      score -= staleOddsCount * 2;
      score -= invalidSettlementStates * 15;
      score = Math.max(0, score);

      let status: 'healthy' | 'warning' | 'broken' = 'healthy';
      if (score < 60 || orphanSignals > 0 || invalidSettlementStates > 0 || missingSettlementEvents > 0) {
        status = 'broken';
      } else if (score < 90 || missingOdds > 0 || staleOddsCount > 0 || missingCorrelationIds > 0) {
        status = 'warning';
      }

      let confidence_level: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
      if (totalSignals >= 30 && totalSignals <= 100) {
        confidence_level = 'MEDIUM';
      } else if (totalSignals > 100) {
        confidence_level = 'HIGH';
      }

      return {
        score,
        status,
        quality_score: score,
        confidence_level,
        sample_size: totalSignals,
        metrics: {
          totalSignals,
          orphanSignals,
          missingOdds,
          missingCorrelationIds,
          missingSettlementEvents,
          staleOddsCount,
          invalidSettlementStates
        }
      };

    } catch (err: any) {
      console.error('[DataQualityEngine] Evaluation failed:', err);
      return {
        score: 0,
        status: 'broken',
        quality_score: 0,
        confidence_level: 'LOW',
        sample_size: 0,
        metrics: {
          totalSignals: 0,
          orphanSignals: 1,
          missingOdds: 0,
          missingCorrelationIds: 0,
          missingSettlementEvents: 0,
          staleOddsCount: 0,
          invalidSettlementStates: 0
        }
      };
    }
  }
}
