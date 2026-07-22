-- ========================================================
-- EPIC 37 — Scientific Validation & Market Intelligence Schema
-- ========================================================
-- 1. forecast_archive (Immutable snapshot history)
-- 2. forecast_settlement (Settlements, CLV, ROI)
-- 3. calibration_metrics (ECE, MCE, Brier per version)
-- 4. confidence_metrics (Wilson & Bootstrap 95% CIs)
-- 5. similarity_index_v2 (k-NN feature space indices)

CREATE TABLE IF NOT EXISTS public.forecast_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id TEXT NOT NULL,
  model_version TEXT NOT NULL,
  feature_version TEXT NOT NULL,
  league TEXT NOT NULL,
  market TEXT NOT NULL,
  selection TEXT NOT NULL,
  probability NUMERIC(6,4) NOT NULL,
  ci_lower NUMERIC(6,4) NOT NULL,
  ci_upper NUMERIC(6,4) NOT NULL,
  ci_width NUMERIC(6,4) NOT NULL,
  model_fair_odds NUMERIC(6,3) NOT NULL,
  bookmaker_odds NUMERIC(6,3) NOT NULL,
  prob_edge NUMERIC(6,4) NOT NULL,
  expected_value NUMERIC(6,4) NOT NULL,
  kelly_fraction NUMERIC(6,4) NOT NULL,
  recommendation TEXT NOT NULL,
  confidence NUMERIC(6,4) NOT NULL,
  feature_vector_hash TEXT NOT NULL,
  prediction_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_forecast_archive_fixture ON public.forecast_archive(fixture_id);
CREATE INDEX IF NOT EXISTS idx_forecast_archive_model ON public.forecast_archive(model_version);

CREATE TABLE IF NOT EXISTS public.forecast_settlement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_id UUID UNIQUE REFERENCES public.forecast_archive(id) ON DELETE CASCADE,
  closing_odds NUMERIC(6,3) NOT NULL,
  closing_prob NUMERIC(6,4) NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('WIN', 'LOSS', 'PUSH', 'HALF_WIN', 'HALF_LOSS')),
  profit NUMERIC(8,4) NOT NULL,
  clv NUMERIC(8,4) NOT NULL,
  realized_roi NUMERIC(8,4) NOT NULL,
  drawdown_state NUMERIC(8,4) NOT NULL,
  settled_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.calibration_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version TEXT NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly', 'all_time')),
  league TEXT NOT NULL DEFAULT 'ALL',
  sample_size INT NOT NULL,
  brier_score NUMERIC(6,4) NOT NULL,
  log_loss NUMERIC(6,4) NOT NULL,
  ece NUMERIC(6,4) NOT NULL,
  mce NUMERIC(6,4) NOT NULL,
  buckets JSONB NOT NULL DEFAULT '[]'::jsonb,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.confidence_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('wilson', 'bootstrap', 'bayesian')),
  avg_ci_width NUMERIC(6,4) NOT NULL,
  ci_stability NUMERIC(6,4) NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.similarity_index_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id TEXT UNIQUE NOT NULL,
  feature_vector JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
