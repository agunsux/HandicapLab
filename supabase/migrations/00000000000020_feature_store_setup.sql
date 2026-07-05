-- Migration: 00000000000020_feature_store_setup.sql
-- Goal: Create public.wh_feature_values table to store versioned, point-in-time calculation snapshots of features.

CREATE TABLE IF NOT EXISTS public.wh_feature_values (
  id BIGSERIAL PRIMARY KEY,
  fixture_id BIGINT REFERENCES public.wh_fixtures(id) ON DELETE CASCADE,
  feature_name VARCHAR(100) NOT NULL,
  feature_value DOUBLE PRECISION NOT NULL,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  source VARCHAR(100) NOT NULL,
  CONSTRAINT unique_fixture_feature UNIQUE (fixture_id, feature_name)
);

-- Enable RLS and public read access
ALTER TABLE public.wh_feature_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Select features" ON public.wh_feature_values FOR SELECT USING (true);
