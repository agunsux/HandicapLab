-- Model Version Registry (append-only)
CREATE TABLE IF NOT EXISTS model_versions (
  id TEXT PRIMARY KEY,
  market_scope TEXT NOT NULL DEFAULT 'AH',
  architecture_description TEXT NOT NULL,
  hypothesis TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  frozen_parameters JSONB NOT NULL,
  backtest_status TEXT NOT NULL DEFAULT 'PENDING',
  backtest_brier FLOAT,
  backtest_logloss FLOAT,
  backtest_ece FLOAT,
  backtest_clv_mean FLOAT,
  backtest_clv_pvalue FLOAT,
  backtest_realized_roi FLOAT,
  backtest_roi_ci_low FLOAT,
  backtest_roi_ci_high FLOAT,
  backtest_n_bets INT,
  validation_state TEXT NOT NULL DEFAULT 'RESEARCH_ONLY',
  superseded_by TEXT REFERENCES model_versions(id),
  notes TEXT
);

-- Prevent editing frozen_parameters
CREATE OR REPLACE FUNCTION prevent_frozen_edit()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.frozen_parameters IS DISTINCT FROM NEW.frozen_parameters THEN
    RAISE EXCEPTION 'frozen_parameters immutable after creation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_frozen_params ON model_versions;
CREATE TRIGGER enforce_frozen_params
  BEFORE UPDATE ON model_versions
  FOR EACH ROW EXECUTE FUNCTION prevent_frozen_edit();

-- Public predictions
CREATE TABLE IF NOT EXISTS public_predictions (
  id TEXT PRIMARY KEY,
  fixture_id TEXT NOT NULL,
  league_id TEXT NOT NULL,
  league_name TEXT NOT NULL,
  country TEXT,
  kickoff_at TIMESTAMPTZ NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  model_version TEXT NOT NULL REFERENCES model_versions(id),
  line FLOAT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('home', 'away')),
  fair_probability FLOAT NOT NULL,
  fair_odds FLOAT NOT NULL,
  devig_market_probability FLOAT NOT NULL,
  taken_odds FLOAT NOT NULL,
  closing_odds FLOAT,
  edge FLOAT NOT NULL,
  ev FLOAT NOT NULL,
  clv FLOAT,
  settlement_status TEXT NOT NULL DEFAULT 'PENDING',
  actual_outcome TEXT,
  profit_loss FLOAT,
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pp_fixture ON public_predictions(fixture_id);
CREATE INDEX IF NOT EXISTS idx_pp_status ON public_predictions(settlement_status);
CREATE INDEX IF NOT EXISTS idx_pp_kickoff ON public_predictions(kickoff_at);
CREATE INDEX IF NOT EXISTS idx_pp_model ON public_predictions(model_version);

-- RLS: public read, service write
ALTER TABLE public_predictions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read" ON public_predictions;
CREATE POLICY "public_read" ON public_predictions FOR SELECT USING (true);
DROP POLICY IF EXISTS "service_write" ON public_predictions;
CREATE POLICY "service_write" ON public_predictions FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

ALTER TABLE model_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_mv" ON model_versions;
CREATE POLICY "public_read_mv" ON model_versions FOR SELECT USING (true);
DROP POLICY IF EXISTS "service_write_mv" ON model_versions;
CREATE POLICY "service_write_mv" ON model_versions FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Seed EPIC 56 model variants
INSERT INTO model_versions (id, market_scope, architecture_description,
  hypothesis, frozen_parameters, backtest_status, validation_state,
  backtest_realized_roi, backtest_clv_mean, backtest_clv_pvalue, backtest_n_bets
) VALUES
('AH-dixoncoles-v1.0.0', 'AH',
 'Dixon-Coles bivariate goal matrix, time-weighted decay, rho per fold',
 'Baseline champion from EPIC 56 calibration tournament',
 '{"rho": -0.05, "shrinkage": 0.0, "decay_xi": 0.0019, "max_goals": 6}',
 'COMPLETE', 'RESEARCH_ONLY',
 -2.30, -0.0311, 0.555, 7225),
('AH-dixoncoles-shrink10-v1.0.1', 'AH',
 'Dixon-Coles + 10% shrinkage toward market',
 'Reduce overconfidence via 10% market blend',
 '{"rho": -0.05, "shrinkage": 0.10, "decay_xi": 0.0019, "max_goals": 6}',
 'COMPLETE', 'RESEARCH_ONLY',
 -2.00, 0.0086, 0.92, 5831),
('AH-dixoncoles-shrink20-v1.0.2', 'AH',
 'Dixon-Coles + 20% shrinkage toward market',
 'Reduce overconfidence via 20% market blend',
 '{"rho": -0.05, "shrinkage": 0.20, "decay_xi": 0.0019, "max_goals": 6}',
 'COMPLETE', 'RESEARCH_ONLY',
 -1.90, 0.0431, 0.63, 5805),
('AH-dixoncoles-shrink30-v1.0.3', 'AH',
 'Dixon-Coles + 30% shrinkage toward market',
 'Reduce overconfidence via 30% market blend',
 '{"rho": -0.05, "shrinkage": 0.30, "decay_xi": 0.0019, "max_goals": 6}',
 'COMPLETE', 'RESEARCH_ONLY',
 -2.23, 0.0705, 0.43, 5778)
ON CONFLICT (id) DO NOTHING;
