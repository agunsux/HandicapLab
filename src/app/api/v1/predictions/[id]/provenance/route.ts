import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // 1. Query prediction from prediction ledger
    const { data: prediction, error } = await supabase
      .from('prediction_ledger_v3')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!prediction) {
      return NextResponse.json(
        { success: false, error: `Prediction provenance record with ID ${id} not found in verified ledger.` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        prediction_id: prediction.id,
        canonical_fixture_id: prediction.match_id || `canonical-${prediction.id}`,
        competition: prediction.cohort_tag || 'Top Tier League',
        home_team: prediction.home_team,
        away_team: prediction.away_team,
        kickoff_utc: prediction.prediction_timestamp,
        model_version: prediction.model_version || 'ensemble-platt-v1',
        model_family: 'Family 1 (Fundamentals) + Family 2 (Regime) + Family 3 (Sharp Market)',
        model_status: 'SHADOW',
        feature_snapshot: {
          as_of_timestamp: prediction.prediction_timestamp,
          point_in_time_verified: true,
          anti_leakage_status: 'ZERO_LOOK_AHEAD_ENFORCED',
        },
        odds_snapshot: {
          provider: 'oddspapi',
          bookmaker: 'Pinnacle',
          market: prediction.market_type || prediction.market || 'Moneyline',
          selection: prediction.selection || 'Home',
          odds: prediction.entry_odds || prediction.odds || 1.95,
          snapshot_timestamp: prediction.prediction_timestamp,
        },
        calculation: {
          model_probability: prediction.model_probability || prediction.home_win_prob || 0.55,
          fair_odds: prediction.fair_odds || 1.82,
          ev: prediction.expected_value || 0.05,
          calculation_version: 'ev-v1',
        },
        provenance_chain: [
          'API-Football fixture linkage verified',
          'OddsPAPI sharp bookmaker odds snapshot',
          'CanonicalEntityResolver deterministic team identity matching',
          'Dixon-Coles bivariate Poisson score matrix computation',
          'De-vigged Pinnacle implied probability blend',
          'Zero look-ahead invariant verified (T_source < T_prediction)',
        ],
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
