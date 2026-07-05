-- Migration: 00000000000024_match_edge_features_setup.sql
-- Goal: Update team_form_features schema for snapshot integrity and create match_edge_features table.

-- 1. Add as_of_match_date column to team_form_features for snapshot safety
ALTER TABLE public.team_form_features ADD COLUMN IF NOT EXISTS as_of_match_date DATE;

-- Update existing records if any
UPDATE public.team_form_features SET as_of_match_date = match_date WHERE as_of_match_date IS NULL;

-- 2. Create public.match_edge_features table
CREATE TABLE IF NOT EXISTS public.match_edge_features (
  id BIGSERIAL PRIMARY KEY,
  match_id BIGINT UNIQUE NOT NULL,

  league TEXT NOT NULL,
  season TEXT NOT NULL,
  match_date DATE NOT NULL,

  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,

  -- Market odds & implied probabilities
  home_odds DOUBLE PRECISION,
  draw_odds DOUBLE PRECISION,
  away_odds DOUBLE PRECISION,
  home_implied_prob DOUBLE PRECISION,
  draw_implied_prob DOUBLE PRECISION,
  away_implied_prob DOUBLE PRECISION,

  -- Intermediate Strength features
  home_attack_strength DOUBLE PRECISION,
  away_defense_weakness DOUBLE PRECISION,
  away_attack_strength DOUBLE PRECISION,
  home_defense_weakness DOUBLE PRECISION,

  -- Model Projections
  model_home_prob DOUBLE PRECISION,
  model_draw_prob DOUBLE PRECISION,
  model_away_prob DOUBLE PRECISION,
  expected_goals_home DOUBLE PRECISION,
  expected_goals_away DOUBLE PRECISION,
  expected_total_goals DOUBLE PRECISION,

  -- Differences
  tsi_diff DOUBLE PRECISION,
  form_diff_5 DOUBLE PRECISION,
  momentum_diff DOUBLE PRECISION,

  -- Edges
  ml_edge_home DOUBLE PRECISION,
  ml_edge_away DOUBLE PRECISION,
  ah_edge_score DOUBLE PRECISION,
  ou_edge_score DOUBLE PRECISION,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS and public read access
ALTER TABLE public.match_edge_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Select match edge features" ON public.match_edge_features FOR SELECT USING (true);
