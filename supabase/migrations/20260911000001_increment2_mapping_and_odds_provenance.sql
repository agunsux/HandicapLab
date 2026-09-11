-- 2026-09-11 — Increment 2: canonical fixture mapping + historical-odds provenance
--
-- 1. provider_fixture_map — ONE canonical internal match identity, with
--    external provider event IDs mapped through deterministic rules. Stores
--    every decision (MAPPED / UNMAPPED / AMBIGUOUS / CONFLICT) for audit.
-- 2. historical_odds provenance columns for unmetered OddsPapi observations
--    (provider, provider event id, per-side timestamps, market id).
-- 3. Extend the market CHECK to include BTTS (fail-closed elsewhere).
--
-- Idempotent and safe to re-run.

-- 1. Provider fixture crosswalk -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.provider_fixture_map (
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  canonical_match_id TEXT,
  mapping_status TEXT NOT NULL CHECK (mapping_status IN ('MAPPED', 'UNMAPPED', 'AMBIGUOUS', 'CONFLICT')),
  mapping_method TEXT NOT NULL,
  confidence NUMERIC NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 1),
  home_team TEXT,
  away_team TEXT,
  kickoff TIMESTAMPTZ,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS idx_provider_fixture_map_canonical
  ON public.provider_fixture_map (canonical_match_id);

ALTER TABLE public.provider_fixture_map ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'provider_fixture_map' AND policyname = 'provider fixture map public read'
  ) THEN
    CREATE POLICY "provider fixture map public read" ON public.provider_fixture_map FOR SELECT USING (true);
  END IF;
END
$$;

-- 2. historical_odds provenance ------------------------------------------------
ALTER TABLE public.historical_odds
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS provider_event_id TEXT,
  ADD COLUMN IF NOT EXISTS odds_timestamp TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS home_odds_timestamp TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS away_odds_timestamp TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS market_id INTEGER,
  ADD COLUMN IF NOT EXISTS yes_odds NUMERIC,
  ADD COLUMN IF NOT EXISTS no_odds NUMERIC;

CREATE INDEX IF NOT EXISTS idx_historical_odds_provider_event
  ON public.historical_odds (provider, provider_event_id);

-- 3. Extend market CHECK to include BTTS ---------------------------------------
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.historical_odds'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%market%'
  LOOP
    EXECUTE format('ALTER TABLE public.historical_odds DROP CONSTRAINT %I', c.conname);
  END LOOP;

  ALTER TABLE public.historical_odds
    ADD CONSTRAINT historical_odds_market_check
    CHECK (market IN ('ML', 'AH', 'OU', 'BTTS'));
END
$$;

-- Refresh PostgREST schema cache.
NOTIFY pgrst, 'reload schema';
