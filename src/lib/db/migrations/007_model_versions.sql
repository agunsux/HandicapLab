-- 007_model_versions
-- Registry of all model versions used in predictions.
-- Enables reproducibility: given a model_version, you can reconstruct the exact model state.

CREATE TABLE IF NOT EXISTS model_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version VARCHAR(50) NOT NULL UNIQUE,
  model_hash VARCHAR(64) NOT NULL,
  description TEXT,
  config_snapshot JSONB,           -- Full configuration at this version
  feature_version VARCHAR(50) NOT NULL DEFAULT 'v1.0-features',
  dataset_version VARCHAR(50) NOT NULL DEFAULT 'v1.0-dataset',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deprecated_at TIMESTAMPTZ,       -- NULL = active
  CHECK (deprecated_at IS NULL OR deprecated_at > created_at)
);

CREATE INDEX idx_model_versions_hash ON model_versions(model_hash);

COMMENT ON TABLE model_versions IS 'Model version registry — every prediction references a registered model version.';
COMMENT ON COLUMN model_versions.config_snapshot IS 'JSON snapshot of model configuration at this version for full reproducibility.';

-- Seed the current frozen model version
INSERT INTO model_versions (version, model_hash, description, config_snapshot, feature_version, dataset_version)
VALUES (
  'v0.5-ai',
  'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592',
  'Frozen model from Sprint 3 — Poisson-based probability engine with xG, form, and H2H adjustments',
  '{"type":"poisson","calibration":"temperature_scaling","confidence":"composite","ood":"distance_based"}',
  'v1.0-features',
  'v1.0-dataset'
)
ON CONFLICT (version) DO NOTHING;
