/**
 * BTTS Research API — `/api/research/btts/history`
 * ============================================================
 * Returns historical BTTS predictions with settlement results.
 * Queries from prediction_ledger_v3 joined with matches for actuals.
 * Read-only — NO external provider calls.
 */

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || '2026-01-01';
    const endDate = searchParams.get('endDate') || new Date().toISOString().slice(0, 10);
    const league = searchParams.get('league');
    const limit = Math.min(Number(searchParams.get('limit')) || 200, 500);

    let query = supabase
      .from('prediction_ledger_v3')
      .select(`
        id,
        match_id,
        market_type,
        selection,
        line,
        raw_probability,
        calibrated_probability,
        market_odds,
        expected_value,
        kelly_fraction,
        feature_version,
        feature_vector_snapshot,
        explainability_json,
        prediction_timestamp,
        prediction_hash,
        prior_hash,
        created_at,
        matches!inner(
          id,
          home_team,
          away_team,
          league,
          kickoff,
          status,
          home_goals,
          away_goals
        )
      `)
      .eq('market_type', 'BTTS')
      .gte('prediction_timestamp', `${startDate}T00:00:00Z`)
      .lte('prediction_timestamp', `${endDate}T23:59:59Z`)
      .order('prediction_timestamp', { ascending: false })
      .limit(limit);

    if (league) {
      query = query.ilike('matches.league', `%${league}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data || []).map((row: any) => {
      const match = row.matches;
      const homeGoals = match?.home_goals;
      const awayGoals = match?.away_goals;
      const isSettled = match?.status === 'FT' && homeGoals != null && awayGoals != null;
      const bttsOccurred = isSettled ? (homeGoals >= 1 && awayGoals >= 1) : null;

      const p = row.calibrated_probability || row.raw_probability || 0;
      const odds = row.market_odds || 0;
      const ev = row.expected_value ?? (odds > 0 ? p * odds - 1 : 0);
      const edge = p - (odds > 1 ? 1 / odds : 0);

      return {
        id: row.id,
        matchId: row.match_id,
        homeTeam: match?.home_team,
        awayTeam: match?.away_team,
        league: match?.league,
        kickoff: match?.kickoff,
        selection: row.selection,
        rawProbability: row.raw_probability,
        calibratedProbability: row.calibrated_probability,
        marketOdds: odds,
        expectedValue: Number(ev.toFixed(4)),
        edge: Number(edge.toFixed(4)),
        kellyFraction: row.kelly_fraction,
        predictionTimestamp: row.prediction_timestamp,
        // Settlement
        isSettled,
        homeGoals: isSettled ? homeGoals : null,
        awayGoals: isSettled ? awayGoals : null,
        bttsOccurred,
        outcome: isSettled
          ? (row.selection === 'BTTS YES'
              ? (bttsOccurred ? 'WIN' : 'LOSS')
              : (bttsOccurred ? 'LOSS' : 'WIN'))
          : 'PENDING',
        profitLoss: isSettled
          ? (row.selection === 'BTTS YES'
              ? (bttsOccurred ? odds - 1 : -1)
              : (!bttsOccurred ? odds - 1 : -1))
          : null,
        // Provenance
        featureSnapshot: row.feature_vector_snapshot,
        predictionHash: row.prediction_hash,
      };
    });

    // Compute aggregate statistics
    const settled = rows.filter((r: any) => r.isSettled);
    const wins = settled.filter((r: any) => r.outcome === 'WIN');
    const totalStaked = settled.length;
    const totalReturns = settled.reduce((sum: number, r: any) => sum + (r.profitLoss || 0), 0);
    const roi = totalStaked > 0 ? totalReturns / totalStaked : 0;

    return NextResponse.json({
      success: true,
      data: {
        predictions: rows,
        summary: {
          total: rows.length,
          settled: settled.length,
          pending: rows.length - settled.length,
          wins: wins.length,
          losses: settled.length - wins.length,
          hitRate: settled.length > 0 ? Number((wins.length / settled.length * 100).toFixed(1)) : null,
          roi: settled.length > 0 ? Number((roi * 100).toFixed(2)) : null,
          avgOdds: settled.length > 0
            ? Number((settled.reduce((s: number, r: any) => s + r.marketOdds, 0) / settled.length).toFixed(3))
            : null,
          avgModelProbability: rows.length > 0
            ? Number((rows.reduce((s: number, r: any) => s + (r.calibratedProbability || r.rawProbability || 0), 0) / rows.length).toFixed(4))
            : null,
          avgEdge: rows.length > 0
            ? Number((rows.reduce((s: number, r: any) => s + r.edge, 0) / rows.length).toFixed(4))
            : null,
          sampleSizeWarning: settled.length < 30
            ? 'Insufficient sample size for statistical confidence'
            : settled.length < 100
              ? 'Sample size below 100 — ROI not statistically verified'
              : null,
        },
      },
      filters: { startDate, endDate, league, limit },
    });
  } catch (error: any) {
    console.error('[BTTS History API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Error' },
      { status: 500 }
    );
  }
}
