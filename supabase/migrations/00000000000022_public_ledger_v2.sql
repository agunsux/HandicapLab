-- Migration: Public Ledger v2 Architecture
-- Sequence number: 00000000000022

-- 1. Create prediction_decisions table
CREATE TABLE IF NOT EXISTS public.prediction_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_ledger_id UUID REFERENCES public.prediction_ledger(id) ON DELETE CASCADE NOT NULL,
  decision VARCHAR(20) NOT NULL, -- BET / SKIP
  reason_category VARCHAR(100) NOT NULL, -- e.g. MIN_CONFIDENCE_UNDER_THRESHOLD, MIN_EDGE_UNDER_THRESHOLD, NEGATIVE_EV, QUALIFIED_EDGE
  reason_text TEXT NOT NULL,
  confidence_score NUMERIC,
  edge_score NUMERIC,
  expected_value NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_decision_ledger UNIQUE (prediction_ledger_id)
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_prediction_decisions_ledger ON public.prediction_decisions(prediction_ledger_id);
CREATE INDEX IF NOT EXISTS idx_prediction_decisions_decision ON public.prediction_decisions(decision);

-- Enable RLS
ALTER TABLE public.prediction_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Prediction decisions are viewable by everyone" ON public.prediction_decisions FOR SELECT USING (true);

-- 2. Alter paper_trades to reference prediction_decisions optionally
ALTER TABLE public.paper_trades ADD COLUMN IF NOT EXISTS prediction_decision_id UUID REFERENCES public.prediction_decisions(id) ON DELETE SET NULL;
