-- Fix missing columns in prediction_ledger
ALTER TABLE public.prediction_ledger 
    ADD COLUMN IF NOT EXISTS prediction_snapshot_id UUID,
    ADD COLUMN IF NOT EXISTS match_id TEXT,
    ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS market VARCHAR(50),
    ADD COLUMN IF NOT EXISTS selection VARCHAR(50),
    ADD COLUMN IF NOT EXISTS odds_at_prediction DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS confidence NUMERIC,
    ADD COLUMN IF NOT EXISTS model_version VARCHAR(100),
    ADD COLUMN IF NOT EXISTS result_status VARCHAR(20) DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS roi DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS decision VARCHAR(20) DEFAULT 'SKIP',
    ADD COLUMN IF NOT EXISTS decision_reason TEXT DEFAULT 'Does not meet EV/confidence criteria',
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_prediction_ledger_match_id ON public.prediction_ledger(match_id);
CREATE INDEX IF NOT EXISTS idx_prediction_ledger_result_status ON public.prediction_ledger(result_status);
