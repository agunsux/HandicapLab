-- Add the remaining LedgerV2 prediction_snapshots columns
ALTER TABLE public.prediction_snapshots 
  ADD COLUMN IF NOT EXISTS snapshot_id UUID,
  ADD COLUMN IF NOT EXISTS prediction_uuid UUID,
  ADD COLUMN IF NOT EXISTS match_id TEXT,
  ADD COLUMN IF NOT EXISTS kickoff_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS snapshot_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS market TEXT,
  ADD COLUMN IF NOT EXISTS selection TEXT,
  ADD COLUMN IF NOT EXISTS line TEXT,
  ADD COLUMN IF NOT EXISTS odds DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS source_system TEXT;
