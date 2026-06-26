-- Migration: Add kelly_metadata JSONB column to paper_trades table and competition_type to signals
-- Sequence number: 00000000000013

ALTER TABLE public.paper_trades ADD COLUMN IF NOT EXISTS kelly_metadata JSONB;
ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS competition_type TEXT;
