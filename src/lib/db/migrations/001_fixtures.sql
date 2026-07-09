-- 001_fixtures
-- Fixture storage — single source of truth for all match scheduling data.

CREATE TABLE IF NOT EXISTS fixtures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league VARCHAR(100) NOT NULL,
  season VARCHAR(20) NOT NULL,
  tournament_stage VARCHAR(100) NOT NULL DEFAULT 'regular_season',
  home_team VARCHAR(255) NOT NULL,
  away_team VARCHAR(255) NOT NULL,
  kickoff_time TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'upcoming',  -- 'upcoming','live','finished','cancelled'
  home_score INTEGER,
  away_score INTEGER,
  source VARCHAR(50) NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(league, season, home_team, away_team, kickoff_time)
);

CREATE INDEX idx_fixtures_kickoff ON fixtures(kickoff_time);
CREATE INDEX idx_fixtures_league ON fixtures(league);
CREATE INDEX idx_fixtures_status ON fixtures(status);
