-- Migration 00000000000010_sync_checkpoints_upgrade.sql
-- Goal: Upgrade sync checkpoints schema to support millions of fine-grained checkpoint records

DROP TABLE IF EXISTS public.wh_sync_checkpoints CASCADE;

CREATE TABLE public.wh_sync_checkpoints (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider VARCHAR(100) NOT NULL,
  league VARCHAR(100) NOT NULL,
  season INTEGER NOT NULL,
  endpoint VARCHAR(100) NOT NULL,
  
  -- Progress Parameters
  page INTEGER DEFAULT 1,
  last_cursor VARCHAR(255),
  
  -- Counters
  rows_imported INTEGER DEFAULT 0,
  rows_skipped INTEGER DEFAULT 0,
  rows_failed INTEGER DEFAULT 0,
  
  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  -- State
  status VARCHAR(50) DEFAULT 'pending', -- pending, running, paused, completed, failed, cancelled
  retry_count INTEGER DEFAULT 0,
  last_error TEXT,
  
  CONSTRAINT unique_sync_checkpoint UNIQUE (provider, league, season, endpoint)
);

-- Optimize for lookup by provider, status, and target details
CREATE INDEX IF NOT EXISTS idx_wh_sync_checkpoints_lookup 
  ON public.wh_sync_checkpoints(provider, league, season, status);

CREATE INDEX IF NOT EXISTS idx_wh_sync_checkpoints_endpoint
  ON public.wh_sync_checkpoints(endpoint, status);

-- Enable RLS and SELECT Policy
ALTER TABLE public.wh_sync_checkpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read wh_sync_checkpoints" 
  ON public.wh_sync_checkpoints FOR SELECT USING (true);
