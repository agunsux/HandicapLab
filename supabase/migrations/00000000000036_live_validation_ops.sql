-- ========================================================
-- EPIC 35B — Production Operations & DLQ Migration
-- ========================================================
-- 1. live_validation_job_runs
-- 2. live_validation_dlq

CREATE TABLE IF NOT EXISTS public.live_validation_job_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL CHECK (job_name IN ('scheduler', 'settlement', 'metrics', 'archive')),
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed', 'skipped')),
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  duration_ms INT,
  items_discovered INT DEFAULT 0,
  items_processed INT DEFAULT 0,
  items_failed INT DEFAULT 0,
  error_message TEXT,
  correlation_id TEXT NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_job_runs_name_started ON public.live_validation_job_runs(job_name, started_at);

CREATE TABLE IF NOT EXISTS public.live_validation_dlq (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  entity_type TEXT NOT NULL, -- 'fixture', 'prediction', 'settlement'
  entity_id TEXT NOT NULL,
  error_code TEXT NOT NULL,
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  retry_count INT DEFAULT 0,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  correlation_id TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dlq_resolved ON public.live_validation_dlq(resolved);
