-- EPIC 53 Stage D — Historical Import Progress Tracker
-- Per-league, per-season resumable import state.

CREATE TABLE IF NOT EXISTS historical_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id INTEGER NOT NULL,
  league_name TEXT NOT NULL,
  season INTEGER NOT NULL,
  total_fixtures INTEGER NOT NULL DEFAULT 0,
  imported_fixtures INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'paused')),
  last_imported_page INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (league_id, season)
);

CREATE INDEX IF NOT EXISTS idx_historical_imports_status ON historical_imports(status);
CREATE INDEX IF NOT EXISTS idx_historical_imports_league ON historical_imports(league_id);

COMMENT ON TABLE historical_imports IS 'Resumable per-league historical import progress tracker (EPIC 53 Stage D).';
