-- Migration: 00000000000023_team_features_setup.sql
-- Goal: Create public.team_form_features table to store rolling form stats and team strength indices.

CREATE TABLE IF NOT EXISTS public.team_form_features (
  id BIGSERIAL PRIMARY KEY,
  match_id BIGINT,

  team_name TEXT NOT NULL,
  league TEXT NOT NULL,
  season TEXT NOT NULL,
  match_date DATE NOT NULL,
  is_home BOOLEAN NOT NULL,

  rolling_5_form_points DOUBLE PRECISION,
  rolling_10_form_points DOUBLE PRECISION,
  rolling_15_form_points DOUBLE PRECISION,

  goals_scored_avg DOUBLE PRECISION,
  goals_conceded_avg DOUBLE PRECISION,
  win_rate DOUBLE PRECISION,
  tsi DOUBLE PRECISION,
  momentum_score DOUBLE PRECISION,
  opponent_adjusted_tsi DOUBLE PRECISION,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing for fast chronological queries
CREATE INDEX IF NOT EXISTS idx_team_form_lookup ON public.team_form_features(team_name, match_date);

-- Enable RLS and public read access
ALTER TABLE public.team_form_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Select team features" ON public.team_form_features FOR SELECT USING (true);
