-- ============================================================================
-- MIGRATION: 20261016010000_repair_matches_competition_code.sql
-- PURPOSE: Forward migration repairing matches schema to guarantee competition_code
--          and warehouse columns exist across all existing databases.
-- ============================================================================

ALTER TABLE IF EXISTS public.matches ADD COLUMN IF NOT EXISTS competition_code VARCHAR(32);
ALTER TABLE IF EXISTS public.matches ADD COLUMN IF NOT EXISTS season_code VARCHAR(16);
ALTER TABLE IF EXISTS public.matches ADD COLUMN IF NOT EXISTS natural_key VARCHAR(128);
ALTER TABLE IF EXISTS public.matches ADD COLUMN IF NOT EXISTS home_score INT;
ALTER TABLE IF EXISTS public.matches ADD COLUMN IF NOT EXISTS away_score INT;
ALTER TABLE IF EXISTS public.matches ADD COLUMN IF NOT EXISTS ht_home_score INT;
ALTER TABLE IF EXISTS public.matches ADD COLUMN IF NOT EXISTS ht_away_score INT;
ALTER TABLE IF EXISTS public.matches ADD COLUMN IF NOT EXISTS date_id DATE;
ALTER TABLE IF EXISTS public.matches ADD COLUMN IF NOT EXISTS venue_id UUID;
ALTER TABLE IF EXISTS public.matches ADD COLUMN IF NOT EXISTS referee_id UUID;
ALTER TABLE IF EXISTS public.matches ADD COLUMN IF NOT EXISTS provider VARCHAR(64) DEFAULT 'API-Football';
ALTER TABLE IF EXISTS public.matches ADD COLUMN IF NOT EXISTS provider_version VARCHAR(32) DEFAULT 'v1.0';
ALTER TABLE IF EXISTS public.matches ADD COLUMN IF NOT EXISTS provider_match_id VARCHAR(128);
ALTER TABLE IF EXISTS public.matches ADD COLUMN IF NOT EXISTS checksum VARCHAR(64) DEFAULT '';
ALTER TABLE IF EXISTS public.matches ADD COLUMN IF NOT EXISTS etl_version VARCHAR(32) DEFAULT '1.0.0';
ALTER TABLE IF EXISTS public.matches ADD COLUMN IF NOT EXISTS ingested_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE IF EXISTS public.matches ADD COLUMN IF NOT EXISTS last_verified TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE IF EXISTS public.matches ADD COLUMN IF NOT EXISTS license VARCHAR(64) DEFAULT 'Open';

-- Backfill competition_code from league column if competition_code is null
UPDATE public.matches
SET competition_code = CASE
  WHEN league ILIKE '%Premier League%' THEN 'EPL'
  WHEN league ILIKE '%La Liga%' THEN 'LA_LIGA'
  WHEN league ILIKE '%Serie A%' THEN 'SERIE_A'
  WHEN league ILIKE '%Bundesliga%' THEN 'BUNDESLIGA'
  WHEN league ILIKE '%Ligue 1%' THEN 'LIGUE_1'
  ELSE competition_code
END
WHERE competition_code IS NULL;

-- Backfill home_score / away_score from home_goals / away_goals if null
UPDATE public.matches
SET home_score = home_goals, away_score = away_goals
WHERE home_score IS NULL AND home_goals IS NOT NULL;
