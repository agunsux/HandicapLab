-- Add missing timestamp column to odds_snapshots
ALTER TABLE public.odds_snapshots 
  ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_odds_snapshots_timestamp ON public.odds_snapshots(timestamp DESC);
