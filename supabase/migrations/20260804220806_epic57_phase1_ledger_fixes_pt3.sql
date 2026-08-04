-- Fix missing unique constraint in prediction_ledger
ALTER TABLE public.prediction_ledger DROP CONSTRAINT IF EXISTS unique_ledger_match_market;
ALTER TABLE public.prediction_ledger ADD CONSTRAINT unique_ledger_match_market UNIQUE (match_id, market);
