-- Migration: 00000000000016_ml_training_platform.sql
-- Goal: Support Training Job Registry, Model Lineage, and Champion Challenger Status tracking.

CREATE TABLE IF NOT EXISTS public.wh_ml_training_jobs (
  id BIGSERIAL PRIMARY KEY,
  job_id VARCHAR(100) NOT NULL UNIQUE,
  dataset_version VARCHAR(50) NOT NULL,
  feature_set JSONB DEFAULT '[]'::jsonb,
  algorithm VARCHAR(100) NOT NULL, -- poisson, dixon_coles, logistic_regression, lightgbm, catboost
  seed INTEGER NOT NULL,
  hyperparameters JSONB DEFAULT '{}'::jsonb,
  duration_ms INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending', -- pending, running, completed, failed
  model_tier VARCHAR(50) DEFAULT 'challenger', -- champion, candidate, shadow, retired
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.wh_model_comparisons (
  id BIGSERIAL PRIMARY KEY,
  job_id VARCHAR(100) NOT NULL REFERENCES public.wh_ml_training_jobs(job_id) ON DELETE CASCADE,
  brier_score NUMERIC(6,4) NOT NULL,
  log_loss NUMERIC(6,4) NOT NULL,
  yield_pct NUMERIC(6,2) NOT NULL,
  sharpe NUMERIC(6,2) NOT NULL,
  max_drawdown NUMERIC(6,2) NOT NULL,
  calibration_error NUMERIC(6,4) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ENABLE RLS
ALTER TABLE public.wh_ml_training_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wh_model_comparisons ENABLE ROW LEVEL SECURITY;

-- SELECT POLICIES
CREATE POLICY "Select ML Training Jobs" ON public.wh_ml_training_jobs FOR SELECT USING (true);
CREATE POLICY "Select Model Comparisons" ON public.wh_model_comparisons FOR SELECT USING (true);
