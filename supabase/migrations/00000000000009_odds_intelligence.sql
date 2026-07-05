-- Migration 00000000000009_odds_intelligence.sql
-- Goal: Create Market Warehouse & Odds Intelligence Platform schemas

-- 0. Drop old basic odds tables from Sprint 2.5 to upgrade to new advanced schemas
DROP TABLE IF EXISTS public.wh_odds_snapshots CASCADE;
DROP TABLE IF EXISTS public.wh_market_movements CASCADE;

-- 1. Calculation Versions (Immutable tracker for reproducibility)
CREATE TABLE IF NOT EXISTS public.wh_calculation_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  algorithm VARCHAR(100) NOT NULL,
  version VARCHAR(50) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_calc_version UNIQUE (algorithm, version)
);
CREATE INDEX IF NOT EXISTS idx_wh_calc_versions_algo ON public.wh_calculation_versions(algorithm);

-- Insert Default Calculation Versions
INSERT INTO public.wh_calculation_versions (algorithm, version, description)
VALUES 
  ('Margin Removal', 'proportional', 'Proportional Margin Removal Method'),
  ('Margin Removal', 'shin', 'Shin Method Margin Removal'),
  ('CLV', 'fractional_percentage', 'Fractional CLV Percentage (Odds Taken / Closing Odds - 1)'),
  ('CLV', 'absolute_probability', 'Absolute Probability Difference CLV'),
  ('Consensus', 'median_average', 'Consensus derived from median average of top bookmakers')
ON CONFLICT DO NOTHING;

-- 2. Bookmakers
CREATE TABLE IF NOT EXISTS public.wh_bookmakers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  api_id INTEGER UNIQUE,
  name VARCHAR(100) NOT NULL UNIQUE,
  type VARCHAR(50) DEFAULT 'sharp', -- sharp vs soft
  priority INTEGER DEFAULT 10,
  status VARCHAR(20) DEFAULT 'active'
);
CREATE INDEX IF NOT EXISTS idx_wh_bookmakers_name ON public.wh_bookmakers(name);

-- 3. Odds Sources
CREATE TABLE IF NOT EXISTS public.wh_odds_sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_name VARCHAR(100) NOT NULL UNIQUE,
  api_endpoint VARCHAR(255),
  status VARCHAR(20) DEFAULT 'active'
);
CREATE INDEX IF NOT EXISTS idx_wh_odds_sources_name ON public.wh_odds_sources(provider_name);

-- 4. Market Types
CREATE TABLE IF NOT EXISTS public.wh_market_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  is_asian BOOLEAN DEFAULT FALSE,
  status VARCHAR(20) DEFAULT 'active'
);
CREATE INDEX IF NOT EXISTS idx_wh_market_types_name ON public.wh_market_types(name);

-- 5. Market Snapshots (Core Odds Table)
CREATE TABLE IF NOT EXISTS public.wh_market_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fixture_id UUID REFERENCES public.wh_fixtures(id) ON DELETE CASCADE,
  bookmaker_id UUID REFERENCES public.wh_bookmakers(id) ON DELETE SET NULL,
  source_id UUID REFERENCES public.wh_odds_sources(id) ON DELETE SET NULL,
  market_id UUID REFERENCES public.wh_market_types(id) ON DELETE SET NULL,
  selection VARCHAR(100) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  
  -- Raw Odds
  decimal_odds NUMERIC(8,4) NOT NULL,
  raw_probability NUMERIC(8,6),
  
  -- Margins & Calculated Probability
  overround NUMERIC(8,6),
  margin_value NUMERIC(8,6),
  normalized_probability NUMERIC(8,6),
  implied_probability NUMERIC(8,6),
  margin_method VARCHAR(50),
  calculation_version_id UUID REFERENCES public.wh_calculation_versions(id) ON DELETE SET NULL,
  
  -- Quality Control
  status VARCHAR(20) DEFAULT 'open', -- open, suspended, closed
  quality_flag VARCHAR(20) DEFAULT 'NORMAL', -- NORMAL, STALE, OUTLIER, SUSPENDED, VOID, INCOMPLETE, DUPLICATE, INVALID
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_odds CHECK (decimal_odds > 1.0)
);
CREATE INDEX IF NOT EXISTS idx_wh_market_snap_lookup ON public.wh_market_snapshots(fixture_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_wh_market_snap_bookie ON public.wh_market_snapshots(bookmaker_id, market_id);

-- 6. Market Movements
CREATE TABLE IF NOT EXISTS public.wh_market_movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fixture_id UUID REFERENCES public.wh_fixtures(id) ON DELETE CASCADE,
  bookmaker_id UUID REFERENCES public.wh_bookmakers(id) ON DELETE SET NULL,
  market_id UUID REFERENCES public.wh_market_types(id) ON DELETE SET NULL,
  selection VARCHAR(100) NOT NULL,
  
  opening_odds NUMERIC(8,4),
  current_odds NUMERIC(8,4),
  closing_odds NUMERIC(8,4),
  
  movement_percentage NUMERIC(8,6),
  price_acceleration NUMERIC(8,6),
  steam_velocity NUMERIC(8,6),
  odds_drift NUMERIC(8,6),
  consensus_drift NUMERIC(8,6),
  market_compression NUMERIC(8,6),
  bookmaker_dispersion NUMERIC(8,6),
  volatility_score NUMERIC(8,6),
  favourite_flip BOOLEAN DEFAULT FALSE,
  late_sharp_move BOOLEAN DEFAULT FALSE,
  liquidity_proxy NUMERIC(10,2),
  
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wh_market_mov_lookup ON public.wh_market_movements(fixture_id, timestamp);

-- 7. Opening Lines
CREATE TABLE IF NOT EXISTS public.wh_opening_lines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fixture_id UUID REFERENCES public.wh_fixtures(id) ON DELETE CASCADE,
  bookmaker_id UUID REFERENCES public.wh_bookmakers(id) ON DELETE SET NULL,
  market_id UUID REFERENCES public.wh_market_types(id) ON DELETE SET NULL,
  selection VARCHAR(100) NOT NULL,
  decimal_odds NUMERIC(8,4) NOT NULL,
  implied_probability NUMERIC(8,6),
  timestamp TIMESTAMPTZ NOT NULL,
  CONSTRAINT unique_opening_line UNIQUE (fixture_id, bookmaker_id, market_id, selection)
);

-- 8. Closing Lines & CLV
CREATE TABLE IF NOT EXISTS public.wh_closing_lines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fixture_id UUID REFERENCES public.wh_fixtures(id) ON DELETE CASCADE,
  bookmaker_id UUID REFERENCES public.wh_bookmakers(id) ON DELETE SET NULL,
  market_id UUID REFERENCES public.wh_market_types(id) ON DELETE SET NULL,
  selection VARCHAR(100) NOT NULL,
  
  decimal_odds NUMERIC(8,4) NOT NULL,
  implied_probability NUMERIC(8,6),
  
  clv_percentage NUMERIC(8,6),
  clv_probability NUMERIC(8,6),
  clv_expected_value NUMERIC(8,6),
  clv_log NUMERIC(8,6),
  clv_version_id UUID REFERENCES public.wh_calculation_versions(id) ON DELETE SET NULL,
  
  timestamp TIMESTAMPTZ NOT NULL,
  CONSTRAINT unique_closing_line UNIQUE (fixture_id, bookmaker_id, market_id, selection)
);

-- 9. Market Consensus
CREATE TABLE IF NOT EXISTS public.wh_market_consensus (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fixture_id UUID REFERENCES public.wh_fixtures(id) ON DELETE CASCADE,
  market_id UUID REFERENCES public.wh_market_types(id) ON DELETE SET NULL,
  selection VARCHAR(100) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  
  best_odds NUMERIC(8,4),
  average_odds NUMERIC(8,4),
  median_odds NUMERIC(8,4),
  weighted_average_odds NUMERIC(8,4),
  consensus_probability NUMERIC(8,6),
  
  bookmaker_count INTEGER DEFAULT 0,
  provider_count INTEGER DEFAULT 0,
  freshness_seconds INTEGER,
  confidence_score NUMERIC(5,2),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wh_market_cons_lookup ON public.wh_market_consensus(fixture_id, timestamp);

-- 10. Market Features
CREATE TABLE IF NOT EXISTS public.wh_market_features (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fixture_id UUID REFERENCES public.wh_fixtures(id) ON DELETE CASCADE,
  version_id UUID REFERENCES public.wh_feature_versions(id) ON DELETE CASCADE,
  features_json JSONB NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_market_feat UNIQUE (fixture_id, version_id)
);

-- 11. Sync Jobs & Logs
CREATE TABLE IF NOT EXISTS public.wh_sync_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider VARCHAR(100) NOT NULL,
  job_type VARCHAR(100) NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'running', -- running, success, failed
  records_processed INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_wh_sync_jobs_lookup ON public.wh_sync_jobs(provider, status);

CREATE TABLE IF NOT EXISTS public.wh_sync_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID REFERENCES public.wh_sync_jobs(id) ON DELETE CASCADE,
  level VARCHAR(20) DEFAULT 'info', -- info, warn, error
  message TEXT NOT NULL,
  details_json JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wh_sync_logs_job ON public.wh_sync_logs(job_id);

-- Enable RLS and SELECT Policies
ALTER TABLE public.wh_calculation_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wh_bookmakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wh_odds_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wh_market_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wh_market_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wh_market_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wh_opening_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wh_closing_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wh_market_consensus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wh_market_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wh_sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wh_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read wh_calculation_versions" ON public.wh_calculation_versions FOR SELECT USING (true);
CREATE POLICY "Allow public read wh_bookmakers" ON public.wh_bookmakers FOR SELECT USING (true);
CREATE POLICY "Allow public read wh_odds_sources" ON public.wh_odds_sources FOR SELECT USING (true);
CREATE POLICY "Allow public read wh_market_types" ON public.wh_market_types FOR SELECT USING (true);
CREATE POLICY "Allow public read wh_market_snapshots" ON public.wh_market_snapshots FOR SELECT USING (true);
CREATE POLICY "Allow public read wh_market_movements" ON public.wh_market_movements FOR SELECT USING (true);
CREATE POLICY "Allow public read wh_opening_lines" ON public.wh_opening_lines FOR SELECT USING (true);
CREATE POLICY "Allow public read wh_closing_lines" ON public.wh_closing_lines FOR SELECT USING (true);
CREATE POLICY "Allow public read wh_market_consensus" ON public.wh_market_consensus FOR SELECT USING (true);
CREATE POLICY "Allow public read wh_market_features" ON public.wh_market_features FOR SELECT USING (true);
CREATE POLICY "Allow public read wh_sync_jobs" ON public.wh_sync_jobs FOR SELECT USING (true);
CREATE POLICY "Allow public read wh_sync_logs" ON public.wh_sync_logs FOR SELECT USING (true);
