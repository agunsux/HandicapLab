-- Migration: 00000000000014_feature_store_registry.sql
-- Goal: Establish Feature Store schema, lineage logs, and registry mapping.

CREATE TABLE IF NOT EXISTS public.wh_feature_registry (
  id BIGSERIAL PRIMARY KEY,
  feature_id VARCHAR(100) NOT NULL UNIQUE,
  version VARCHAR(50) NOT NULL,
  description TEXT,
  dependencies JSONB DEFAULT '[]'::jsonb,
  source_dataset VARCHAR(100) NOT NULL,
  generator_version VARCHAR(50) NOT NULL,
  owner VARCHAR(100) NOT NULL,
  tags JSONB DEFAULT '[]'::jsonb,
  is_deprecated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.wh_feature_lineage (
  id BIGSERIAL PRIMARY KEY,
  feature_id VARCHAR(100) NOT NULL REFERENCES public.wh_feature_registry(feature_id) ON DELETE CASCADE,
  input_dataset VARCHAR(100) NOT NULL,
  transformation_steps JSONB DEFAULT '[]'::jsonb,
  generator_version VARCHAR(50) NOT NULL,
  execution_timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.wh_feature_values (
  id BIGSERIAL PRIMARY KEY,
  feature_id VARCHAR(100) NOT NULL REFERENCES public.wh_feature_registry(feature_id) ON DELETE CASCADE,
  entity_id BIGINT NOT NULL, -- Surrogate entity key (e.g. fixture_id, team_id)
  entity_type VARCHAR(50) NOT NULL, -- FIXTURE, TEAM, PLAYER
  feature_value NUMERIC(15,6) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_feature_values_lookup ON public.wh_feature_values(feature_id, entity_id, entity_type);

-- ENABLE RLS
ALTER TABLE public.wh_feature_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wh_feature_lineage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wh_feature_values ENABLE ROW LEVEL SECURITY;

-- SELECT POLICIES
CREATE POLICY "Select Feature Registry" ON public.wh_feature_registry FOR SELECT USING (true);
CREATE POLICY "Select Feature Lineage" ON public.wh_feature_lineage FOR SELECT USING (true);
CREATE POLICY "Select Feature Values" ON public.wh_feature_values FOR SELECT USING (true);
