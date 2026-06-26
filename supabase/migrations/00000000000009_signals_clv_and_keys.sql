-- Migration: Phase 6 Signals CLV and Unique constraints update
-- Sequence number: 00000000000009

-- 1. Drop old constraint on signals if it exists
DO $$
BEGIN
  ALTER TABLE public.signals DROP CONSTRAINT IF EXISTS unique_match_market_handicap;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 2. Add new unique constraint including selection
DO $$
BEGIN
  ALTER TABLE public.signals ADD CONSTRAINT unique_match_market_handicap_selection 
    UNIQUE (match_id, market, handicap_line, selection);
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 3. Adjust status check constraint on signals to include settling & void
DO $$
BEGIN
  ALTER TABLE public.signals DROP CONSTRAINT IF EXISTS signals_status_check;
  ALTER TABLE public.signals ADD CONSTRAINT signals_status_check 
    CHECK (status IN ('pending', 'settling', 'won', 'lost', 'push', 'half_win', 'half_loss', 'void'));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 4. Add new columns for CLV and Signal Types
ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS opening_probability NUMERIC;
ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS closing_probability NUMERIC;
ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS signal_type TEXT CHECK (signal_type IN ('PRE_MATCH', 'IN_PLAY')) DEFAULT 'PRE_MATCH';
