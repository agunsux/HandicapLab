-- Add calibration_metadata to prediction_snapshots
ALTER TABLE public.prediction_snapshots 
  ADD COLUMN IF NOT EXISTS calibration_metadata JSONB DEFAULT '{}'::jsonb;
