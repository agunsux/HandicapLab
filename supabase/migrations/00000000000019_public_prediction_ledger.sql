-- Migration: Create public prediction_ledger table
-- Sequence number: 00000000000019

CREATE TABLE IF NOT EXISTS public.prediction_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_snapshot_id UUID,
  match_id TEXT NOT NULL,
  competition_id INTEGER,
  published_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  market VARCHAR(50) NOT NULL,
  selection VARCHAR(50),
  odds_at_prediction DOUBLE PRECISION,
  confidence NUMERIC,
  model_version VARCHAR(100) NOT NULL,
  result_status VARCHAR(20) DEFAULT 'pending' NOT NULL,
  settled_at TIMESTAMPTZ,
  roi DOUBLE PRECISION,
  verified BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_ledger_match_market UNIQUE (match_id, market)
);

CREATE INDEX IF NOT EXISTS idx_prediction_ledger_match_id ON public.prediction_ledger(match_id);
CREATE INDEX IF NOT EXISTS idx_prediction_ledger_competition_id ON public.prediction_ledger(competition_id);
CREATE INDEX IF NOT EXISTS idx_prediction_ledger_result_status ON public.prediction_ledger(result_status);

-- Enable RLS
ALTER TABLE public.prediction_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Prediction ledger entries are viewable by everyone" ON public.prediction_ledger FOR SELECT USING (true);
