-- EPIC 56 — League Efficiency & Adaptive Scheduler
-- Per-league efficiency metrics for dynamic quota allocation.
-- Efficiency Score = (ROI_contribution + CLV_contribution + Brier_quality + WinRate_boost)
--                   / API_Requests_Used * Prediction_Confidence_multiplier
--
-- Scheduler uses: EfficiencyScore × PriorityTier × FixtureVolume × SeasonStatus
-- to determine which leagues get quota each day.

CREATE TABLE IF NOT EXISTS league_efficiency (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id INTEGER NOT NULL UNIQUE,
  league_name TEXT NOT NULL,

  -- Raw performance metrics
  roi NUMERIC(8,4) DEFAULT 0,
  clv NUMERIC(8,4) DEFAULT 0,
  brier_score NUMERIC(8,4) DEFAULT 0.5,
  win_rate NUMERIC(5,2) DEFAULT 0,
  prediction_count INTEGER DEFAULT 0,
  avg_confidence NUMERIC(5,2) DEFAULT 0,

  -- Resource tracking
  api_requests_used INTEGER DEFAULT 0,
  avg_fixtures_per_week NUMERIC(6,2) DEFAULT 0,
  api_cost_per_prediction NUMERIC(10,4) DEFAULT 0,

  -- Computed scores (refreshed each scheduler run)
  raw_efficiency NUMERIC(10,6) DEFAULT 0,
  league_priority INTEGER DEFAULT 6,      -- 1 (highest) to 6 (lowest)
  season_status VARCHAR(20) DEFAULT 'unknown'
    CHECK (season_status IN ('active', 'off_season', 'unknown')),
  fixture_volume_7d INTEGER DEFAULT 0,    -- fixtures in next 7 days

  -- Per-league historical start season (e.g. 2019 for PL, 2017 for Bundesliga)
  historical_start_season INTEGER,

  -- Adaptive priority (composite of all factors, recalculated daily)
  adaptive_priority NUMERIC(10,6) DEFAULT 0,

  -- Weekly fixture tracking for volume estimation
  fixtures_next_1d INTEGER DEFAULT 0,
  fixtures_next_3d INTEGER DEFAULT 0,
  fixtures_next_7d INTEGER DEFAULT 0,

  -- Last active
  last_active_date DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_league_efficiency_adaptive ON league_efficiency(adaptive_priority DESC);
CREATE INDEX IF NOT EXISTS idx_league_efficiency_season ON league_efficiency(season_status);
CREATE INDEX IF NOT EXISTS idx_league_efficiency_active ON league_efficiency(last_active_date)
  WHERE last_active_date IS NOT NULL;

COMMENT ON TABLE league_efficiency IS 'Per-league efficiency metrics for adaptive scheduling (EPIC 56).';
