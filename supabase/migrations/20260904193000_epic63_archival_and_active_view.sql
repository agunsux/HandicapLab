-- ==============================================================================
-- EPIC 63: Correct Archival Mechanism & Structural Single Read Path
-- Constitutional Rule 5: Archive, never hard-delete
-- ==============================================================================

-- 1. Create archived_daily_picks table with identical structure plus archive metadata
CREATE TABLE IF NOT EXISTS public.archived_daily_picks (
  LIKE public.daily_picks INCLUDING ALL
);

ALTER TABLE public.archived_daily_picks
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS archived_reason TEXT;

-- 2. Migrate all quarantined synthetic and past-kickoff picks to archived_daily_picks
INSERT INTO public.archived_daily_picks (
  id, fixture_id, league, home_team, away_team, kickoff_utc, market_type, prediction,
  model_probability, fair_odds, market_odds, market_bookmaker, edge_pct, confidence,
  verdict, reasoning, status, actual_score, profit_loss, clv, source, created_at,
  settled_at, rejection_reason, calibration_status, data_age_ms, odds_snapshot_id, prediction_id,
  archived_at, archived_reason
)
SELECT 
  id, fixture_id, league, home_team, away_team, kickoff_utc, market_type, prediction,
  model_probability, fair_odds, market_odds, market_bookmaker, edge_pct, confidence,
  verdict, reasoning, status, actual_score, profit_loss, clv, source, created_at,
  settled_at, rejection_reason, calibration_status, data_age_ms, odds_snapshot_id, prediction_id,
  NOW(), COALESCE(rejection_reason, 'ARCHIVED_SYNTHETIC_EPIC63')
FROM public.daily_picks
WHERE rejection_reason = 'ARCHIVED_SYNTHETIC_EPIC63'
   OR kickoff_utc <= NOW()
   OR (home_team ILIKE '%everton%' AND away_team ILIKE '%arsenal%')
   OR (home_team ILIKE '%arsenal%' AND away_team ILIKE '%everton%')
ON CONFLICT (id) DO NOTHING;

-- 3. Delete quarantined synthetic and past-kickoff records from the live daily_picks table
DELETE FROM public.daily_picks
WHERE rejection_reason = 'ARCHIVED_SYNTHETIC_EPIC63'
   OR kickoff_utc <= NOW()
   OR (home_team ILIKE '%everton%' AND away_team ILIKE '%arsenal%')
   OR (home_team ILIKE '%arsenal%' AND away_team ILIKE '%everton%');

-- 4. Create active_daily_picks view as the ONLY sanctioned read path
-- Structurally excludes any archived, rejected, or past-kickoff records
CREATE OR REPLACE VIEW public.active_daily_picks AS
SELECT *
FROM public.daily_picks
WHERE rejection_reason IS NULL
  AND kickoff_utc > NOW();

-- 5. Security & Permissions
ALTER TABLE public.archived_daily_picks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.archived_daily_picks FROM anon, authenticated;
GRANT SELECT ON public.archived_daily_picks TO service_role;
GRANT SELECT ON public.active_daily_picks TO anon, authenticated, service_role;
