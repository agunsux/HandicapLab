-- Migration: 00000000000025_edge_calibration_columns.sql
-- Goal: Add calibration, normalization, and confidence columns to match_edge_features.

ALTER TABLE public.match_edge_features ADD COLUMN IF NOT EXISTS calibrated_home_prob DOUBLE PRECISION;
ALTER TABLE public.match_edge_features ADD COLUMN IF NOT EXISTS calibrated_away_prob DOUBLE PRECISION;
ALTER TABLE public.match_edge_features ADD COLUMN IF NOT EXISTS calibrated_over_prob DOUBLE PRECISION;
ALTER TABLE public.match_edge_features ADD COLUMN IF NOT EXISTS normalized_ml_edge_home DOUBLE PRECISION;
ALTER TABLE public.match_edge_features ADD COLUMN IF NOT EXISTS normalized_ml_edge_away DOUBLE PRECISION;
ALTER TABLE public.match_edge_features ADD COLUMN IF NOT EXISTS normalized_ou_edge DOUBLE PRECISION;
ALTER TABLE public.match_edge_features ADD COLUMN IF NOT EXISTS confidence_score DOUBLE PRECISION;
