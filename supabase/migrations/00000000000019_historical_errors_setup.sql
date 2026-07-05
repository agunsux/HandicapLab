-- Migration: 00000000000019_historical_errors_setup.sql
-- Goal: Create raw_import_errors table to log rows failures during bulk ingestion runs.

CREATE TABLE IF NOT EXISTS public.raw_import_errors (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT REFERENCES public.raw_import_jobs(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  row_number INTEGER NOT NULL,
  column_name VARCHAR(100),
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS and public read policy
ALTER TABLE public.raw_import_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Select raw errors" ON public.raw_import_errors FOR SELECT USING (true);
