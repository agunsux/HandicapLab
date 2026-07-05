-- Migration: 00000000000021_fix_raw_matches_columns.sql
-- Goal: Ensure raw_matches contains all required columns for import-epl.js including odds columns.

ALTER TABLE public.raw_matches ADD COLUMN IF NOT EXISTS league TEXT;
ALTER TABLE public.raw_matches ADD COLUMN IF NOT EXISTS full_time_home_goals INTEGER;
ALTER TABLE public.raw_matches ADD COLUMN IF NOT EXISTS full_time_away_goals INTEGER;
ALTER TABLE public.raw_matches ADD COLUMN IF NOT EXISTS home_odds DOUBLE PRECISION;
ALTER TABLE public.raw_matches ADD COLUMN IF NOT EXISTS draw_odds DOUBLE PRECISION;
ALTER TABLE public.raw_matches ADD COLUMN IF NOT EXISTS away_odds DOUBLE PRECISION;
ALTER TABLE public.raw_matches ADD COLUMN IF NOT EXISTS over25_odds DOUBLE PRECISION;
ALTER TABLE public.raw_matches ADD COLUMN IF NOT EXISTS under25_odds DOUBLE PRECISION;
ALTER TABLE public.raw_matches ADD COLUMN IF NOT EXISTS source_file TEXT;
ALTER TABLE public.raw_matches ADD COLUMN IF NOT EXISTS ingested_at TIMESTAMPTZ DEFAULT NOW();

-- Alter season to text and match_date to date (safely using USING if types mismatch)
ALTER TABLE public.raw_matches ALTER COLUMN season TYPE TEXT;
ALTER TABLE public.raw_matches ALTER COLUMN match_date TYPE DATE USING match_date::DATE;
