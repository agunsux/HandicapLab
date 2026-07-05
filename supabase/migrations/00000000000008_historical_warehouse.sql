-- Migration 00000000000008_historical_warehouse.sql
-- Goal: Create historical data warehouse schemas, indexes, and policy permissions

-- 1. Competitions
CREATE TABLE IF NOT EXISTS public.wh_competitions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  api_id INTEGER UNIQUE,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50) DEFAULT 'league',
  country VARCHAR(100) NOT NULL,
  logo_url VARCHAR(255),
  active_status VARCHAR(20) DEFAULT 'active'
);
CREATE INDEX IF NOT EXISTS idx_wh_competitions_api_id ON public.wh_competitions(api_id);

-- 2. Seasons
CREATE TABLE IF NOT EXISTS public.wh_seasons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  competition_id UUID REFERENCES public.wh_competitions(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  start_date DATE,
  end_date DATE,
  active_status VARCHAR(20) DEFAULT 'active',
  CONSTRAINT unique_comp_season UNIQUE (competition_id, year)
);
CREATE INDEX IF NOT EXISTS idx_wh_seasons_year ON public.wh_seasons(year);

-- 3. Teams
CREATE TABLE IF NOT EXISTS public.wh_teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  api_id INTEGER UNIQUE,
  name VARCHAR(100) NOT NULL,
  country VARCHAR(100),
  logo_url VARCHAR(255)
);
CREATE INDEX IF NOT EXISTS idx_wh_teams_api_id ON public.wh_teams(api_id);

-- 4. Venues
CREATE TABLE IF NOT EXISTS public.wh_venues (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  api_id INTEGER UNIQUE,
  name VARCHAR(150) NOT NULL,
  city VARCHAR(100),
  capacity INTEGER,
  surface VARCHAR(50)
);
CREATE INDEX IF NOT EXISTS idx_wh_venues_api_id ON public.wh_venues(api_id);

-- 5. Referees
CREATE TABLE IF NOT EXISTS public.wh_referees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  api_id INTEGER UNIQUE,
  name VARCHAR(100) NOT NULL,
  country VARCHAR(100)
);
CREATE INDEX IF NOT EXISTS idx_wh_referees_api_id ON public.wh_referees(api_id);

-- 6. Fixtures
CREATE TABLE IF NOT EXISTS public.wh_fixtures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  api_id INTEGER UNIQUE,
  competition_id UUID REFERENCES public.wh_competitions(id) ON DELETE SET NULL,
  season_id UUID REFERENCES public.wh_seasons(id) ON DELETE SET NULL,
  kickoff_time TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) DEFAULT 'scheduled',
  referee_id UUID REFERENCES public.wh_referees(id) ON DELETE SET NULL,
  venue_id UUID REFERENCES public.wh_venues(id) ON DELETE SET NULL,
  home_team_id UUID REFERENCES public.wh_teams(id) ON DELETE CASCADE,
  away_team_id UUID REFERENCES public.wh_teams(id) ON DELETE CASCADE,
  home_goals INTEGER,
  away_goals INTEGER,
  ht_home_goals INTEGER,
  ht_away_goals INTEGER,
  details_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT home_away_different CHECK (home_team_id <> away_team_id)
);
CREATE INDEX IF NOT EXISTS idx_wh_fixtures_kickoff ON public.wh_fixtures(kickoff_time);
CREATE INDEX IF NOT EXISTS idx_wh_fixtures_teams ON public.wh_fixtures(home_team_id, away_team_id);
CREATE INDEX IF NOT EXISTS idx_wh_fixtures_comp_season ON public.wh_fixtures(competition_id, season_id);

-- 7. Standings History
CREATE TABLE IF NOT EXISTS public.wh_standings_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  competition_id UUID REFERENCES public.wh_competitions(id) ON DELETE CASCADE,
  season_id UUID REFERENCES public.wh_seasons(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.wh_teams(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  rank INTEGER NOT NULL,
  points INTEGER NOT NULL,
  goals_diff INTEGER NOT NULL,
  form TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_standings UNIQUE (season_id, team_id, round)
);
CREATE INDEX IF NOT EXISTS idx_wh_standings_lookup ON public.wh_standings_history(season_id, team_id, round);

-- 8. Player Appearances
CREATE TABLE IF NOT EXISTS public.wh_player_appearances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fixture_id UUID REFERENCES public.wh_fixtures(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.wh_teams(id) ON DELETE CASCADE,
  player_id VARCHAR(100) NOT NULL,
  player_name TEXT NOT NULL,
  minutes_played INTEGER,
  position VARCHAR(50),
  rating NUMERIC(4,2),
  details_json JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_wh_player_app_fixture ON public.wh_player_appearances(fixture_id);

-- 9. Player Statistics
CREATE TABLE IF NOT EXISTS public.wh_player_statistics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id VARCHAR(100) NOT NULL,
  player_name TEXT NOT NULL,
  team_id UUID REFERENCES public.wh_teams(id) ON DELETE CASCADE,
  season_id UUID REFERENCES public.wh_seasons(id) ON DELETE CASCADE,
  goals INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  yellow_cards INTEGER DEFAULT 0,
  red_cards INTEGER DEFAULT 0,
  rating NUMERIC(4,2),
  CONSTRAINT unique_player_season UNIQUE (player_id, team_id, season_id)
);
CREATE INDEX IF NOT EXISTS idx_wh_player_stats_lookup ON public.wh_player_statistics(player_id, season_id);

-- 10. Injuries
CREATE TABLE IF NOT EXISTS public.wh_injuries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID REFERENCES public.wh_teams(id) ON DELETE CASCADE,
  player_id VARCHAR(100) NOT NULL,
  player_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  type TEXT,
  status VARCHAR(50) DEFAULT 'injured'
);
CREATE INDEX IF NOT EXISTS idx_wh_injuries_lookup ON public.wh_injuries(player_id, team_id);

-- 11. Transfers
CREATE TABLE IF NOT EXISTS public.wh_transfers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id VARCHAR(100) NOT NULL,
  player_name TEXT NOT NULL,
  from_team_id UUID REFERENCES public.wh_teams(id) ON DELETE SET NULL,
  to_team_id UUID REFERENCES public.wh_teams(id) ON DELETE SET NULL,
  fee TEXT,
  transfer_date DATE
);
CREATE INDEX IF NOT EXISTS idx_wh_transfers_player ON public.wh_transfers(player_id);

-- 12. Odds Snapshots
CREATE TABLE IF NOT EXISTS public.wh_odds_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fixture_id UUID REFERENCES public.wh_fixtures(id) ON DELETE CASCADE,
  bookmaker VARCHAR(100) NOT NULL,
  market VARCHAR(50) NOT NULL,
  selection VARCHAR(50) NOT NULL,
  odds NUMERIC(6,3) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_wh_odds_snap_lookup ON public.wh_odds_snapshots(fixture_id, timestamp);

-- 13. Market Movements
CREATE TABLE IF NOT EXISTS public.wh_market_movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fixture_id UUID REFERENCES public.wh_fixtures(id) ON DELETE CASCADE,
  bookmaker VARCHAR(100) NOT NULL,
  market VARCHAR(50) NOT NULL,
  selection VARCHAR(50) NOT NULL,
  opening_odds NUMERIC(6,3) NOT NULL,
  closing_odds NUMERIC(6,3) NOT NULL,
  delta NUMERIC(6,3) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_wh_market_mov_lookup ON public.wh_market_movements(fixture_id, market);

-- 14. Team ELO History
CREATE TABLE IF NOT EXISTS public.wh_team_elo_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID REFERENCES public.wh_teams(id) ON DELETE CASCADE,
  elo NUMERIC(6,2) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_wh_team_elo_lookup ON public.wh_team_elo_history(team_id, timestamp);

-- 15. Feature Versions
CREATE TABLE IF NOT EXISTS public.wh_feature_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  version_tag VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  schema_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. Feature Store
CREATE TABLE IF NOT EXISTS public.wh_feature_store (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fixture_id UUID REFERENCES public.wh_fixtures(id) ON DELETE CASCADE,
  version_id UUID REFERENCES public.wh_feature_versions(id) ON DELETE CASCADE,
  features JSONB NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_feat_store UNIQUE (fixture_id, version_id)
);
CREATE INDEX IF NOT EXISTS idx_wh_feature_store_version ON public.wh_feature_store(version_id);

-- 17. Model Metadata
CREATE TABLE IF NOT EXISTS public.wh_model_metadata (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  version VARCHAR(50) NOT NULL,
  features_used TEXT[] DEFAULT '{}'::text[],
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 18. Sync Checkpoints
CREATE TABLE IF NOT EXISTS public.wh_sync_checkpoints (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  last_cursor VARCHAR(255),
  status VARCHAR(50) DEFAULT 'success',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_checkpoint UNIQUE (provider, entity_type)
);

-- Enable RLS and SELECT Policies
ALTER TABLE public.wh_competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wh_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wh_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wh_venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wh_referees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wh_fixtures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wh_standings_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wh_player_appearances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wh_player_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wh_injuries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wh_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wh_odds_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wh_market_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wh_team_elo_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wh_feature_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wh_feature_store ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wh_model_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wh_sync_checkpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read wh_competitions" ON public.wh_competitions FOR SELECT USING (true);
CREATE POLICY "Allow public read wh_seasons" ON public.wh_seasons FOR SELECT USING (true);
CREATE POLICY "Allow public read wh_teams" ON public.wh_teams FOR SELECT USING (true);
CREATE POLICY "Allow public read wh_venues" ON public.wh_venues FOR SELECT USING (true);
CREATE POLICY "Allow public read wh_referees" ON public.wh_referees FOR SELECT USING (true);
CREATE POLICY "Allow public read wh_fixtures" ON public.wh_fixtures FOR SELECT USING (true);
CREATE POLICY "Allow public read wh_standings_history" ON public.wh_standings_history FOR SELECT USING (true);
CREATE POLICY "Allow public read wh_player_appearances" ON public.wh_player_appearances FOR SELECT USING (true);
CREATE POLICY "Allow public read wh_player_statistics" ON public.wh_player_statistics FOR SELECT USING (true);
CREATE POLICY "Allow public read wh_injuries" ON public.wh_injuries FOR SELECT USING (true);
CREATE POLICY "Allow public read wh_transfers" ON public.wh_transfers FOR SELECT USING (true);
CREATE POLICY "Allow public read wh_odds_snapshots" ON public.wh_odds_snapshots FOR SELECT USING (true);
CREATE POLICY "Allow public read wh_market_movements" ON public.wh_market_movements FOR SELECT USING (true);
CREATE POLICY "Allow public read wh_team_elo_history" ON public.wh_team_elo_history FOR SELECT USING (true);
CREATE POLICY "Allow public read wh_feature_versions" ON public.wh_feature_versions FOR SELECT USING (true);
CREATE POLICY "Allow public read wh_feature_store" ON public.wh_feature_store FOR SELECT USING (true);
CREATE POLICY "Allow public read wh_model_metadata" ON public.wh_model_metadata FOR SELECT USING (true);
CREATE POLICY "Allow public read wh_sync_checkpoints" ON public.wh_sync_checkpoints FOR SELECT USING (true);
