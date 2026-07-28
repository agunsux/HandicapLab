-- EPIC 53 — Fixture State Machine
-- Lifecycle: DISCOVERED → HISTORICAL_READY → SNAPSHOT_READY → PREDICTED → LIVE → HALFTIME
--           → FINISHED → SETTLED → ARCHIVED
-- Scheduler reads state column instead of re-discovering fixtures every run.
-- State transitions are tracked with timestamps for audit.

CREATE TABLE IF NOT EXISTS fixture_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id TEXT NOT NULL,
  league_id INTEGER NOT NULL,
  league_name TEXT NOT NULL,
  season INTEGER NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  kickoff TIMESTAMPTZ NOT NULL,

  -- Current lifecycle state
  state VARCHAR(20) NOT NULL DEFAULT 'DISCOVERED'
    CHECK (state IN (
      'DISCOVERED',
      'HISTORICAL_READY',
      'SNAPSHOT_READY',
      'PREDICTED',
      'LIVE',
      'HALFTIME',
      'FINISHED',
      'SETTLED',
      'ARCHIVED'
    )),

  -- State transition timestamps
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  historical_ready_at TIMESTAMPTZ,
  snapshot_ready_at TIMESTAMPTZ,
  predicted_at TIMESTAMPTZ,
  live_at TIMESTAMPTZ,
  halftime_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,

  -- Snapshot dependency graph: which sources are available/missing
  -- Each entry: {source: string, status: 'ok'|'missing'|'error', fetched_at?: string}
  snapshot_odds_status TEXT,
  snapshot_weather_status TEXT,
  snapshot_injuries_status TEXT,
  snapshot_lineups_status TEXT,
  snapshot_rivalry_status TEXT,
  snapshot_data_gap TEXT[], -- list of sources that failed

  -- Priority metadata (for scheduler ranking)
  league_tier INTEGER NOT NULL DEFAULT 6,
  priority_score NUMERIC(5,2) NOT NULL DEFAULT 0,

  -- OddsPapi budget tracking per fixture
  odds_budget_spent INTEGER NOT NULL DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (fixture_id)
);

CREATE INDEX IF NOT EXISTS idx_fixture_states_state ON fixture_states(state);
CREATE INDEX IF NOT EXISTS idx_fixture_states_kickoff ON fixture_states(kickoff);
CREATE INDEX IF NOT EXISTS idx_fixture_states_league ON fixture_states(league_id);
CREATE INDEX IF NOT EXISTS idx_fixture_states_priority ON fixture_states(priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_fixture_states_scheduler
  ON fixture_states(state, kickoff, league_tier)
  WHERE state IN ('DISCOVERED', 'SNAPSHOT_READY', 'PREDICTED', 'LIVE', 'HALFTIME');

COMMENT ON TABLE fixture_states IS 'Fixture state machine — single source of truth for scheduler. EPIC 53.';
