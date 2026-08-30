import { DailyAhShadowPipeline, AhPredictionLedgerRecord } from './pipeline/dailyAhShadowPipeline';

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

export interface TerminalPredictionRow {
  id: string;
  fixture_id: string;
  league_id: string;
  league_name: string;
  match_date: string;
  kickoff_at: string;
  home_team: string;
  away_team: string;
  market: 'ASIAN_HANDICAP';
  line: number;
  side: 'home' | 'away';
  fair_probability: number;
  fair_odds: number;
  devig_market_probability: number;
  taken_odds: number;
  closing_odds?: number | null;
  edge: number;
  ev: number;
  kelly_fraction: number;
  recommended_stake_pct: number;
  value_qualification_state: string;
  sample_size: number;
  sample_status: string;
  model_version: string;
  validation_state: string;
  settlement_status: 'PENDING' | 'SETTLED' | 'VOID';
  clv: number | null;
  actual_outcome: string | null;
  profit_loss: number | null;
  research_honesty_banner: string;
  created_at: string;
  updated_at: string;
}

export type TerminalPrediction = TerminalPredictionRow;

export function getTerminalModels() {
  return SEEDED_MODELS;
}

export function getTerminalPredictions(): TerminalPredictionRow[] {
  const ledger = DailyAhShadowPipeline.loadLedger();
  return ledger.map((r: AhPredictionLedgerRecord) => ({
    id: String(r.id || r.predictionId || ''),
    fixture_id: r.fixtureId,
    league_id: r.leagueId,
    league_name: r.leagueName,
    match_date: r.matchDate,
    kickoff_at: String(r.kickoffAt || r.kickoffTime || ''),
    home_team: r.homeTeam,
    away_team: r.awayTeam,
    market: r.market,
    line: r.line,
    side: r.side,
    fair_probability: Number(r.fairProbability ?? r.modelProb ?? 0),
    fair_odds: r.fairOdds,
    devig_market_probability: Number(r.devigMarketProbability ?? r.marketProb ?? 0),
    taken_odds: Number(r.takenOdds ?? r.marketOdds ?? 0),
    closing_odds: r.closingOdds ?? null,
    edge: r.edge,
    ev: r.ev,
    kelly_fraction: r.kellyFraction,
    recommended_stake_pct: r.recommendedStakePct,
    value_qualification_state: r.valueQualificationState,
    sample_size: r.sampleSize,
    sample_status: r.sampleStatus,
    model_version: r.modelVersion,
    validation_state: r.validationState,
    settlement_status: r.settlementStatus,
    clv: r.clv ?? r.closingClv ?? null,
    actual_outcome: r.actualOutcome ?? r.settlementOutcome ?? null,
    profit_loss: r.profitLoss ?? r.profit ?? null,
    research_honesty_banner: r.researchHonestyBanner,
    created_at: String(r.createdAt || r.generatedAt || ''),
    updated_at: String(r.updatedAt || r.generatedAt || ''),
  }));
}

