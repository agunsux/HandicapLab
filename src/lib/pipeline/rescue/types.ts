// ============================================================================
// SALMO RESCUE PIPELINE TYPES
// Namespace: src/lib/pipeline/rescue/types.ts
// Model Version: poisson_v1_rescue
// ============================================================================

export type RescueMarketType = 'AH' | 'OU' | 'BTTS';
export type RescueLineType = 'FULL' | 'HALF' | 'QUARTER';

export type RescueMarketStatus =
  | 'AVAILABLE'
  | 'RESEARCH_ONLY'
  | 'QUOTA_CRITICAL'
  | 'NO_MARKET_ODDS'
  | 'INSUFFICIENT_SAMPLE'
  | 'DATA_UNAVAILABLE';

export interface RescueOddsSnapshot {
  snapshot_id: string;
  fixture_id: number;
  bookmaker: 'pinnacle' | 'sbobet' | string;
  market: RescueMarketType;
  line: number | null;
  odds: number;
  timestamp: string;
  source: 'oddspapi';
}

export interface RescuePredictionRecord {
  id: string; // MD5(fixture_id + market + line + selection + model_version + run_id)
  run_id: string;
  model_version: 'poisson_v1_rescue';
  fixture_id: number;
  match: string;
  home_team: string;
  away_team: string;
  competition: string;
  competition_id: number;
  kickoff_utc: string;
  market: RescueMarketType;
  line: number | null;
  line_type?: RescueLineType;
  selection: string;
  model_probability: number;
  calibrated_probability: number;
  fair_odds: number;
  market_odds: number | null;
  market_status: RescueMarketStatus;
  edge_pct: number | null;
  expected_value: number | null;
  confidence_tier: 'HIGH' | 'MEDIUM' | 'LOW' | 'PASS';
  confidence_score: number;
  is_pick: boolean;
  odds_snapshot: RescueOddsSnapshot | null;
  settlement: {
    status: 'PENDING' | 'WON' | 'HALF_WON' | 'PUSH' | 'HALF_LOSS' | 'LOSS' | 'VOID' | 'CANCELLED';
    final_home_score?: number;
    final_away_score?: number;
    settled_at?: string;
    pnl_units?: number;
  } | null;
  data_quality_flags?: string[];
  created_at: string;
}

export interface RescueRunTelemetry {
  run_id: string;
  model_version: 'poisson_v1_rescue';
  status: 'SUCCESS' | 'SUCCESS_EMPTY' | 'FAILED';
  fixture_count: number;
  prediction_count: number;
  odds_count: number;
  settled_count: number;
  picks_generated: number;
  error_count: number;
  duration_ms: number;
  quota_remaining: number;
  data_sources: {
    fixtures: 'api-football';
    odds: 'oddspapi';
  };
  data_quality_flags: string[];
  executed_at: string;
}

export interface WhitelistLeague {
  id: number;
  name: string;
  country: string;
  min_sample_size: number;
}
