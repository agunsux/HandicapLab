export type MarginMethod = 'proportional' | 'shin' | 'additive';

export interface OddsSnapshot {
  id?: string;
  fixture_id: string;
  bookmaker_id: string;
  source_id?: string;
  market_id: string;
  selection: string;
  timestamp: string;
  
  decimal_odds: number;
  raw_probability?: number;
  
  overround?: number;
  margin_value?: number;
  normalized_probability?: number;
  implied_probability?: number;
  margin_method?: MarginMethod;
  calculation_version_id?: string;
  
  status?: 'open' | 'suspended' | 'closed';
  quality_flag?: 'NORMAL' | 'STALE' | 'OUTLIER' | 'SUSPENDED' | 'VOID' | 'INCOMPLETE' | 'DUPLICATE' | 'INVALID';
}

export interface MarketMovement {
  fixture_id: string;
  bookmaker_id: string;
  market_id: string;
  selection: string;
  
  opening_odds?: number;
  current_odds?: number;
  closing_odds?: number;
  
  movement_percentage?: number;
  price_acceleration?: number;
  steam_velocity?: number;
  odds_drift?: number;
  consensus_drift?: number;
  market_compression?: number;
  bookmaker_dispersion?: number;
  volatility_score?: number;
  favourite_flip?: boolean;
  late_sharp_move?: boolean;
  liquidity_proxy?: number;
  
  timestamp: string;
}

export interface MarketConsensus {
  fixture_id: string;
  market_id: string;
  selection: string;
  timestamp: string;
  
  best_odds: number;
  average_odds: number;
  median_odds: number;
  weighted_average_odds: number;
  consensus_probability: number;
  
  bookmaker_count: number;
  provider_count: number;
  freshness_seconds: number;
  confidence_score: number;
}
