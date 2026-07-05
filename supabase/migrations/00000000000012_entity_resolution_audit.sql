-- Migration: 00000000000012_entity_resolution_audit.sql
-- Goal: Create Resolution Audit and Manual Review tables for Entity Resolution tracking.

CREATE TABLE IF NOT EXISTS public.wh_resolution_audit (
  id BIGSERIAL PRIMARY KEY,
  provider_name VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL, -- TEAM, LEAGUE, COMPETITION
  original_value VARCHAR(255) NOT NULL,
  resolved_id BIGINT,
  strategy_used VARCHAR(100) NOT NULL, -- provider_id_map, alias_lookup, normalized_string, fuzzy_match, graph_inference, historical
  confidence_score NUMERIC(5,2) NOT NULL,
  resolution_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_resolution_audit_lookup ON public.wh_resolution_audit(provider_name, entity_type, original_value);

CREATE TABLE IF NOT EXISTS public.wh_manual_review_queue (
  id BIGSERIAL PRIMARY KEY,
  provider_name VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  original_value VARCHAR(255) NOT NULL,
  reason VARCHAR(255) NOT NULL, -- low_confidence, conflict, multiple_candidates, unknown
  resolved_id BIGINT, -- Proposed ID if any
  status VARCHAR(50) DEFAULT 'pending', -- pending, resolved, ignored
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_manual_review_status ON public.wh_manual_review_queue(status);

-- ENABLE RLS
ALTER TABLE public.wh_resolution_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wh_manual_review_queue ENABLE ROW LEVEL SECURITY;

-- SELECT POLICIES
CREATE POLICY "Select Resolution Audit" ON public.wh_resolution_audit FOR SELECT USING (true);
CREATE POLICY "Select Manual Review Queue" ON public.wh_manual_review_queue FOR SELECT USING (true);
