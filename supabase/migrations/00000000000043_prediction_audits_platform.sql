-- ========================================================
-- EPIC 43 — Prediction Audits Platform (Forensic Investigation Tool)
-- ========================================================
-- This table serves as the single immutable source of truth for the Prediction Audit Center.
-- It is written to *once* when a prediction is settled and never updated.
-- It contains the post-match generated analysis, feature contributions, and historical similarities.

CREATE TABLE IF NOT EXISTS public.prediction_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id UUID NOT NULL, -- Logical link to forecast_archive or public_prediction_ledger
  fixture_id TEXT NOT NULL,
  league TEXT NOT NULL,
  market TEXT NOT NULL,
  selection TEXT NOT NULL,
  
  snapshot_hash TEXT NOT NULL,
  model_version TEXT NOT NULL,
  feature_version TEXT NOT NULL,
  
  probability NUMERIC(6,4) NOT NULL,
  expected_value NUMERIC(6,4) NOT NULL,
  kelly NUMERIC(6,4) NOT NULL DEFAULT 0.0,
  confidence NUMERIC(6,4) NOT NULL,
  
  odds_at_prediction NUMERIC(6,3) NOT NULL,
  closing_odds NUMERIC(6,3) NOT NULL,
  clv NUMERIC(8,4) NOT NULL,
  
  settlement TEXT NOT NULL CHECK (settlement IN ('WIN', 'LOSS', 'PUSH', 'HALF_WIN', 'HALF_LOSS')),
  profit NUMERIC(8,4) NOT NULL,
  roi NUMERIC(8,4) NOT NULL,
  
  brier_contribution NUMERIC(6,4) NOT NULL,
  calibration_bucket TEXT NOT NULL,
  
  -- Forensic Evidence (Generated permanently at settlement)
  analysis JSONB NOT NULL DEFAULT '{}'::jsonb, 
  -- Example: { "why_lost": ["Expected goals overestimated.", "Closing line moved 9%."] }
  
  top_positive_features JSONB NOT NULL DEFAULT '[]'::jsonb,
  top_negative_features JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  similar_historical_matches JSONB NOT NULL DEFAULT '[]'::jsonb,
  hall_of_mistakes_link TEXT, -- If linked to a known mistake category
  
  manifest_id TEXT, -- E.g., Daily Manifest #418
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_prediction_audits_prediction_id ON public.prediction_audits(prediction_id);
CREATE INDEX IF NOT EXISTS idx_prediction_audits_league ON public.prediction_audits(league);
CREATE INDEX IF NOT EXISTS idx_prediction_audits_created_at ON public.prediction_audits(created_at);
CREATE INDEX IF NOT EXISTS idx_prediction_audits_settlement ON public.prediction_audits(settlement);
