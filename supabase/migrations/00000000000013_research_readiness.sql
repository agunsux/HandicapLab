-- Migration: 00000000000013_research_readiness.sql
-- Goal: Support dataset freezing, profiling registry, drift detection audit, and pipeline observability log targets.

CREATE TABLE IF NOT EXISTS public.wh_dataset_registry (
  id BIGSERIAL PRIMARY KEY,
  dataset_id VARCHAR(100) NOT NULL,
  version VARCHAR(50) NOT NULL,
  dataset_type VARCHAR(50) DEFAULT 'silver', -- silver, benchmark, feature
  created_at TIMESTAMPTZ DEFAULT NOW(),
  source_provenance VARCHAR(100) NOT NULL,
  coverage_pct NUMERIC(5,2) NOT NULL,
  checksum VARCHAR(64) NOT NULL,
  partition_list JSONB DEFAULT '[]'::jsonb,
  schema_version VARCHAR(50) NOT NULL,
  is_frozen BOOLEAN DEFAULT false,
  is_benchmark BOOLEAN DEFAULT false,
  CONSTRAINT unique_registry_dataset UNIQUE (dataset_id, version)
);

CREATE TABLE IF NOT EXISTS public.wh_dataset_profiles (
  id BIGSERIAL PRIMARY KEY,
  registry_id BIGINT REFERENCES public.wh_dataset_registry(id) ON DELETE CASCADE,
  row_count BIGINT NOT NULL,
  null_pct NUMERIC(5,2) NOT NULL,
  duplicate_pct NUMERIC(5,2) NOT NULL,
  missing_fixtures_count INTEGER DEFAULT 0,
  outliers_count INTEGER DEFAULT 0,
  metrics_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.wh_dataset_drift (
  id BIGSERIAL PRIMARY KEY,
  dataset_id VARCHAR(100) NOT NULL,
  source_version VARCHAR(50) NOT NULL,
  target_version VARCHAR(50) NOT NULL,
  schema_drift_detected BOOLEAN DEFAULT false,
  distribution_drift_detected BOOLEAN DEFAULT false,
  coverage_drift_pct NUMERIC(5,2) NOT NULL,
  drift_details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.wh_pipeline_observability (
  id BIGSERIAL PRIMARY KEY,
  pipeline_name VARCHAR(100) NOT NULL,
  execution_time_ms BIGINT NOT NULL,
  rows_per_second NUMERIC(10,2) NOT NULL,
  memory_used_bytes BIGINT NOT NULL,
  cpu_usage_pct NUMERIC(5,2) NOT NULL,
  retries_count INTEGER DEFAULT 0,
  failures_count INTEGER DEFAULT 0,
  warnings_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ENABLE RLS
ALTER TABLE public.wh_dataset_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wh_dataset_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wh_dataset_drift ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wh_pipeline_observability ENABLE ROW LEVEL SECURITY;

-- SELECT POLICIES
CREATE POLICY "Select Dataset Registry" ON public.wh_dataset_registry FOR SELECT USING (true);
CREATE POLICY "Select Dataset Profiles" ON public.wh_dataset_profiles FOR SELECT USING (true);
CREATE POLICY "Select Dataset Drift" ON public.wh_dataset_drift FOR SELECT USING (true);
CREATE POLICY "Select Pipeline Observability" ON public.wh_pipeline_observability FOR SELECT USING (true);
