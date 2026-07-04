-- Phase 2: Sports Core Domain
-- Location: supabase/migrations/00000000000002_phase2_sports_core.sql

-- Leagues Cache (from Sprint 8 Programmatic SEO & Calibration)
CREATE TABLE IF NOT EXISTS public.leagues_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id INTEGER NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  country VARCHAR(100) NOT NULL,
  logo_url VARCHAR(255),
  season VARCHAR(20),
  stats_json JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  competition_type VARCHAR(50) DEFAULT 'league',
  format VARCHAR(50) DEFAULT 'round_robin',
  region VARCHAR(100),
  priority INTEGER DEFAULT 3,
  featured BOOLEAN DEFAULT FALSE,
  home_advantage NUMERIC,
  season_xg NUMERIC,
  form_weight NUMERIC,
  rotation_risk NUMERIC,
  two_leg_factor NUMERIC,
  aggregate_score NUMERIC,
  neutral_venue BOOLEAN DEFAULT FALSE,
  knockout_pressure NUMERIC,
  fatigue_factor NUMERIC,
  market_efficiency_score INTEGER CHECK (market_efficiency_score >= 0 AND market_efficiency_score <= 100),
  sample_size_score INTEGER CHECK (sample_size_score >= 0 AND sample_size_score <= 100),
  data_quality_score INTEGER CHECK (data_quality_score >= 0 AND data_quality_score <= 100),
  edge_potential_score INTEGER CHECK (edge_potential_score >= 0 AND edge_potential_score <= 100),
  model_confidence_score INTEGER CHECK (model_confidence_score >= 0 AND model_confidence_score <= 100),
  historical_accuracy INTEGER CHECK (historical_accuracy >= 0 AND historical_accuracy <= 100),
  season_status VARCHAR(50) DEFAULT 'upcoming',
  current_season VARCHAR(20),
  season_start TIMESTAMPTZ,
  season_end TIMESTAMPTZ,
  is_currently_active BOOLEAN DEFAULT FALSE,
  next_match_date TIMESTAMPTZ,
  last_match_date TIMESTAMPTZ,
  featured_calibration BOOLEAN DEFAULT FALSE,
  competition_weight NUMERIC DEFAULT 1.0,
  confidence_multiplier NUMERIC DEFAULT 1.0,
  risk_factor NUMERIC DEFAULT 1.0,
  competition_name VARCHAR(100),
  tier INTEGER,
  liquidity_score INTEGER,
  market_coverage_score INTEGER,
  active_status VARCHAR(20) DEFAULT 'active',
  quality_score INTEGER
);
CREATE INDEX IF NOT EXISTS idx_leagues_cache_slug ON public.leagues_cache(slug);
ALTER TABLE public.leagues_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leagues cache viewable by everyone" ON public.leagues_cache FOR SELECT USING (true);

-- Teams Cache
CREATE TABLE IF NOT EXISTS public.teams_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id INTEGER NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  league_id INTEGER REFERENCES public.leagues_cache(api_id) ON DELETE CASCADE,
  logo_url VARCHAR(255),
  form_json JSONB DEFAULT '[]'::jsonb,
  stats_json JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_teams_cache_slug ON public.teams_cache(slug);
ALTER TABLE public.teams_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teams cache viewable by everyone" ON public.teams_cache FOR SELECT USING (true);

-- Matches Cache
CREATE TABLE IF NOT EXISTS public.matches_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id INTEGER NOT NULL UNIQUE,
  league_id INTEGER REFERENCES public.leagues_cache(api_id) ON DELETE CASCADE,
  home_team_id INTEGER REFERENCES public.teams_cache(api_id) ON DELETE CASCADE,
  away_team_id INTEGER REFERENCES public.teams_cache(api_id) ON DELETE CASCADE,
  kickoff TIMESTAMPTZ NOT NULL,
  odds_json JSONB DEFAULT '{}'::jsonb,
  prediction_json JSONB DEFAULT '{}'::jsonb,
  edge_pct DECIMAL(5,2),
  clv DECIMAL(5,2),
  settled_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_matches_cache_kickoff ON public.matches_cache(kickoff);
ALTER TABLE public.matches_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Matches cache viewable by everyone" ON public.matches_cache FOR SELECT USING (true);

-- Competition Metrics
CREATE TABLE IF NOT EXISTS public.competition_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id INTEGER REFERENCES public.leagues_cache(api_id) ON DELETE CASCADE UNIQUE,
  matches_count INTEGER DEFAULT 0,
  prediction_accuracy NUMERIC,
  roi_simulation NUMERIC,
  closing_line_accuracy NUMERIC,
  over25_accuracy NUMERIC,
  btts_accuracy NUMERIC,
  handicap_accuracy NUMERIC,
  sample_confidence VARCHAR(50) DEFAULT 'low',
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.competition_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Competition metrics viewable by everyone" ON public.competition_metrics FOR SELECT USING (true);

-- Canonical Teams table
CREATE TABLE public.teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  league TEXT NOT NULL,
  country TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teams are viewable by everyone." ON public.teams FOR SELECT USING (true);

-- Canonical Matches (Fixtures) table
CREATE TABLE public.matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  home_team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  away_team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  home_team VARCHAR(150) NOT NULL,
  away_team VARCHAR(150) NOT NULL,
  league VARCHAR(100) NOT NULL,
  kickoff TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) DEFAULT 'upcoming',
  home_goals INTEGER,
  away_goals INTEGER,
  ht_home_goals INTEGER,
  ht_away_goals INTEGER,
  competition_type TEXT CHECK (competition_type IN ('club', 'international')),
  fifa_ranking_home INTEGER,
  fifa_ranking_away INTEGER,
  squad_strength_home INTEGER,
  squad_strength_away INTEGER,
  competition_id INTEGER,
  external_match_id VARCHAR(100),
  source VARCHAR(100) DEFAULT 'api-football',
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT home_away_different CHECK (home_team_id <> away_team_id OR (home_team_id IS NULL AND away_team_id IS NULL))
);
CREATE INDEX idx_matches_kickoff ON public.matches(kickoff);
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Matches are viewable by everyone." ON public.matches FOR SELECT USING (true);

-- Team Stats
CREATE TABLE public.team_stats (
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE PRIMARY KEY,
  home_goals_for NUMERIC NOT NULL DEFAULT 0 CHECK (home_goals_for >= 0),
  home_goals_against NUMERIC NOT NULL DEFAULT 0 CHECK (home_goals_against >= 0),
  away_goals_for NUMERIC NOT NULL DEFAULT 0 CHECK (away_goals_for >= 0),
  away_goals_against NUMERIC NOT NULL DEFAULT 0 CHECK (away_goals_against >= 0),
  last_10_form TEXT[] NOT NULL DEFAULT '{}'::text[],
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
ALTER TABLE public.team_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team stats are viewable by everyone." ON public.team_stats FOR SELECT USING (true);

-- Team Ratings
CREATE TABLE IF NOT EXISTS public.team_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id TEXT UNIQUE NOT NULL,
  team_name TEXT NOT NULL,
  league_id TEXT,
  attack_strength NUMERIC DEFAULT 1.0,
  defense_strength NUMERIC DEFAULT 1.0,
  home_advantage NUMERIC DEFAULT 1.10,
  matches_played INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_team_ratings_team_id ON public.team_ratings(team_id);
CREATE INDEX IF NOT EXISTS idx_team_ratings_league_id ON public.team_ratings(league_id);
ALTER TABLE public.team_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY team_ratings_public_read ON public.team_ratings FOR SELECT USING (true);

-- Match Results
CREATE TABLE IF NOT EXISTS public.match_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id TEXT NOT NULL UNIQUE,
  final_score JSONB NOT NULL,
  verified_source VARCHAR(100) DEFAULT 'api-football',
  verified_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.match_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Match results are viewable by everyone" ON public.match_results FOR SELECT USING (true);
