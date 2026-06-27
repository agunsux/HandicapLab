-- Migration: Paper Trading Engine v2 Database Updates
-- Sequence number: 00000000000020

-- 1. Alter paper_trading_config to add min_edge_threshold (e.g. 2.0 for 2% EV edge)
ALTER TABLE public.paper_trading_config ADD COLUMN IF NOT EXISTS min_edge_threshold NUMERIC DEFAULT 2.0;

-- 2. Alter paper_trades to support prediction_ledger mapping and unit-based columns
ALTER TABLE public.paper_trades ADD COLUMN IF NOT EXISTS prediction_ledger_id UUID REFERENCES public.prediction_ledger(id) ON DELETE CASCADE;
ALTER TABLE public.paper_trades ADD COLUMN IF NOT EXISTS selection VARCHAR(50);
ALTER TABLE public.paper_trades ADD COLUMN IF NOT EXISTS entry_odds DOUBLE PRECISION;
ALTER TABLE public.paper_trades ADD COLUMN IF NOT EXISTS closing_odds DOUBLE PRECISION;
ALTER TABLE public.paper_trades ADD COLUMN IF NOT EXISTS stake_units DOUBLE PRECISION DEFAULT 1.0;
ALTER TABLE public.paper_trades ADD COLUMN IF NOT EXISTS expected_value DOUBLE PRECISION;
ALTER TABLE public.paper_trades ADD COLUMN IF NOT EXISTS edge_score DOUBLE PRECISION;
ALTER TABLE public.paper_trades ADD COLUMN IF NOT EXISTS pnl_units DOUBLE PRECISION;
ALTER TABLE public.paper_trades ADD COLUMN IF NOT EXISTS clv_percentage DOUBLE PRECISION;
ALTER TABLE public.paper_trades ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;

-- Create indexes for performance lookup
CREATE INDEX IF NOT EXISTS idx_paper_trades_prediction_ledger_id ON public.paper_trades(prediction_ledger_id);
CREATE INDEX IF NOT EXISTS idx_paper_trades_status ON public.paper_trades(status);
