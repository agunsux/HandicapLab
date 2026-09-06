import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';

export const revalidate = 300; // 5 minutes cache

export const RESEARCH_HONESTY_BANNER =
  'HandicapLab quantitative model evaluations benchmarked against Pinnacle closing lines. Production ledger active since 2026-09-06.';

export const SEEDED_MODELS = [
  {
    id: 'AH-dixoncoles-v1.0.0',
    market_scope: 'AH',
    architecture_description: 'Dixon-Coles bivariate goal matrix, time-weighted decay, rho per fold',
    hypothesis: 'Baseline champion from EPIC 56 calibration tournament',
    frozen_parameters: { rho: -0.05, shrinkage: 0.0, decay_xi: 0.0019, max_goals: 6 },
    backtest_status: 'COMPLETE',
    validation_state: 'RESEARCH_ONLY',
    backtest_realized_roi: -2.30,
    backtest_clv_mean: -0.0311,
    backtest_clv_pvalue: 0.555,
    backtest_n_bets: 7225,
  },
  {
    id: 'AH-dixoncoles-shrink10-v1.0.1',
    market_scope: 'AH',
    architecture_description: 'Dixon-Coles + 10% shrinkage toward market',
    hypothesis: 'Reduce overconfidence via 10% market blend',
    frozen_parameters: { rho: -0.05, shrinkage: 0.10, decay_xi: 0.0019, max_goals: 6 },
    backtest_status: 'COMPLETE',
    validation_state: 'RESEARCH_ONLY',
    backtest_realized_roi: -2.00,
    backtest_clv_mean: 0.0086,
    backtest_clv_pvalue: 0.92,
    backtest_n_bets: 5831,
  },
  {
    id: 'AH-dixoncoles-shrink20-v1.0.2',
    market_scope: 'AH',
    architecture_description: 'Dixon-Coles + 20% shrinkage toward market',
    hypothesis: 'Reduce overconfidence via 20% market blend',
    frozen_parameters: { rho: -0.05, shrinkage: 0.20, decay_xi: 0.0019, max_goals: 6 },
    backtest_status: 'COMPLETE',
    validation_state: 'RESEARCH_ONLY',
    backtest_realized_roi: -1.90,
    backtest_clv_mean: 0.0431,
    backtest_clv_pvalue: 0.63,
    backtest_n_bets: 5805,
  },
  {
    id: 'AH-dixoncoles-shrink30-v1.0.3',
    market_scope: 'AH',
    architecture_description: 'Dixon-Coles + 30% shrinkage toward market',
    hypothesis: 'Reduce overconfidence via 30% market blend',
    frozen_parameters: { rho: -0.05, shrinkage: 0.30, decay_xi: 0.0019, max_goals: 6 },
    backtest_status: 'COMPLETE',
    validation_state: 'RESEARCH_ONLY',
    backtest_realized_roi: -2.23,
    backtest_clv_mean: 0.0705,
    backtest_clv_pvalue: 0.43,
    backtest_n_bets: 5778,
  },
];

export async function GET() {
  try {
    let predictions: any[] = [];

    const { data, error } = await supabase
      .from('active_daily_picks')
      .select('*')
      .order('kickoff_utc', { ascending: true })
      .limit(100);

    if (!error && data && data.length > 0) {
      predictions = data.map((p) => ({
        id: p.id,
        fixture_id: p.fixture_id,
        league_id: p.league_id,
        league_name: p.league,
        country: p.country || p.league,
        kickoff_at: p.kickoff_utc,
        home_team: p.home_team,
        away_team: p.away_team,
        model_version: p.model_version || 'AH-dixoncoles-v1.0.0',
        line: p.line,
        side: p.prediction,
        fair_probability: p.model_probability,
        fair_odds: p.fair_odds,
        devig_market_probability: p.market_probability || null,
        taken_odds: p.market_odds,
        closing_odds: p.closing_odds || null,
        edge: p.edge_pct ? p.edge_pct / 100 : 0,
        ev: p.expected_value || null,
        clv: p.clv_percentage || null,
        settlement_status: p.status,
        actual_outcome: p.actual_score || null,
        profit_loss: p.profit_loss || null,
        settled_at: p.settled_at || null,
        created_at: p.created_at,
        updated_at: p.updated_at,
      }));
    }

    const modelMap = new Map(SEEDED_MODELS.map((m) => [m.id, m]));

    const enriched = predictions.map((p) => {
      const model = modelMap.get(p.model_version) || SEEDED_MODELS[0];
      return {
        ...p,
        model_info: {
          id: model.id,
          validation_state: model.validation_state,
          backtest_realized_roi: model.backtest_realized_roi,
          backtest_clv_pvalue: model.backtest_clv_pvalue,
        },
      };
    });

    return NextResponse.json(
      {
        status: 'SUCCESS',
        research_status_banner: RESEARCH_HONESTY_BANNER,
        count: enriched.length,
        predictions: enriched,
      },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=300, s-maxage=300',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Error' }, { status: 500 });
  }
}
