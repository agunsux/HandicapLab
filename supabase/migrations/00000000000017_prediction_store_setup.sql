-- Migration: 00000000000017_prediction_store_setup.sql
-- Goal: Create immutable append-only wh_predictions table.

CREATE TABLE IF NOT EXISTS public.wh_predictions (
  id BIGSERIAL PRIMARY KEY,
  prediction_id UUID DEFAULT gen_random_uuid() UNIQUE,
  model_version_id VARCHAR(100) NOT NULL,
  dataset_version_id VARCHAR(100) NOT NULL,
  fixture_id BIGINT NOT NULL,
  market VARCHAR(50) NOT NULL,
  selection VARCHAR(50) NOT NULL,
  predicted_probability NUMERIC(5,4) NOT NULL,
  fair_odds NUMERIC(8,2) NOT NULL,
  bookmaker_odds NUMERIC(8,2) NOT NULL,
  expected_value NUMERIC(8,4) NOT NULL,
  kelly_fraction NUMERIC(5,4) NOT NULL,
  stake_recommendation NUMERIC(10,2) NOT NULL,
  confidence_level VARCHAR(20) NOT NULL,
  prediction_timestamp TIMESTAMPTZ NOT NULL,
  latency_ms INTEGER NOT NULL,
  feature_version VARCHAR(50) NOT NULL,
  line_version VARCHAR(50) NOT NULL,
  reason_code VARCHAR(100),
  json_explanation JSONB DEFAULT '{}'::jsonb,
  prediction_hash VARCHAR(64) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Compound index to speed up historical evaluations and live backtest lookups
CREATE INDEX IF NOT EXISTS idx_predictions_fixture_model 
  ON public.wh_predictions(fixture_id, model_version_id, market);

CREATE INDEX IF NOT EXISTS idx_predictions_timestamp 
  ON public.wh_predictions(prediction_timestamp DESC);

-- Enable Row Level Security and Public SELECT Policy
ALTER TABLE public.wh_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Select Predictions" ON public.wh_predictions FOR SELECT USING (true);
