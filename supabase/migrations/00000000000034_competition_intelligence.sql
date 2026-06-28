-- Migration: Phase 32.7 & 32.8 Competition Intelligence & Production Readiness

-- 1. Extend leagues_cache (competitions table)
ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS competition_name VARCHAR(100);
ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS tier INTEGER;
ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS liquidity_score INTEGER;
ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS market_coverage_score INTEGER;
ALTER TABLE public.leagues_cache ADD COLUMN IF NOT EXISTS active_status VARCHAR(20) DEFAULT 'active';

-- Copy existing name to competition_name
UPDATE public.leagues_cache SET competition_name = name WHERE competition_name IS NULL;
UPDATE public.leagues_cache SET active_status = 'active' WHERE active_status IS NULL;

-- 2. Extend signals table
ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS last_odds_update TIMESTAMPTZ;
ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS odds_age_minutes INTEGER;

-- Set default values for existing signals
UPDATE public.signals SET last_odds_update = updated_at WHERE last_odds_update IS NULL;
UPDATE public.signals SET odds_age_minutes = 0 WHERE odds_age_minutes IS NULL;

-- 3. Extend odds_snapshots table
ALTER TABLE public.odds_snapshots ADD COLUMN IF NOT EXISTS market_type VARCHAR(20);
ALTER TABLE public.odds_snapshots ADD COLUMN IF NOT EXISTS handicap_line NUMERIC;
ALTER TABLE public.odds_snapshots ADD COLUMN IF NOT EXISTS odds_home NUMERIC;
ALTER TABLE public.odds_snapshots ADD COLUMN IF NOT EXISTS odds_away NUMERIC;

-- Migrate existing columns
UPDATE public.odds_snapshots SET market_type = CASE WHEN market = 'asian_handicap' THEN 'AH' WHEN market = 'over_under' THEN 'OU' ELSE 'ML' END WHERE market_type IS NULL;
UPDATE public.odds_snapshots SET handicap_line = line WHERE handicap_line IS NULL;
UPDATE public.odds_snapshots SET odds_home = odds WHERE odds_home IS NULL;
