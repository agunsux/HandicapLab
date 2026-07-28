-- EPIC 53 Stage E — Per-League Calibration Store
-- Each league gets independent calibration parameters.
-- No parameter sharing between leagues (EPIC 53 §5).
-- Params are refreshed each season (or on-demand via UI).

CREATE TABLE IF NOT EXISTS league_calibrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id INTEGER NOT NULL,
  league_name TEXT NOT NULL,
  season INTEGER NOT NULL,

  -- Core params
  home_advantage NUMERIC(6,4) NOT NULL DEFAULT 0.0000,
  goal_expectation NUMERIC(6,4) NOT NULL DEFAULT 0.0000,
  draw_rate NUMERIC(6,4) NOT NULL DEFAULT 0.0000,
  btts_rate NUMERIC(6,4) NOT NULL DEFAULT 0.0000,
  over_1_5_rate NUMERIC(6,4) NOT NULL DEFAULT 0.0000,
  over_2_5_rate NUMERIC(6,4) NOT NULL DEFAULT 0.0000,
  over_3_5_rate NUMERIC(6,4) NOT NULL DEFAULT 0.0000,

  -- Market efficiency
  market_efficiency_clv NUMERIC(6,4) NOT NULL DEFAULT 0.0000,
  market_efficiency_brier NUMERIC(6,4) NOT NULL DEFAULT 0.0000,

  -- Calibration quality
  calibration_brier NUMERIC(6,4) NOT NULL DEFAULT 0.0000,
  calibration_log_loss NUMERIC(6,4) NOT NULL DEFAULT 0.0000,
  calibration_ece NUMERIC(6,4) NOT NULL DEFAULT 0.0000,

  -- Performance
  roi_historical NUMERIC(6,4) NOT NULL DEFAULT 0.0000,
  clv_avg NUMERIC(6,4) NOT NULL DEFAULT 0.0000,

  -- Metadata
  samples_count INTEGER NOT NULL DEFAULT 0,
  calibration_version TEXT NOT NULL DEFAULT '1.0',
  calibrated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (league_id, season)
);

CREATE INDEX IF NOT EXISTS idx_league_calibrations_season ON league_calibrations(season);
CREATE INDEX IF NOT EXISTS idx_league_calibrations_league ON league_calibrations(league_id);

COMMENT ON TABLE league_calibrations IS 'Per-league independent calibration parameters. No sharing between leagues (EPIC 53 §5).';
