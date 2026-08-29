import { DailyAhShadowPipeline } from '@/lib/pipeline/dailyAhShadowPipeline';

export interface TerminalModelVersion {
  id: string;
  market_scope: string;
  architecture_description: string;
  hypothesis: string;
  frozen_parameters: Record<string, any>;
  backtest_status: string;
  validation_state: string;
  backtest_realized_roi: number;
  backtest_clv_mean: number;
  backtest_clv_pvalue: number;
  backtest_n_bets: number;
}

export interface TerminalPrediction {
  id: string;
  fixture_id: string;
  league_id: string;
  league_name: string;
  country?: string;
  kickoff_at: string;
  home_team: string;
  away_team: string;
  model_version: string;
  line: number;
  side: 'home' | 'away';
  fair_probability: number;
  fair_odds: number;
  devig_market_probability: number;
  taken_odds: number;
  closing_odds?: number | null;
  edge: number;
  ev: number;
  clv?: number | null;
  settlement_status: 'PENDING' | 'SETTLED' | 'VOID';
  actual_outcome?: string | null;
  profit_loss?: number | null;
  settled_at?: string | null;
  created_at: string;
  updated_at: string;
}

export const SEEDED_MODELS: TerminalModelVersion[] = [
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

export async function getTerminalPredictions(): Promise<TerminalPrediction[]> {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data, error } = await supabase
        .from('public_predictions')
        .select('*')
        .order('kickoff_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data as TerminalPrediction[];
      }
    } catch (err) {
      console.warn('[getTerminalPredictions] Supabase fetch error, fallback to JSONL:', err);
    }
  }

  const localLedger = DailyAhShadowPipeline.loadLedger();
  return localLedger.map((r) => ({
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

export async function getTerminalModels(): Promise<TerminalModelVersion[]> {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data, error } = await supabase.from('model_versions').select('*');

      if (!error && data && data.length > 0) {
        return data as TerminalModelVersion[];
      }
    } catch (err) {
      console.warn('[getTerminalModels] Supabase fetch error, fallback to seeded:', err);
    }
  }

  return SEEDED_MODELS;
}
