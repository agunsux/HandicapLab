-- Migration: Add Quant Audit and Paper Trading execution columns
-- Sequence number: 00000000000011

-- 1. Alter signals table for model versioning and audit trails
ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS rating_version TEXT;
ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS calibration_version TEXT;
ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS feature_snapshot JSONB;
ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS confidence_score NUMERIC;
ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS is_anomaly BOOLEAN DEFAULT false;
ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS anomaly_reason TEXT;

-- 2. Alter paper_trades table for realistic execution tracking
ALTER TABLE public.paper_trades ADD COLUMN IF NOT EXISTS signal_id UUID REFERENCES public.signals(id) ON DELETE CASCADE;
ALTER TABLE public.paper_trades ADD COLUMN IF NOT EXISTS result TEXT;
ALTER TABLE public.paper_trades ADD COLUMN IF NOT EXISTS profit NUMERIC;
ALTER TABLE public.paper_trades ADD COLUMN IF NOT EXISTS bankroll_after NUMERIC;
ALTER TABLE public.paper_trades ADD COLUMN IF NOT EXISTS drawdown NUMERIC;

-- Enable RLS on paper_trades if not enabled already
ALTER TABLE public.paper_trades ENABLE ROW LEVEL SECURITY;

-- Select policy for public readability of trades ledger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'paper_trades' AND policyname = 'paper_trades_public_read'
  ) THEN
    CREATE POLICY paper_trades_public_read ON public.paper_trades FOR SELECT USING (true);
  END IF;
END $$;
