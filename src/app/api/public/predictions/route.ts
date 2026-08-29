import { NextResponse } from 'next/server';
import { DailyAhShadowPipeline, RESEARCH_HONESTY_BANNER } from '@/lib/pipeline/dailyAhShadowPipeline';

export const revalidate = 300; // 5 minutes cache

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
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseKey) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data, error } = await supabase
          .from('public_predictions')
          .select('*')
          .order('kickoff_at', { ascending: false })
          .limit(100);

        if (!error && data && data.length > 0) {
          predictions = data;
        }
      } catch (err) {
        console.warn('[Public Predictions API] Supabase fetch fallback to local ledger:', err);
      }
    }

    // Fallback to local ledger
    if (predictions.length === 0) {
      const localLedger = DailyAhShadowPipeline.loadLedger();
      predictions = localLedger.map((r) => ({
        id: r.id,
        fixture_id: r.fixtureId,
        league_id: r.leagueId,
        league_name: r.leagueName,
        country: r.leagueName,
        kickoff_at: r.kickoffAt,
        home_team: r.homeTeam,
        away_team: r.awayTeam,
        model_version: r.modelVersion,
        line: r.line,
        side: r.side,
        fair_probability: r.fairProbability,
        fair_odds: r.fairOdds,
        devig_market_probability: r.devigMarketProbability,
        taken_odds: r.takenOdds,
        closing_odds: r.closingOdds || null,
        edge: r.edge,
        ev: r.ev,
        clv: r.clv || null,
        settlement_status: r.settlementStatus,
        actual_outcome: r.actualOutcome || null,
        profit_loss: r.profitLoss || null,
        settled_at: r.settledAt || null,
        created_at: r.createdAt,
        updated_at: r.updatedAt,
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
