-- Migration: 00000000000018_raw_staging_setup.sql
-- Goal: Support raw staging layer tables and aliases mapping for team/league normalization.

CREATE TABLE IF NOT EXISTS public.raw_import_jobs (
  id BIGSERIAL PRIMARY KEY,
  provider VARCHAR(100) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, completed, failed
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.raw_matches (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT REFERENCES public.raw_import_jobs(id) ON DELETE CASCADE,
  league_code VARCHAR(50) NOT NULL,
  season VARCHAR(50) NOT NULL,
  match_date TIMESTAMPTZ NOT NULL,
  home_team VARCHAR(150) NOT NULL,
  away_team VARCHAR(150) NOT NULL,
  home_goals INTEGER,
  away_goals INTEGER,
  result VARCHAR(10) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.raw_odds (
  id BIGSERIAL PRIMARY KEY,
  match_id BIGINT REFERENCES public.raw_matches(id) ON DELETE CASCADE,
  bookmaker VARCHAR(100) NOT NULL,
  market VARCHAR(50) NOT NULL,
  selection VARCHAR(50) NOT NULL,
  price NUMERIC(8,2) NOT NULL,
  odds_type VARCHAR(20) DEFAULT 'closing' -- opening, closing
);

CREATE TABLE IF NOT EXISTS public.raw_statistics (
  id BIGSERIAL PRIMARY KEY,
  match_id BIGINT REFERENCES public.raw_matches(id) ON DELETE CASCADE,
  metric VARCHAR(100) NOT NULL,
  home_value NUMERIC(8,2) NOT NULL,
  away_value NUMERIC(8,2) NOT NULL
);

-- ALIASES TABLES
CREATE TABLE IF NOT EXISTS public.wh_team_aliases (
  id BIGSERIAL PRIMARY KEY,
  alias_name VARCHAR(150) UNIQUE NOT NULL,
  canonical_name VARCHAR(150) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.wh_league_aliases (
  id BIGSERIAL PRIMARY KEY,
  alias_name VARCHAR(100) UNIQUE NOT NULL,
  canonical_name VARCHAR(100) NOT NULL
);

-- Seed basic default mappings
INSERT INTO public.wh_team_aliases (alias_name, canonical_name) VALUES
  ('Man United', 'Manchester United'),
  ('Man City', 'Manchester City')
ON CONFLICT (alias_name) DO NOTHING;

INSERT INTO public.wh_league_aliases (alias_name, canonical_name) VALUES
  ('E0', 'Premier League'),
  ('England Premier League', 'Premier League')
ON CONFLICT (alias_name) DO NOTHING;

-- ENABLE RLS
ALTER TABLE public.raw_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_odds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wh_team_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wh_league_aliases ENABLE ROW LEVEL SECURITY;

-- SELECT POLICIES
CREATE POLICY "Select raw jobs" ON public.raw_import_jobs FOR SELECT USING (true);
CREATE POLICY "Select raw matches" ON public.raw_matches FOR SELECT USING (true);
CREATE POLICY "Select raw odds" ON public.raw_odds FOR SELECT USING (true);
CREATE POLICY "Select raw stats" ON public.raw_statistics FOR SELECT USING (true);
CREATE POLICY "Select team aliases" ON public.wh_team_aliases FOR SELECT USING (true);
CREATE POLICY "Select league aliases" ON public.wh_league_aliases FOR SELECT USING (true);
