-- Phase 4 Model Governance & MLOps Infrastructure Migration
-- Migration: 00000000000006_phase4_model_governance.sql

-- 1. Model Registry Table
CREATE TABLE IF NOT EXISTS public.model_registry (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL UNIQUE,
  state TEXT CHECK (state IN ('DRAFT', 'TRAINING', 'VALIDATED', 'CANDIDATE', 'SHADOW', 'CHALLENGER', 'CHAMPION', 'DEPRECATED', 'ARCHIVED')) NOT NULL DEFAULT 'DRAFT',
  artifact_uri TEXT NOT NULL,
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  promoted_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  previous_version_id TEXT REFERENCES public.model_registry(id)
);

-- 2. Model Cryptographic Fingerprints Table
CREATE TABLE IF NOT EXISTS public.model_fingerprints (
  model_id TEXT PRIMARY KEY REFERENCES public.model_registry(id) ON DELETE CASCADE,
  dataset_sha TEXT NOT NULL,
  feature_schema_sha TEXT NOT NULL,
  feature_transform_sha TEXT NOT NULL,
  calibration_sha TEXT NOT NULL,
  hyperparameter_sha TEXT NOT NULL,
  git_commit_sha TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Model Provider Snapshots Table
CREATE TABLE IF NOT EXISTS public.model_provider_snapshots (
  model_id TEXT PRIMARY KEY REFERENCES public.model_registry(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  version TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  response_schema TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  credential_profile TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Model Audit Trail Table (Immutable Log)
CREATE TABLE IF NOT EXISTS public.model_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id TEXT NOT NULL REFERENCES public.model_registry(id),
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'SYSTEM_MLOPS',
  reason TEXT NOT NULL,
  gate_evaluations JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Active Champion Pointer Table
CREATE TABLE IF NOT EXISTS public.champion_pointers (
  id TEXT PRIMARY KEY DEFAULT 'active_champion',
  model_id TEXT NOT NULL REFERENCES public.model_registry(id),
  promoted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  promoted_by TEXT NOT NULL DEFAULT 'SYSTEM_GOVERNANCE',
  reason TEXT
);

-- RLS Policies
ALTER TABLE public.model_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_fingerprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_provider_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_audit_trail ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.champion_pointers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read model registry" ON public.model_registry FOR SELECT USING (true);
CREATE POLICY "Public read model fingerprints" ON public.model_fingerprints FOR SELECT USING (true);
CREATE POLICY "Public read provider snapshots" ON public.model_provider_snapshots FOR SELECT USING (true);
CREATE POLICY "Public read model audit trail" ON public.model_audit_trail FOR SELECT USING (true);
CREATE POLICY "Public read champion pointers" ON public.champion_pointers FOR SELECT USING (true);
