-- Migration: Create paper_trading_config and add kelly_fraction
-- Sequence number: 00000000000012

CREATE TABLE IF NOT EXISTS public.paper_trading_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  starting_bankroll NUMERIC DEFAULT 1000.0,
  unit_size NUMERIC DEFAULT 10.0,
  max_stake_percentage NUMERIC DEFAULT 5.0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default values if table is empty
INSERT INTO public.paper_trading_config (starting_bankroll, unit_size, max_stake_percentage)
SELECT 1000.0, 10.0, 5.0
WHERE NOT EXISTS (SELECT 1 FROM public.paper_trading_config);

-- Add kelly_fraction to paper_trades for theoretical allocation audits
ALTER TABLE public.paper_trades ADD COLUMN IF NOT EXISTS kelly_fraction NUMERIC;

-- Enable RLS
ALTER TABLE public.paper_trading_config ENABLE ROW LEVEL SECURITY;

-- Allow select to everyone
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'paper_trading_config' AND policyname = 'paper_trading_config_public_read'
  ) THEN
    CREATE POLICY paper_trading_config_public_read ON public.paper_trading_config FOR SELECT USING (true);
  END IF;
END $$;
