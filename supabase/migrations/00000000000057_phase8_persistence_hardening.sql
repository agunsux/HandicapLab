-- Migration: 00000000000057_phase8_persistence_hardening.sql
-- Goal: Persistence Hardening (Phase 8) - Immutability, Metadata, and Forensic Integrity

-- 1. Augment wh_predictions
ALTER TABLE public.wh_predictions
  ADD COLUMN IF NOT EXISTS calibration_version VARCHAR(50),
  ADD COLUMN IF NOT EXISTS calibration_status VARCHAR(50) DEFAULT 'NOT_YET_VALIDATED',
  ADD COLUMN IF NOT EXISTS raw_probability NUMERIC(5,4),
  ADD COLUMN IF NOT EXISTS win_probability NUMERIC(5,4),
  ADD COLUMN IF NOT EXISTS push_probability NUMERIC(5,4),
  ADD COLUMN IF NOT EXISTS loss_probability NUMERIC(5,4),
  ADD COLUMN IF NOT EXISTS data_age_ms INTEGER,
  ADD COLUMN IF NOT EXISTS odds_snapshot_id UUID REFERENCES public.odds_snapshots(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS feature_snapshot_id BIGINT; -- Loose ref to wh_feature_values or hashed state

-- Add index on odds and feature for fast forensic lookups
CREATE INDEX IF NOT EXISTS idx_predictions_odds_snapshot ON public.wh_predictions(odds_snapshot_id);
CREATE INDEX IF NOT EXISTS idx_predictions_feature_snapshot ON public.wh_predictions(feature_snapshot_id);

-- 2. Augment value_recommendations
ALTER TABLE public.value_recommendations
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS threshold_version VARCHAR(50),
  ADD COLUMN IF NOT EXISTS calibration_status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS data_age_ms INTEGER,
  ADD COLUMN IF NOT EXISTS prediction_id UUID REFERENCES public.wh_predictions(prediction_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_value_recs_prediction_id ON public.value_recommendations(prediction_id);

-- 3. Augment daily_picks
ALTER TABLE public.daily_picks
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS calibration_status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS data_age_ms INTEGER,
  ADD COLUMN IF NOT EXISTS odds_snapshot_id UUID,
  ADD COLUMN IF NOT EXISTS prediction_id UUID;

CREATE INDEX IF NOT EXISTS idx_daily_picks_prediction_id ON public.daily_picks(prediction_id);
CREATE INDEX IF NOT EXISTS idx_daily_picks_odds_snapshot_id ON public.daily_picks(odds_snapshot_id);
