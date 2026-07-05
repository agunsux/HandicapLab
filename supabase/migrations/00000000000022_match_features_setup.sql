-- Migration: 00000000000022_match_features_setup.sql
-- Goal: Create public.match_features table to store transformed odds and stats features.

CREATE TABLE IF NOT EXISTS public.match_features (
  id BIGSERIAL PRIMARY KEY,
  match_id BIGINT,

  league TEXT,
  season TEXT,
  match_date DATE,

  home_team TEXT,
  away_team TEXT,

  home_odds DOUBLE PRECISION,
  draw_odds DOUBLE PRECISION,
  away_odds DOUBLE PRECISION,

  over25_odds DOUBLE PRECISION,
  under25_odds DOUBLE PRECISION,

  home_implied_prob DOUBLE PRECISION,
  draw_implied_prob DOUBLE PRECISION,
  away_implied_prob DOUBLE PRECISION,

  market_overround DOUBLE PRECISION,

  goal_total INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS and public read access
ALTER TABLE public.match_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Select match features" ON public.match_features FOR SELECT USING (true);
