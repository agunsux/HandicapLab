-- EPIC 52 Stage B/C — Pre-Match Feature Snapshot
-- Single canonical row per fixture assembled at T-60 before kickoff.
-- This becomes the anti-leakage boundary: no feature for a match may use
-- data fetched after this snapshot's timestamp (Rule #4, no black box).
-- Every source has its own fetch timestamp (not the job's start time),
-- so staleness is individually auditable.

CREATE TABLE IF NOT EXISTS pre_match_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id TEXT NOT NULL,
  league_id INTEGER,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  kickoff_time TIMESTAMPTZ NOT NULL,
  snapshot_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  snapshot_version INTEGER NOT NULL DEFAULT 1,

  -- Odds from the 4 sharp books (Stage A)
  odds_data JSONB,
  odds_fetched_at TIMESTAMPTZ,

  -- Weather at venue (Stage B)
  weather_temp NUMERIC(5,2),
  weather_humidity INTEGER,
  weather_wind_speed NUMERIC(5,2),
  weather_precipitation NUMERIC(5,2),
  weather_description TEXT,
  weather_fetched_at TIMESTAMPTZ,

  -- Injuries (Stage B)
  injuries_home JSONB,
  injuries_away JSONB,
  injuries_fetched_at TIMESTAMPTZ,

  -- Lineups (Stage B)
  lineup_home JSONB,
  lineup_away JSONB,
  lineup_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  lineup_fetched_at TIMESTAMPTZ,

  -- Rivalry feature (Stage D)
  is_derby BOOLEAN NOT NULL DEFAULT FALSE,
  rivalry_intensity INTEGER DEFAULT 0,
  rivalry_pair_version TEXT,

  -- Data quality
  data_gap TEXT[], -- list of source keys that failed (e.g. {'weather','lineup_home'})
  snapshot_id TEXT NOT NULL, -- deterministic: SHA-256(fixture_id || snapshot_timestamp)

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pre_match_snapshots_fixture ON pre_match_snapshots(fixture_id, snapshot_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_pre_match_snapshots_kickoff ON pre_match_snapshots(kickoff_time);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pre_match_snapshots_idempotent
  ON pre_match_snapshots(fixture_id, snapshot_version);
