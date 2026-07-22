-- ========================================================
-- EPIC 36 — Value Betting Intelligence Platform Schema
-- ========================================================
-- 1. value_recommendations
-- 2. league_intelligence
-- 3. odds_movement_events
-- 4. historical_cohort_cache

CREATE TABLE IF NOT EXISTS public.value_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id TEXT NOT NULL,
  league TEXT NOT NULL,
  season TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  kickoff TIMESTAMPTZ NOT NULL,
  
  market TEXT NOT NULL CHECK (market IN ('moneyline', 'asian_handicap', 'over_under')),
  selection TEXT NOT NULL CHECK (selection IN ('home', 'draw', 'away', 'over', 'under')),
  line NUMERIC(5,2) NOT NULL DEFAULT 0.0,
  
  model_prob NUMERIC(6,4) NOT NULL,
  market_prob NUMERIC(6,4) NOT NULL,
  prob_edge NUMERIC(6,4) NOT NULL,
  
  model_fair_odds NUMERIC(6,3) NOT NULL,
  bookmaker_odds NUMERIC(6,3) NOT NULL,
  expected_value NUMERIC(6,4) NOT NULL,
  clv_projection NUMERIC(6,4),
  
  category TEXT NOT NULL CHECK (category IN ('STRONG_VALUE', 'VALUE', 'WATCHLIST', 'NO_VALUE', 'PASS')),
  confidence NUMERIC(6,4) NOT NULL,
  confidence_bucket TEXT NOT NULL CHECK (confidence_bucket IN ('HIGH', 'MEDIUM', 'LOW')),
  
  -- Historical Evidence Link
  historical_similar_bets INT DEFAULT 0,
  historical_roi NUMERIC(8,4),
  historical_hit_rate NUMERIC(6,4),
  historical_clv NUMERIC(8,4),
  
  -- Explainability Payload (JSONB)
  explanation JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  schema_version TEXT NOT NULL DEFAULT '1.0'
);

CREATE INDEX IF NOT EXISTS idx_value_recs_category ON public.value_recommendations(category);
CREATE INDEX IF NOT EXISTS idx_value_recs_kickoff ON public.value_recommendations(kickoff);

CREATE TABLE IF NOT EXISTS public.league_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league TEXT UNIQUE NOT NULL,
  total_matches INT NOT NULL DEFAULT 0,
  overround NUMERIC(6,4) NOT NULL DEFAULT 0.05,
  market_efficiency_score NUMERIC(6,4) NOT NULL DEFAULT 0.85,
  historical_roi NUMERIC(8,4) NOT NULL DEFAULT 0.0,
  historical_clv NUMERIC(8,4) NOT NULL DEFAULT 0.0,
  brier_score NUMERIC(6,4),
  ece NUMERIC(6,4),
  rank INT NOT NULL DEFAULT 99,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.odds_movement_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id TEXT NOT NULL,
  market TEXT NOT NULL,
  opening_odds NUMERIC(6,3),
  prediction_odds NUMERIC(6,3),
  current_odds NUMERIC(6,3),
  closing_odds NUMERIC(6,3),
  movement_type TEXT CHECK (movement_type IN ('steam', 'reverse_line', 'neutral')),
  clv NUMERIC(8,4),
  captured_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.historical_cohort_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_key TEXT UNIQUE NOT NULL,
  sample_size INT NOT NULL,
  avg_roi NUMERIC(8,4) NOT NULL,
  hit_rate NUMERIC(6,4) NOT NULL,
  avg_clv NUMERIC(8,4) NOT NULL,
  max_drawdown NUMERIC(8,4) NOT NULL,
  ece NUMERIC(6,4) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
