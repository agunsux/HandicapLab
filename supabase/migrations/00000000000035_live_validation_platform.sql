-- ========================================================
-- EPIC 35 — Live Validation Platform Schema Migration
-- ========================================================
-- Creates immutable tables for autonomous live validation:
-- 1. prediction_snapshots
-- 2. odds_snapshots
-- 3. settlements
-- 4. rolling_metrics
-- 5. calibration_history
-- 6. drift_events
-- 7. alert_history
-- 8. weekly_reports
--
-- Includes audit fields, versioning, idempotency keys, indexes,
-- and BEFORE UPDATE/DELETE triggers for engine-level immutability.

-- 1. prediction_snapshots
CREATE TABLE IF NOT EXISTS public.prediction_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id TEXT NOT NULL,
  league TEXT NOT NULL,
  season TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  kickoff TIMESTAMPTZ NOT NULL,
  
  -- Model Versioning
  model_version TEXT NOT NULL,
  feature_version TEXT NOT NULL,
  calibration_version TEXT NOT NULL,
  research_manifest_version TEXT NOT NULL,
  git_commit TEXT NOT NULL,
  prediction_timestamp TIMESTAMPTZ NOT NULL,
  
  -- Probabilities & Expected Goals
  home_prob NUMERIC(6,4) NOT NULL,
  draw_prob NUMERIC(6,4) NOT NULL,
  away_prob NUMERIC(6,4) NOT NULL,
  expected_goals_home NUMERIC(5,2) NOT NULL,
  expected_goals_away NUMERIC(5,2) NOT NULL,
  confidence NUMERIC(6,4) NOT NULL,
  expected_value NUMERIC(6,4) NOT NULL,
  
  -- Market Recommendations (JSONB)
  asian_handicap JSONB,
  over_under JSONB,
  moneyline JSONB,
  
  -- Prediction Odds Captured (JSONB array)
  prediction_odds JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Cryptographic Integrity & Audit
  idempotency_key TEXT UNIQUE NOT NULL,
  input_hash TEXT NOT NULL,
  chain_hash TEXT NOT NULL,
  previous_snapshot_id UUID,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_by TEXT NOT NULL DEFAULT 'prediction-scheduler',
  schema_version TEXT NOT NULL DEFAULT '1.0',
  correlation_id TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_prediction_snapshots_fixture ON public.prediction_snapshots(fixture_id);
CREATE INDEX IF NOT EXISTS idx_prediction_snapshots_kickoff ON public.prediction_snapshots(kickoff);
CREATE INDEX IF NOT EXISTS idx_prediction_snapshots_league ON public.prediction_snapshots(league);

-- 2. odds_snapshots
CREATE TABLE IF NOT EXISTS public.odds_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id TEXT NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('opening', 'prediction', 'closing')),
  market TEXT NOT NULL CHECK (market IN ('moneyline', 'asian_handicap', 'over_under')),
  line NUMERIC(5,2) NOT NULL DEFAULT 0.0,
  price_home NUMERIC(6,3) NOT NULL,
  price_away NUMERIC(6,3) NOT NULL,
  price_draw NUMERIC(6,3),
  bookmaker TEXT NOT NULL DEFAULT 'pinnacle',
  captured_at TIMESTAMPTZ NOT NULL,
  
  chain_hash TEXT NOT NULL,
  previous_snapshot_id UUID,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_by TEXT NOT NULL DEFAULT 'odds-tracker',
  schema_version TEXT NOT NULL DEFAULT '1.0',
  correlation_id TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_odds_snapshots_fixture_phase ON public.odds_snapshots(fixture_id, phase);

-- 3. settlements
CREATE TABLE IF NOT EXISTS public.settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id UUID NOT NULL REFERENCES public.prediction_snapshots(id),
  fixture_id TEXT NOT NULL,
  league TEXT NOT NULL,
  market TEXT NOT NULL CHECK (market IN ('moneyline', 'asian_handicap', 'over_under')),
  selection TEXT NOT NULL CHECK (selection IN ('home', 'draw', 'away', 'over', 'under')),
  line NUMERIC(5,2) NOT NULL,
  stake NUMERIC(10,2) NOT NULL DEFAULT 1.0,
  odds_taken NUMERIC(6,3) NOT NULL,
  closing_odds NUMERIC(6,3),
  home_score INT NOT NULL,
  away_score INT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('win', 'loss', 'push', 'half_win', 'half_loss', 'void')),
  units_returned NUMERIC(10,4) NOT NULL,
  profit NUMERIC(10,4) NOT NULL,
  roi NUMERIC(8,4) NOT NULL,
  clv NUMERIC(8,4),
  settled_at TIMESTAMPTZ NOT NULL,
  
  idempotency_key TEXT UNIQUE NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_by TEXT NOT NULL DEFAULT 'settlement-engine',
  schema_version TEXT NOT NULL DEFAULT '1.0',
  correlation_id TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_settlements_prediction ON public.settlements(prediction_id);
CREATE INDEX IF NOT EXISTS idx_settlements_fixture ON public.settlements(fixture_id);
CREATE INDEX IF NOT EXISTS idx_settlements_settled_at ON public.settlements(settled_at);

-- 4. rolling_metrics
CREATE TABLE IF NOT EXISTS public.rolling_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  as_of TIMESTAMPTZ NOT NULL,
  window_days INT NOT NULL CHECK (window_days IN (7, 30, 90, 365)),
  predictions INT NOT NULL,
  settled_bets INT NOT NULL,
  roi NUMERIC(8,4) NOT NULL,
  yield NUMERIC(8,4) NOT NULL,
  hit_rate NUMERIC(6,4) NOT NULL,
  avg_odds NUMERIC(6,3) NOT NULL,
  avg_expected_value NUMERIC(6,4) NOT NULL,
  avg_edge NUMERIC(6,4) NOT NULL,
  avg_clv NUMERIC(8,4),
  brier_score NUMERIC(6,4),
  log_loss NUMERIC(6,4),
  expected_goals_error NUMERIC(6,4),
  max_drawdown NUMERIC(8,4) NOT NULL,
  sharpe_ratio NUMERIC(8,4),
  kelly_efficiency NUMERIC(8,4),
  calibration_error NUMERIC(6,4),
  total_profit NUMERIC(12,4) NOT NULL,
  total_staked NUMERIC(12,4) NOT NULL,
  
  edge_distribution JSONB NOT NULL DEFAULT '[]'::jsonb,
  league_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  market_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_by TEXT NOT NULL DEFAULT 'rolling-metrics',
  schema_version TEXT NOT NULL DEFAULT '1.0',
  correlation_id TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rolling_metrics_as_of_window ON public.rolling_metrics(as_of, window_days);

-- 5. calibration_history
CREATE TABLE IF NOT EXISTS public.calibration_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  as_of TIMESTAMPTZ NOT NULL,
  window_days INT NOT NULL,
  sample_size INT NOT NULL,
  ece NUMERIC(6,4) NOT NULL,
  mce NUMERIC(6,4) NOT NULL,
  buckets JSONB NOT NULL DEFAULT '[]'::jsonb,
  ece_drift NUMERIC(6,4),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_by TEXT NOT NULL DEFAULT 'calibration-monitor',
  schema_version TEXT NOT NULL DEFAULT '1.0',
  correlation_id TEXT NOT NULL
);

-- 6. drift_events
CREATE TABLE IF NOT EXISTS public.drift_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  as_of TIMESTAMPTZ NOT NULL,
  dimension TEXT NOT NULL CHECK (dimension IN ('feature', 'prediction', 'probability', 'market', 'league')),
  metric TEXT NOT NULL,
  psi NUMERIC(6,4) NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('none', 'warning', 'critical')),
  reference_window_days INT NOT NULL,
  current_window_days INT NOT NULL,
  reference_sample_size INT NOT NULL,
  current_sample_size INT NOT NULL,
  detail TEXT NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_by TEXT NOT NULL DEFAULT 'drift-detector',
  schema_version TEXT NOT NULL DEFAULT '1.0',
  correlation_id TEXT NOT NULL
);

-- 7. alert_history
CREATE TABLE IF NOT EXISTS public.alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metric TEXT,
  val NUMERIC(10,4),
  threshold NUMERIC(10,4),
  channels_notified JSONB NOT NULL DEFAULT '[]'::jsonb,
  fired_at TIMESTAMPTZ NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_by TEXT NOT NULL DEFAULT 'alert-engine',
  schema_version TEXT NOT NULL DEFAULT '1.0',
  correlation_id TEXT NOT NULL
);

-- 8. weekly_reports
CREATE TABLE IF NOT EXISTS public.weekly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start TIMESTAMPTZ NOT NULL,
  week_end TIMESTAMPTZ NOT NULL,
  summary JSONB NOT NULL,
  confidence_distribution JSONB NOT NULL,
  league_comparison JSONB NOT NULL,
  market_comparison JSONB NOT NULL,
  best_cases JSONB NOT NULL,
  worst_cases JSONB NOT NULL,
  model_stability JSONB NOT NULL,
  recommendations JSONB NOT NULL,
  markdown TEXT NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_by TEXT NOT NULL DEFAULT 'weekly-report-generator',
  schema_version TEXT NOT NULL DEFAULT '1.0',
  correlation_id TEXT NOT NULL
);

-- Immutability Enforcement Function
CREATE OR REPLACE FUNCTION public.enforce_live_validation_immutability()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Immutability violation: Live validation records in table % cannot be updated or deleted.', TG_TABLE_NAME;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Attach Immutability Triggers
CREATE TRIGGER trg_immutable_prediction_snapshots
  BEFORE UPDATE OR DELETE ON public.prediction_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.enforce_live_validation_immutability();

CREATE TRIGGER trg_immutable_odds_snapshots
  BEFORE UPDATE OR DELETE ON public.odds_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.enforce_live_validation_immutability();

CREATE TRIGGER trg_immutable_settlements
  BEFORE UPDATE OR DELETE ON public.settlements
  FOR EACH ROW EXECUTE FUNCTION public.enforce_live_validation_immutability();

CREATE TRIGGER trg_immutable_rolling_metrics
  BEFORE UPDATE OR DELETE ON public.rolling_metrics
  FOR EACH ROW EXECUTE FUNCTION public.enforce_live_validation_immutability();

CREATE TRIGGER trg_immutable_calibration_history
  BEFORE UPDATE OR DELETE ON public.calibration_history
  FOR EACH ROW EXECUTE FUNCTION public.enforce_live_validation_immutability();

CREATE TRIGGER trg_immutable_drift_events
  BEFORE UPDATE OR DELETE ON public.drift_events
  FOR EACH ROW EXECUTE FUNCTION public.enforce_live_validation_immutability();

CREATE TRIGGER trg_immutable_alert_history
  BEFORE UPDATE OR DELETE ON public.alert_history
  FOR EACH ROW EXECUTE FUNCTION public.enforce_live_validation_immutability();

CREATE TRIGGER trg_immutable_weekly_reports
  BEFORE UPDATE OR DELETE ON public.weekly_reports
  FOR EACH ROW EXECUTE FUNCTION public.enforce_live_validation_immutability();
