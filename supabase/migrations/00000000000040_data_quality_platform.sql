-- ========================================================
-- EPIC 39 — Data Quality & Integrity Platform Schema
-- ========================================================
-- 1. data_quality_scores (0-100 score, completeness, coverage, integrity)
-- 2. feature_drift_events (Feature distribution baseline vs today drift alerts)
-- 3. data_lineage_logs (End-to-end trace steps from raw feed to settlement)
-- 4. experiment_registry (Auditable research experiment log)

CREATE TABLE IF NOT EXISTS public.data_quality_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id TEXT NOT NULL,
  quality_score NUMERIC(5,2) NOT NULL,
  completeness_pct NUMERIC(6,2) NOT NULL,
  odds_coverage_pct NUMERIC(6,2) NOT NULL,
  missing_xg_pct NUMERIC(6,2) NOT NULL,
  duplicate_count INT NOT NULL DEFAULT 0,
  integrity_status TEXT NOT NULL CHECK (integrity_status IN ('PASS', 'FAIL')),
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.feature_drift_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_name TEXT NOT NULL,
  historical_mean NUMERIC(8,4) NOT NULL,
  current_mean NUMERIC(8,4) NOT NULL,
  drift_pct NUMERIC(6,2) NOT NULL,
  alert_level TEXT NOT NULL CHECK (alert_level IN ('NORMAL', 'WARNING', 'CRITICAL')),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.data_lineage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id TEXT NOT NULL,
  step_name TEXT NOT NULL,
  source_dataset TEXT NOT NULL,
  output_checksum TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'WARNING', 'FAILED')),
  processed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.experiment_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id TEXT UNIQUE NOT NULL,
  model_type TEXT NOT NULL,
  features_tested JSONB NOT NULL DEFAULT '[]'::jsonb,
  roi_delta_pct NUMERIC(6,2) NOT NULL,
  clv_delta_pct NUMERIC(6,2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ACCEPTED', 'REJECTED', 'PENDING')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
