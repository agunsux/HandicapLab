export type SeasonKey = string;

export interface RawMatchRow {
  id: number;
  job_id: number | null;
  league_code: string;
  season: string;
  match_date: string;
  home_team: string;
  away_team: string;
  home_goals: number | null;
  away_goals: number | null;
  result: string | null;
  league: string | null;
  full_time_home_goals: number | null;
  full_time_away_goals: number | null;
  home_odds: number | null;
  draw_odds: number | null;
  away_odds: number | null;
  over25_odds: number | null;
  under25_odds: number | null;
  source_file: string | null;
  ingested_at: string | null;
}

export interface NormalizedMatch {
  canonical_id: string;
  provider: string;
  provider_record_id: number;
  league: string;
  season: SeasonKey;
  match_date: string;
  home_team: string;
  away_team: string;
  home_goals: number;
  away_goals: number;
  result: 'H' | 'D' | 'A';
  result_verified: boolean;
  source_file: string | null;
  source_type: 'HISTORICAL' | 'MOCK' | 'JUNK';
  exclusion_reason?: string;
}

export interface HistoricalOdds {
  match_id: string;
  league: string;
  season: SeasonKey;
  match_date: string;
  bookmaker: string;
  odds_type: 'closing_reference';
  market_1x2: { home: number; draw: number; away: number } | null;
  market_ou25: { over: number; under: number } | null;
  source: string;
}

export type FeaturePresence = 'REAL' | 'MISSING';

export interface TeamFeatures {
  team: string;
  has_history: boolean;
  last5_goals_for: number[];
  last5_goals_against: number[];
  last5_points: number[];
  form_points_last5: number | null;
  avg_goals_for: number | null;
  avg_goals_against: number | null;
  home_avg_goals_for: number | null;
  home_avg_goals_against: number | null;
  away_avg_goals_for: number | null;
  away_avg_goals_against: number | null;
  home_win_rate: number | null;
  away_win_rate: number | null;
  elo: number | null;
  elo_games: number;
  rest_days: number | null;
}

export interface H2hFeatures {
  has_history: boolean;
  meetings_count: number;
  home_win_rate: number | null;
}

export interface FeatureSnapshot {
  match_id: string;
  league: string;
  season: SeasonKey;
  match_date: string;
  prediction_timestamp: string;
  feature_version: string;
  home: TeamFeatures;
  away: TeamFeatures;
  h2h: H2hFeatures;
  league_avg_goals: number | null;
  league_has_history: boolean;
  feature_presence: Record<string, FeaturePresence>;
  computation: { method: string; boundary: 'match_date'; source: 'raw_matches' };
}

export interface LeakageAuditEntry {
  match_id: string;
  match_date: string;
  min_source_date: string | null;
  leak_free: boolean;
  violation?: string;
}

export interface GoldSummary {
  raw_rows_read: number;
  normalized_matches: number;
  excluded: { reason: string; count: number }[];
  duplicates_found: number;
  result_mismatches: number;
  matches_with_odds_1x2: number;
  matches_with_odds_ou25: number;
  features_generated: number;
  leak_free: boolean;
  leakage_violations: number;
  season_breakdown: Record<string, number>;
}
