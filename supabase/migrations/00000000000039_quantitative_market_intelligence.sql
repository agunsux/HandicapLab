-- ========================================================
-- EPIC 38 — Quantitative Market Intelligence Schema
-- ========================================================
-- 1. market_quality_logs (Market Quality Score 0-100)
-- 2. ev_decay_snapshots (EV curve trajectory & steam/RLM)
-- 3. meta_value_scores (Composite 0-100 Meta Score)
-- 4. portfolio_risk_states (Kelly allocation, bet correlation, risk budget)

CREATE TABLE IF NOT EXISTS public.market_quality_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id TEXT NOT NULL,
  market TEXT NOT NULL,
  market_quality_score NUMERIC(5,2) NOT NULL,
  overround NUMERIC(6,4) NOT NULL,
  volatility NUMERIC(6,4) NOT NULL,
  books_count INT NOT NULL DEFAULT 1,
  consensus_deviation NUMERIC(6,4) NOT NULL,
  league_efficiency NUMERIC(6,4) NOT NULL,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.ev_decay_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id TEXT NOT NULL,
  market TEXT NOT NULL,
  opening_ev NUMERIC(6,4) NOT NULL,
  current_ev NUMERIC(6,4) NOT NULL,
  optimal_betting_window TEXT NOT NULL,
  steam_alert BOOLEAN NOT NULL DEFAULT false,
  rlm_alert BOOLEAN NOT NULL DEFAULT false,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.meta_value_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id TEXT NOT NULL,
  market TEXT NOT NULL,
  selection TEXT NOT NULL,
  meta_value_score NUMERIC(5,2) NOT NULL,
  ev_component NUMERIC(5,2) NOT NULL,
  edge_component NUMERIC(5,2) NOT NULL,
  calibration_component NUMERIC(5,2) NOT NULL,
  similarity_component NUMERIC(5,2) NOT NULL,
  market_quality_component NUMERIC(5,2) NOT NULL,
  league_trust_component NUMERIC(5,2) NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.portfolio_risk_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bankroll_units NUMERIC(10,2) NOT NULL,
  daily_risk_budget NUMERIC(6,4) NOT NULL,
  max_single_league_exposure NUMERIC(6,4) NOT NULL,
  total_recommended_stake NUMERIC(8,4) NOT NULL,
  variance_forecast NUMERIC(6,4) NOT NULL,
  risk_heatmap JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
