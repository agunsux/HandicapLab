-- Add missing columns to odds_snapshots from unapplied scripts
ALTER TABLE public.odds_snapshots 
  ADD COLUMN IF NOT EXISTS market_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS handicap_line NUMERIC,
  ADD COLUMN IF NOT EXISTS home_odds NUMERIC,
  ADD COLUMN IF NOT EXISTS draw_odds NUMERIC,
  ADD COLUMN IF NOT EXISTS away_odds NUMERIC,
  ADD COLUMN IF NOT EXISTS odds_home NUMERIC,
  ADD COLUMN IF NOT EXISTS odds_away NUMERIC,
  ADD COLUMN IF NOT EXISTS signal_id UUID;
