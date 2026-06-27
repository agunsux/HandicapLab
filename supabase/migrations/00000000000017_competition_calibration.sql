-- Competition Discovery & Calibration Schema Migrations

-- 1. Add model quality & active season discovery fields to leagues_cache
ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS market_efficiency_score INTEGER CHECK (market_efficiency_score >= 0 AND market_efficiency_score <= 100);
ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS sample_size_score INTEGER CHECK (sample_size_score >= 0 AND sample_size_score <= 100);
ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS data_quality_score INTEGER CHECK (data_quality_score >= 0 AND data_quality_score <= 100);
ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS edge_potential_score INTEGER CHECK (edge_potential_score >= 0 AND edge_potential_score <= 100);
ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS model_confidence_score INTEGER CHECK (model_confidence_score >= 0 AND model_confidence_score <= 100);
ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS historical_accuracy INTEGER CHECK (historical_accuracy >= 0 AND historical_accuracy <= 100);

-- Active Season Discovery & Calibration
ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS season_status VARCHAR(50) DEFAULT 'upcoming';
ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS current_season VARCHAR(20);
ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS season_start TIMESTAMPTZ;
ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS season_end TIMESTAMPTZ;
ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS is_currently_active BOOLEAN DEFAULT FALSE;
ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS next_match_date TIMESTAMPTZ;
ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS last_match_date TIMESTAMPTZ;
ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS featured_calibration BOOLEAN DEFAULT FALSE;

-- Tuning weights
ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS competition_weight NUMERIC DEFAULT 1.0;
ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS confidence_multiplier NUMERIC DEFAULT 1.0;
ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS risk_factor NUMERIC DEFAULT 1.0;

-- 2. Create competition_metrics table for tracking historical accuracies
CREATE TABLE IF NOT EXISTS public.competition_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id INTEGER REFERENCES public.leagues_cache(api_id) ON DELETE CASCADE UNIQUE,
  matches_count INTEGER DEFAULT 0,
  prediction_accuracy NUMERIC,
  roi_simulation NUMERIC,
  closing_line_accuracy NUMERIC,
  over25_accuracy NUMERIC,
  btts_accuracy NUMERIC,
  handicap_accuracy NUMERIC,
  sample_confidence VARCHAR(50) DEFAULT 'low', -- 'low', 'medium', 'high'
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.competition_metrics ENABLE ROW LEVEL SECURITY;

-- Select policy: public viewable
CREATE POLICY "Competition metrics are viewable by everyone" ON public.competition_metrics
  FOR SELECT USING (true);
