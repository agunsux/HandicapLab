-- Migration: Paper Trading Engine v2 Additional Constraints
-- Sequence number: 00000000000021

-- 1. Add min_confidence_threshold to config
ALTER TABLE public.paper_trading_config ADD COLUMN IF NOT EXISTS min_confidence_threshold NUMERIC DEFAULT 70.0;

-- 2. Add decision log columns to prediction_ledger
ALTER TABLE public.prediction_ledger ADD COLUMN IF NOT EXISTS decision VARCHAR(20) DEFAULT 'SKIP';
ALTER TABLE public.prediction_ledger ADD COLUMN IF NOT EXISTS decision_reason TEXT DEFAULT 'Does not meet EV/confidence criteria';
