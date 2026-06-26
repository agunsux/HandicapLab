-- Migration: Create cron_runs table for cron execution logging and metrics
-- Sequence number: 00000000000014

CREATE TABLE IF NOT EXISTS public.cron_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cron_name TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  records_processed INTEGER DEFAULT 0,
  errors TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.cron_runs ENABLE ROW LEVEL SECURITY;

-- Note: No SELECT or write policies are created for standard roles (anon, authenticated).
-- Therefore, only the service_role (which bypasses RLS) has access to this table.
