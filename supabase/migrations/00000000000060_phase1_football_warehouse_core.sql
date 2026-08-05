-- ============================================================================
-- MIGRATION: 00000000000060_phase1_football_warehouse_core.sql
-- PURPOSE: Phase 1 Core Football Data Warehouse (Raw Archive, Bronze, Silver Core,
--          Canonical Entity Resolution & Aliases, Provider/Competition Registries,
--          Time Dimensions, Flexible Market Dimensions, & Data Quality Reports)
-- ============================================================================

-- 1. Layer 0 & Pipeline Control Tables
CREATE TABLE IF NOT EXISTS raw_archive_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(64) NOT NULL,
  provider_version VARCHAR(32) NOT NULL DEFAULT 'v1.0',
  file_path TEXT NOT NULL,
  file_format VARCHAR(16) NOT NULL, -- 'csv', 'json', 'parquet'
  byte_size BIGINT NOT NULL,
  checksum VARCHAR(64) NOT NULL,
  season VARCHAR(16) NOT NULL,
  competition_code VARCHAR(32) NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  etl_version VARCHAR(32) NOT NULL DEFAULT '1.0.0'
);

CREATE TABLE IF NOT EXISTS provider_registry (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  provider_type VARCHAR(32) NOT NULL, -- 'fixtures', 'xg', 'odds', 'ratings'
  base_url TEXT,
  rate_limit_per_min INT DEFAULT 60,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ingestion_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(64) NOT NULL REFERENCES provider_registry(id),
  provider_version VARCHAR(32) NOT NULL DEFAULT 'v1.0',
  stage VARCHAR(32) NOT NULL, -- 'raw', 'bronze', 'silver', 'gold'
  season VARCHAR(16) NOT NULL,
  competition_code VARCHAR(32) NOT NULL,
  rows_ingested INT DEFAULT 0,
  status VARCHAR(32) NOT NULL, -- 'SUCCESS', 'FAILED', 'PARTIAL'
  error_message TEXT,
  checksum VARCHAR(64) NOT NULL,
  source_url TEXT,
  etl_version VARCHAR(32) NOT NULL DEFAULT '1.0.0',
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Time & Competition Dimensions
CREATE TABLE IF NOT EXISTS dim_date (
  date_id DATE PRIMARY KEY,
  year INT NOT NULL,
  quarter INT NOT NULL,
  month INT NOT NULL,
  month_name VARCHAR(16) NOT NULL,
  week_of_year INT NOT NULL,
  day_of_month INT NOT NULL,
  day_of_week INT NOT NULL,
  day_name VARCHAR(16) NOT NULL,
  is_weekend BOOLEAN NOT NULL
);

CREATE TABLE IF NOT EXISTS dim_time (
  time_id TIME PRIMARY KEY,
  hour INT NOT NULL,
  minute INT NOT NULL,
  time_slot VARCHAR(16) NOT NULL -- 'Morning', 'Afternoon', 'Evening', 'Night'
);

CREATE TABLE IF NOT EXISTS dim_season (
  season_code VARCHAR(16) PRIMARY KEY, -- e.g. '2024-2025'
  start_year INT NOT NULL,
  end_year INT NOT NULL,
  is_current BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS competition_registry (
  competition_code VARCHAR(32) PRIMARY KEY, -- e.g. 'EPL', 'LA_LIGA'
  name VARCHAR(128) NOT NULL,
  country VARCHAR(64) NOT NULL,
  confederation VARCHAR(32) NOT NULL DEFAULT 'UEFA',
  tier_level INT NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  has_xg BOOLEAN DEFAULT TRUE,
  has_odds BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Canonical Entities
CREATE TABLE IF NOT EXISTS countries (
  code VARCHAR(8) PRIMARY KEY,
  name VARCHAR(64) NOT NULL,
  confederation VARCHAR(32)
);

CREATE TABLE IF NOT EXISTS competitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(32) UNIQUE NOT NULL REFERENCES competition_registry(competition_code),
  name VARCHAR(128) NOT NULL,
  country_code VARCHAR(8) REFERENCES countries(code),
  type VARCHAR(32) DEFAULT 'league'
);

CREATE TABLE IF NOT EXISTS venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(128) NOT NULL,
  city VARCHAR(64),
  capacity INT,
  surface VARCHAR(32) DEFAULT 'grass'
);

CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name VARCHAR(128) UNIQUE NOT NULL,
  short_name VARCHAR(64),
  country_code VARCHAR(8) REFERENCES countries(code),
  primary_competition_code VARCHAR(32) REFERENCES competition_registry(competition_code),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name VARCHAR(128) NOT NULL,
  position VARCHAR(16),
  nationality VARCHAR(64),
  date_of_birth DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name VARCHAR(128) NOT NULL,
  nationality VARCHAR(64)
);

CREATE TABLE IF NOT EXISTS referees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name VARCHAR(128) NOT NULL,
  country_code VARCHAR(8) REFERENCES countries(code)
);

-- 4. Entity Resolution & Alias Mappings (Anti-Hardcode Dictionary)
CREATE TABLE IF NOT EXISTS team_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  provider_id VARCHAR(64) NOT NULL REFERENCES provider_registry(id),
  provider_team_name VARCHAR(128) NOT NULL,
  confidence NUMERIC(3, 2) DEFAULT 1.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider_id, provider_team_name)
);

CREATE TABLE IF NOT EXISTS player_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  provider_id VARCHAR(64) NOT NULL REFERENCES provider_registry(id),
  provider_player_name VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider_id, provider_player_name)
);

CREATE TABLE IF NOT EXISTS coach_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  provider_id VARCHAR(64) NOT NULL REFERENCES provider_registry(id),
  provider_coach_name VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider_id, provider_coach_name)
);

CREATE TABLE IF NOT EXISTS stadium_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  provider_id VARCHAR(64) NOT NULL REFERENCES provider_registry(id),
  provider_venue_name VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider_id, provider_venue_name)
);

CREATE TABLE IF NOT EXISTS competition_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_code VARCHAR(32) NOT NULL REFERENCES competition_registry(competition_code),
  provider_id VARCHAR(64) NOT NULL REFERENCES provider_registry(id),
  provider_competition_name VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider_id, provider_competition_name)
);

-- 5. Silver Core Match & Event Tables
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  natural_key VARCHAR(128) UNIQUE NOT NULL, -- e.g. EPL|2024-2025|HOME|AWAY|DATE
  competition_code VARCHAR(32) NOT NULL REFERENCES competition_registry(competition_code),
  season_code VARCHAR(16) NOT NULL REFERENCES dim_season(season_code),
  date_id DATE REFERENCES dim_date(date_id),
  kickoff TIMESTAMPTZ NOT NULL,
  home_team_id UUID NOT NULL REFERENCES teams(id),
  away_team_id UUID NOT NULL REFERENCES teams(id),
  venue_id UUID REFERENCES venues(id),
  referee_id UUID REFERENCES referees(id),
  status VARCHAR(32) NOT NULL DEFAULT 'FINISHED',
  home_score INT,
  away_score INT,
  ht_home_score INT,
  ht_away_score INT,
  -- Provenance Metadata Standard
  provider VARCHAR(64) NOT NULL,
  provider_version VARCHAR(32) NOT NULL DEFAULT 'v1.0',
  provider_match_id VARCHAR(128),
  source_url TEXT,
  checksum VARCHAR(64) NOT NULL,
  etl_version VARCHAR(32) NOT NULL DEFAULT '1.0.0',
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_verified TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  license VARCHAR(64) DEFAULT 'Open'
);

CREATE TABLE IF NOT EXISTS match_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  minute INT NOT NULL,
  team_id UUID NOT NULL REFERENCES teams(id),
  player_id UUID REFERENCES players(id),
  event_type VARCHAR(32) NOT NULL, -- 'GOAL', 'YELLOW_CARD', 'RED_CARD', 'SUBSTITUTION', 'VAR'
  detail TEXT
);

CREATE TABLE IF NOT EXISTS team_match_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id),
  is_home BOOLEAN NOT NULL,
  shots INT,
  shots_on_target INT,
  possession NUMERIC(5, 2),
  corners INT,
  fouls INT,
  yellow_cards INT,
  red_cards INT,
  xg NUMERIC(5, 2),
  xga NUMERIC(5, 2),
  ppda NUMERIC(5, 2),
  -- Provenance
  provider VARCHAR(64) NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(match_id, team_id)
);

CREATE TABLE IF NOT EXISTS player_match_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id),
  team_id UUID NOT NULL REFERENCES teams(id),
  minutes_played INT NOT NULL,
  goals INT DEFAULT 0,
  assists INT DEFAULT 0,
  shots INT DEFAULT 0,
  key_passes INT DEFAULT 0,
  xg NUMERIC(5, 2),
  xa NUMERIC(5, 2),
  rating NUMERIC(4, 2)
);

CREATE TABLE IF NOT EXISTS shots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id),
  player_id UUID REFERENCES players(id),
  minute INT NOT NULL,
  x_coord NUMERIC(5, 2),
  y_coord NUMERIC(5, 2),
  shot_type VARCHAR(32), -- 'right_foot', 'left_foot', 'head'
  situation VARCHAR(32), -- 'open_play', 'set_piece', 'penalty'
  result VARCHAR(32), -- 'goal', 'saved', 'missed', 'blocked'
  xg NUMERIC(5, 3)
);

-- 6. Flexible Betting Market Dimension
CREATE TABLE IF NOT EXISTS market_dimension (
  market_id VARCHAR(32) PRIMARY KEY, -- 'asian_handicap', 'over_under', 'moneyline', 'btts', 'dnb', 'double_chance'
  name VARCHAR(64) NOT NULL,
  category VARCHAR(32) NOT NULL -- 'handicap', 'totals', '1x2', 'prop'
);

CREATE TABLE IF NOT EXISTS odds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  bookmaker VARCHAR(64) NOT NULL,
  market_id VARCHAR(32) NOT NULL REFERENCES market_dimension(market_id),
  selection VARCHAR(64) NOT NULL,
  line NUMERIC(5, 2),
  price NUMERIC(6, 3) NOT NULL,
  opening_price NUMERIC(6, 3),
  closing_price NUMERIC(6, 3),
  is_pinnacle BOOLEAN DEFAULT FALSE,
  -- Provenance
  provider VARCHAR(64) NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS odds_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  bookmaker VARCHAR(64) NOT NULL,
  market_id VARCHAR(32) NOT NULL REFERENCES market_dimension(market_id),
  selection VARCHAR(64) NOT NULL,
  price NUMERIC(6, 3) NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL
);

-- 7. Ratings & Analytics Models
CREATE TABLE IF NOT EXISTS club_elo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id),
  date_id DATE NOT NULL REFERENCES dim_date(date_id),
  elo_rating NUMERIC(7, 2) NOT NULL,
  elo_delta NUMERIC(6, 2),
  provider VARCHAR(64) DEFAULT 'club_elo',
  UNIQUE(team_id, date_id)
);

CREATE TABLE IF NOT EXISTS understat_team (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id),
  season_code VARCHAR(16) NOT NULL REFERENCES dim_season(season_code),
  matches_played INT NOT NULL,
  wins INT NOT NULL,
  draws INT NOT NULL,
  losses INT NOT NULL,
  goals_for INT NOT NULL,
  goals_against INT NOT NULL,
  points INT NOT NULL,
  xg NUMERIC(6, 2) NOT NULL,
  xga NUMERIC(6, 2) NOT NULL,
  xpts NUMERIC(6, 2) NOT NULL,
  UNIQUE(team_id, season_code)
);

-- 8. Data Quality & Observability
CREATE TABLE IF NOT EXISTS quality_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(64) NOT NULL REFERENCES provider_registry(id),
  season VARCHAR(16) NOT NULL,
  competition_code VARCHAR(32) NOT NULL REFERENCES competition_registry(competition_code),
  total_fixtures INT NOT NULL,
  expected_fixtures INT NOT NULL,
  coverage_pct NUMERIC(5, 2) NOT NULL,
  duplicate_pct NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  null_pct NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  schema_drift_flag BOOLEAN DEFAULT FALSE,
  provider_health_score NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
  freshness_lag_seconds INT DEFAULT 0,
  failed_rows_count INT DEFAULT 0,
  warnings_json JSONB DEFAULT '[]'::jsonb,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed Default Provider Registry Entries
INSERT INTO provider_registry (id, name, provider_type, base_url) VALUES
  ('football_data', 'Football-Data.co.uk', 'fixtures', 'https://www.football-data.co.uk'),
  ('understat', 'Understat', 'xg', 'https://understat.com'),
  ('club_elo', 'ClubElo', 'ratings', 'http://api.clubelo.com'),
  ('api_football', 'API-Football', 'fixtures', 'https://v3.football.api-sports.io'),
  ('oddspapi', 'OddsPAPI', 'odds', 'https://api.oddspapi.com/v1'),
  ('fbref', 'FBref', 'stats', 'https://fbref.com'),
  ('open_football', 'OpenFootball', 'fixtures', 'https://github.com/openfootball'),
  ('transfermarkt', 'Transfermarkt', 'market_value', 'https://www.transfermarkt.com')
ON CONFLICT (id) DO NOTHING;

-- Seed Default Market Dimensions
INSERT INTO market_dimension (market_id, name, category) VALUES
  ('asian_handicap', 'Asian Handicap', 'handicap'),
  ('over_under', 'Over / Under', 'totals'),
  ('moneyline', '1X2 Moneyline', '1x2'),
  ('btts', 'Both Teams to Score', 'prop'),
  ('dnb', 'Draw No Bet', 'handicap'),
  ('double_chance', 'Double Chance', 'prop')
ON CONFLICT (market_id) DO NOTHING;

-- Seed Default Competitions Registry
INSERT INTO competition_registry (competition_code, name, country, confederation, tier_level) VALUES
  ('EPL', 'Premier League', 'England', 'UEFA', 1),
  ('LA_LIGA', 'La Liga', 'Spain', 'UEFA', 1),
  ('SERIE_A', 'Serie A', 'Italy', 'UEFA', 1),
  ('BUNDESLIGA', 'Bundesliga', 'Germany', 'UEFA', 1),
  ('LIGUE_1', 'Ligue 1', 'France', 'UEFA', 1),
  ('EREDIVISIE', 'Eredivisie', 'Netherlands', 'UEFA', 1),
  ('PRIMEIRA_LIGA', 'Primeira Liga', 'Portugal', 'UEFA', 1),
  ('CHAMPIONSHIP', 'EFL Championship', 'England', 'UEFA', 1),
  ('MLS', 'Major League Soccer', 'USA', 'CONCACAF', 1),
  ('BRAZIL_SERIE_A', 'Serie A', 'Brazil', 'CONMEBOL', 1),
  ('ARGENTINA_LFP', 'Liga Profesional', 'Argentina', 'CONMEBOL', 1),
  ('J1_LEAGUE', 'J1 League', 'Japan', 'AFC', 1),
  ('K_LEAGUE_1', 'K League 1', 'South Korea', 'AFC', 1),
  ('LIGA_1_IDN', 'Liga 1 Indonesia', 'Indonesia', 'AFC', 1)
ON CONFLICT (competition_code) DO NOTHING;
