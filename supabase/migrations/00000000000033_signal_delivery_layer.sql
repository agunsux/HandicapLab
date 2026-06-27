-- Migration: Signal Delivery Layer
-- Sequence number: 00000000000033

-- 1. Add published_at column to signals
ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- 2. Create indexes to speed up feed querying
CREATE INDEX IF NOT EXISTS idx_signals_published_at ON public.signals(published_at);
CREATE INDEX IF NOT EXISTS idx_signals_market_category ON public.signals(market_category);
CREATE INDEX IF NOT EXISTS idx_signals_status ON public.signals(status);
