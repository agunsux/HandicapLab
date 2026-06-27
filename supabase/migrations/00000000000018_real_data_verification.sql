-- Real Data Verification Pipeline Migrations

-- 1. Extend matches table to support data pipeline sync attributes
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS competition_id INTEGER;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS external_match_id VARCHAR(100);
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS source VARCHAR(100) DEFAULT 'api-football';
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS fetched_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS kickoff_time TIMESTAMPTZ;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS home_team VARCHAR(150);
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS away_team VARCHAR(150);

-- 2. Create prediction_snapshots table
CREATE TABLE IF NOT EXISTS public.prediction_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id TEXT NOT NULL,
  model_version VARCHAR(100) NOT NULL,
  prediction JSONB NOT NULL,
  confidence NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prediction_snapshots_match_id ON public.prediction_snapshots(match_id);

-- 3. Create match_results table
CREATE TABLE IF NOT EXISTS public.match_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id TEXT NOT NULL UNIQUE,
  final_score JSONB NOT NULL,
  verified_source VARCHAR(100) DEFAULT 'api-football',
  verified_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for new tables
ALTER TABLE public.prediction_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Prediction snapshots are viewable by everyone" ON public.prediction_snapshots FOR SELECT USING (true);
CREATE POLICY "Match results are viewable by everyone" ON public.match_results FOR SELECT USING (true);
