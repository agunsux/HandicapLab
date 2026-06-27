-- Add signal_id to odds_snapshots
ALTER TABLE public.odds_snapshots ADD COLUMN IF NOT EXISTS signal_id UUID REFERENCES public.signals(id) ON DELETE CASCADE;

-- Ensure signals contains: opening_odds, opening_line, closing_odds, closing_line, clv
ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS opening_line NUMERIC;
ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS closing_line NUMERIC;
ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS clv NUMERIC;

-- Add movement delta fields
ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS odds_move NUMERIC;
ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS line_move NUMERIC;
