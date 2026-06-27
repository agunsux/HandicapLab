-- Migration: Analytics Refinement Layer
-- Sequence number: 00000000000032

-- 1. Drop unique constraint from signal_metrics to allow append-only history
ALTER TABLE public.signal_metrics DROP CONSTRAINT IF EXISTS unique_signal_metric;

-- 2. Add market taxonomy columns to signals
ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS market_category TEXT;
ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS market_selection TEXT;
