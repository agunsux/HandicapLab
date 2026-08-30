-- EPIC 61: Historical Data Disposition (Archive, Not Purge)
-- Non-negotiable: Rule #2 (Everything is Versioned - ZERO hard-deletes)

-- 1. Add archival and deprecation columns to daily_picks if not exists
ALTER TABLE IF EXISTS public.daily_picks
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_reason TEXT,
  ADD COLUMN IF NOT EXISTS market_deprecated BOOLEAN DEFAULT FALSE;

-- 2. Add archival columns to predictions if not exists
ALTER TABLE IF EXISTS public.predictions
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_reason TEXT,
  ADD COLUMN IF NOT EXISTS market_deprecated BOOLEAN DEFAULT FALSE;

-- 3. Flag historical Moneyline rows in daily_picks as deprecated
UPDATE public.daily_picks
SET 
  market_deprecated = TRUE,
  archived_reason = 'MONEYLINE_MARKET_DEPRECATED_EPIC61'
WHERE 
  UPPER(market_type) IN ('MONEYLINE', '1X2', 'ML')
  AND (market_deprecated IS FALSE OR market_deprecated IS NULL);

-- 4. Flag stale past-kickoff rows in daily_picks
UPDATE public.daily_picks
SET 
  archived_at = COALESCE(archived_at, NOW()),
  archived_reason = 'PAST_KICKOFF_OR_SYNTHETIC_PILOT'
WHERE 
  kickoff_utc <= NOW()
  AND (archived_at IS NULL);

-- 5. Flag historical Moneyline rows in predictions
UPDATE public.predictions
SET 
  market_deprecated = TRUE,
  archived_reason = 'MONEYLINE_MARKET_DEPRECATED_EPIC61'
WHERE 
  UPPER(market_type) IN ('MONEYLINE', '1X2', 'ML')
  AND (market_deprecated IS FALSE OR market_deprecated IS NULL);
