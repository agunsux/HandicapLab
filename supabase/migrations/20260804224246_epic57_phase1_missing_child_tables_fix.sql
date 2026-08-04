-- Fix the tables that were created poorly by dropping prediction_decisions and adding the missing columns

DROP TABLE IF EXISTS public.prediction_decisions CASCADE;

CREATE TABLE IF NOT EXISTS public.prediction_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_ledger_id UUID REFERENCES public.prediction_ledger(id) ON DELETE CASCADE NOT NULL,
  decision VARCHAR(20) NOT NULL,
  reason_category VARCHAR(100) NOT NULL,
  reason_text TEXT NOT NULL,
  confidence_score NUMERIC,
  edge_score NUMERIC,
  expected_value NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_decision_ledger UNIQUE (prediction_ledger_id)
);
CREATE INDEX IF NOT EXISTS idx_prediction_decisions_ledger ON public.prediction_decisions(prediction_ledger_id);
CREATE INDEX IF NOT EXISTS idx_prediction_decisions_decision ON public.prediction_decisions(decision);
ALTER TABLE public.prediction_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Prediction decisions are viewable by everyone" ON public.prediction_decisions FOR SELECT USING (true);


ALTER TABLE public.prediction_model_versions ADD COLUMN IF NOT EXISTS calibration_version VARCHAR(50);
ALTER TABLE public.prediction_snapshot_explainability ADD COLUMN IF NOT EXISTS feature_importance DOUBLE PRECISION;
ALTER TABLE public.prediction_snapshot_execution ADD COLUMN IF NOT EXISTS api_latency_ms INTEGER;
