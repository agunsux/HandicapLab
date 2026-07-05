-- Migration 00000000000007_idx_predictions_timestamp.sql
-- Description: Add sorting index for predictions timestamp to optimize feed queries

CREATE INDEX IF NOT EXISTS idx_predictions_timestamp ON public.predictions (prediction_timestamp DESC);
