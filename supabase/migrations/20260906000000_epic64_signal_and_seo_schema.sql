-- ==============================================================================
-- EPIC 64: Traffic Light Signal System + SEO Fixture Pages Schema
-- Versioned signal classification config, export audit trail, and pick enrichment
-- ==============================================================================

-- 1. Table for historical export logging (Stage 0)
CREATE TABLE IF NOT EXISTS public.export_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('match', 'team', 'league')),
  entity_id TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('csv', 'json')),
  row_count INT DEFAULT 0,
  ip_hash TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_export_requests_entity ON public.export_requests (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_export_requests_requested_at ON public.export_requests (requested_at DESC);

ALTER TABLE public.export_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.export_requests TO anon, authenticated, service_role;

-- 2. Versioned Signal Classification Config (Stage A)
CREATE TABLE IF NOT EXISTS public.signal_classification_config (
  version_id TEXT PRIMARY KEY,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  green_min_edge_pct NUMERIC(5,2) NOT NULL DEFAULT 5.0,
  green_min_sample_size INT NOT NULL DEFAULT 30,
  yellow_min_edge_pct NUMERIC(5,2) NOT NULL DEFAULT 0.0,
  yellow_min_sample_size INT NOT NULL DEFAULT 10,
  red_condition TEXT NOT NULL DEFAULT 'edge <= 0 OR sample_size < yellow_min_sample_size',
  recommended_stake_green TEXT NOT NULL DEFAULT '1 unit',
  recommended_stake_yellow TEXT NOT NULL DEFAULT 'At your own risk — reduced stake or skip',
  recommended_stake_red TEXT NOT NULL DEFAULT 'Do not bet',
  created_by TEXT NOT NULL DEFAULT 'Juragan',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Initial v1.0.0
INSERT INTO public.signal_classification_config (
  version_id,
  effective_from,
  green_min_edge_pct,
  green_min_sample_size,
  yellow_min_edge_pct,
  yellow_min_sample_size,
  red_condition,
  recommended_stake_green,
  recommended_stake_yellow,
  recommended_stake_red,
  created_by,
  notes
) VALUES (
  'v1.0.0',
  NOW(),
  5.0,
  30,
  0.0,
  10,
  'edge <= 0 OR sample_size < yellow_min_sample_size',
  '1 unit',
  'At your own risk — reduced stake or skip',
  'Do not bet',
  'Juragan',
  'Initial deterministic threshold config for EPIC 64 Stage A'
) ON CONFLICT (version_id) DO NOTHING;

ALTER TABLE public.signal_classification_config ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.signal_classification_config TO anon, authenticated, service_role;

-- 3. Add classification columns to daily_picks & archived_daily_picks
ALTER TABLE public.daily_picks
  ADD COLUMN IF NOT EXISTS signal_color TEXT CHECK (signal_color IN ('green', 'yellow', 'red')),
  ADD COLUMN IF NOT EXISTS classification_version_id TEXT REFERENCES public.signal_classification_config(version_id),
  ADD COLUMN IF NOT EXISTS similar_sample_size INT,
  ADD COLUMN IF NOT EXISTS similar_win_rate NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS similar_roi NUMERIC(5,2);

ALTER TABLE public.archived_daily_picks
  ADD COLUMN IF NOT EXISTS signal_color TEXT,
  ADD COLUMN IF NOT EXISTS classification_version_id TEXT,
  ADD COLUMN IF NOT EXISTS similar_sample_size INT,
  ADD COLUMN IF NOT EXISTS similar_win_rate NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS similar_roi NUMERIC(5,2);

-- 4. Refresh active_daily_picks view
CREATE OR REPLACE VIEW public.active_daily_picks AS
SELECT *
FROM public.daily_picks
WHERE rejection_reason IS NULL
  AND kickoff_utc > NOW();

GRANT SELECT ON public.active_daily_picks TO anon, authenticated, service_role;
