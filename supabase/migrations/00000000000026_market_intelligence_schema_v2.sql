-- Migration: 00000000000026_market_intelligence_schema_v2.sql
-- Goal: Set up Model Registry, Experiment Registry, Microstructure Logs, Immutable Prediction Ledger v3, Drift Logs, and Quant Sandbox tables.

-- 1. Model Registry
CREATE TABLE IF NOT EXISTS public.model_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id VARCHAR(100) UNIQUE NOT NULL,
  version VARCHAR(50) NOT NULL,
  description TEXT,
  role VARCHAR(50) DEFAULT 'challenger' NOT NULL, -- 'champion', 'challenger', 'shadow', 'retired'
  parameters JSONB DEFAULT '{}'::jsonb,
  performance_metrics JSONB DEFAULT '{}'::jsonb, -- ECE, Brier, ROI, Sharpe
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT valid_role CHECK (role IN ('champion', 'challenger', 'shadow', 'retired'))
);

-- 2. Experiment Registry
CREATE TABLE IF NOT EXISTS public.experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  status VARCHAR(50) DEFAULT 'active' NOT NULL, -- 'active', 'paused', 'completed'
  routing_key VARCHAR(100) DEFAULT 'match_id' NOT NULL,
  parameters JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT valid_status CHECK (status IN ('active', 'paused', 'completed'))
);

CREATE TABLE IF NOT EXISTS public.experiment_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id VARCHAR(100) REFERENCES public.experiments(experiment_id) ON DELETE CASCADE NOT NULL,
  bucket VARCHAR(50) NOT NULL, -- 'A', 'B', 'control'
  sample_size INTEGER DEFAULT 0 NOT NULL,
  brier_score NUMERIC(8,6) DEFAULT 0.0 NOT NULL,
  ece NUMERIC(8,6) DEFAULT 0.0 NOT NULL,
  roi NUMERIC(8,6) DEFAULT 0.0 NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT unique_experiment_bucket UNIQUE (experiment_id, bucket)
);

-- 3. Market Ingestion & Microstructure Logs
CREATE TABLE IF NOT EXISTS public.market_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
  bookmaker VARCHAR(100) NOT NULL,
  market_type VARCHAR(50) NOT NULL, -- 'ML', 'AH', 'OU'
  line NUMERIC(4,2), -- e.g. -0.50, 2.50. Null for ML.
  source VARCHAR(100) NOT NULL, -- e.g. 'api-football', 'the-odds-api', 'csv-import'
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.market_odds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID REFERENCES public.market_books(id) ON DELETE CASCADE NOT NULL,
  selection VARCHAR(100) NOT NULL, -- 'home', 'draw', 'away', 'over', 'under'
  decimal_odds NUMERIC(8,4) NOT NULL,
  implied_probability NUMERIC(8,6) NOT NULL,
  fair_probability NUMERIC(8,6), -- Margin-removed probability
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT valid_decimal_odds CHECK (decimal_odds > 1.0)
);

CREATE TABLE IF NOT EXISTS public.market_overround (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
  market_type VARCHAR(50) NOT NULL,
  bookmaker VARCHAR(100) NOT NULL,
  overround NUMERIC(8,6) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.market_closing_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
  bookmaker VARCHAR(100) NOT NULL,
  market_type VARCHAR(50) NOT NULL,
  selection VARCHAR(100) NOT NULL,
  line NUMERIC(4,2),
  closing_odds NUMERIC(8,4) NOT NULL,
  closing_timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT unique_closing_line_selection UNIQUE (match_id, bookmaker, market_type, selection, line)
);

CREATE TABLE IF NOT EXISTS public.market_microstructure_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
  market_type VARCHAR(50) NOT NULL,
  bookmaker VARCHAR(100) NOT NULL,
  spread NUMERIC(8,6) NOT NULL,
  overround NUMERIC(8,6) NOT NULL,
  sharp_price_lead_latency_sec INTEGER, -- time lag before soft bookmakers matched sharp lines
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 4. Immutable Prediction Ledger v3
CREATE TABLE IF NOT EXISTS public.prediction_ledger_v3 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_hash VARCHAR(64) UNIQUE NOT NULL,
  prior_hash VARCHAR(64),
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
  model_id VARCHAR(100) REFERENCES public.model_registry(model_id) ON DELETE RESTRICT NOT NULL,
  market_type VARCHAR(50) NOT NULL,
  selection VARCHAR(100) NOT NULL,
  line NUMERIC(4,2),
  raw_probability NUMERIC(8,6) NOT NULL,
  calibrated_probability NUMERIC(8,6) NOT NULL,
  market_odds NUMERIC(8,4) NOT NULL,
  expected_value NUMERIC(8,6) NOT NULL,
  kelly_fraction NUMERIC(8,6) NOT NULL,
  risk_adjusted_stake NUMERIC(8,6) NOT NULL,
  feature_version VARCHAR(50) NOT NULL,
  feature_vector_snapshot JSONB NOT NULL,
  explainability_json JSONB NOT NULL,
  prediction_timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.prediction_settlements_v3 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_hash VARCHAR(64) REFERENCES public.prediction_ledger_v3(prediction_hash) ON DELETE CASCADE NOT NULL,
  status VARCHAR(50) NOT NULL, -- 'won', 'lost', 'void', 'half_won', 'half_lost'
  profit_loss NUMERIC(12,4) NOT NULL,
  closing_odds NUMERIC(8,4) NOT NULL,
  actual_clv NUMERIC(8,6) NOT NULL,
  brier_contribution NUMERIC(8,6) NOT NULL,
  logloss_contribution NUMERIC(8,6) NOT NULL,
  settled_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 5. Market Edges (The outputs from the Market Discrepancy Engine)
CREATE TABLE IF NOT EXISTS public.market_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
  market VARCHAR(50) NOT NULL, -- 'ML', 'AH', 'OU'
  selection VARCHAR(100) NOT NULL,
  bookmaker VARCHAR(100) NOT NULL,
  line NUMERIC(4,2),
  model_probability NUMERIC(8,6) NOT NULL,
  market_probability NUMERIC(8,6) NOT NULL, -- implied
  edge_raw NUMERIC(8,6) NOT NULL, -- model_prob * odds - 1
  edge_adjusted NUMERIC(8,6) NOT NULL, -- adjusted for confidence / volatility
  expected_value NUMERIC(8,6) NOT NULL,
  kelly_fraction NUMERIC(8,6) NOT NULL,
  confidence_score NUMERIC(5,2) NOT NULL, -- 0 to 100
  market_efficiency NUMERIC(8,6) NOT NULL,
  volatility_score NUMERIC(8,6) NOT NULL,
  recommended_stake NUMERIC(8,6) NOT NULL,
  signal_rank INTEGER NOT NULL,
  explanation_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 6. Rolling Bias Statistics
CREATE TABLE IF NOT EXISTS public.market_rolling_bias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  as_of_date DATE NOT NULL,
  segment_type VARCHAR(50) NOT NULL, -- 'bookmaker', 'league', 'favorite', 'underdog', 'home', 'away', 'draw'
  segment_value VARCHAR(100) NOT NULL, -- e.g. 'Pinnacle', 'EPL', 'favorite'
  sample_size INTEGER NOT NULL,
  avg_overround NUMERIC(8,6) NOT NULL,
  brier_score NUMERIC(8,6) NOT NULL,
  average_clv NUMERIC(8,6) NOT NULL,
  historical_profitability NUMERIC(8,6) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT unique_rolling_bias_segment UNIQUE (as_of_date, segment_type, segment_value)
);

-- 7. Performance Portfolios
CREATE TABLE IF NOT EXISTS public.portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  bankroll NUMERIC(12,2) NOT NULL,
  risk_tolerance NUMERIC(5,4) NOT NULL,
  max_exposure NUMERIC(5,4) NOT NULL,
  total_weight NUMERIC(5,4) NOT NULL,
  risk_score NUMERIC(5,4) NOT NULL,
  expected_roi NUMERIC(8,6) NOT NULL,
  expected_variance NUMERIC(8,6) NOT NULL,
  max_drawdown_estimate NUMERIC(5,4) NOT NULL,
  staking_model VARCHAR(50) NOT NULL,
  allocations_json JSONB NOT NULL -- Detailed array of { match_id, selection, stake_amount, weight, bookmaker, odds }
);

-- 8. Drift Monitoring Logs
CREATE TABLE IF NOT EXISTS public.drift_detection_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name VARCHAR(100) NOT NULL, -- 'feature_drift_psi', 'ece_drift', 'brier_drift'
  target_identifier VARCHAR(100) NOT NULL, -- feature name or model version
  drift_value NUMERIC(8,6) NOT NULL,
  critical_flag BOOLEAN DEFAULT FALSE NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 9. Sandbox Hypothesis Testing
CREATE TABLE IF NOT EXISTS public.quant_sandbox_hypotheses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hypothesis_code VARCHAR(100) UNIQUE NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  researcher VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'draft' NOT NULL, -- 'draft', 'testing', 'validated', 'rejected'
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.quant_sandbox_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hypothesis_code VARCHAR(100) REFERENCES public.quant_sandbox_hypotheses(hypothesis_code) ON DELETE CASCADE,
  backtest_parameters JSONB NOT NULL,
  brier_score NUMERIC(8,6) NOT NULL,
  sharpe_ratio NUMERIC(8,6) NOT NULL,
  roi NUMERIC(8,6) NOT NULL,
  max_drawdown NUMERIC(8,6) NOT NULL,
  git_commit VARCHAR(40),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 10. Indexes
CREATE INDEX IF NOT EXISTS idx_market_books_lookup ON public.market_books (match_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_market_odds_book ON public.market_odds (book_id);
CREATE INDEX IF NOT EXISTS idx_market_edges_lookup ON public.market_edges (match_id, expected_value DESC);
CREATE INDEX IF NOT EXISTS idx_market_rolling_bias_date ON public.market_rolling_bias (as_of_date DESC);
CREATE INDEX IF NOT EXISTS idx_market_closing_lines_match ON public.market_closing_lines (match_id);
CREATE INDEX IF NOT EXISTS idx_ledger_v3_match ON public.prediction_ledger_v3 (match_id);
CREATE INDEX IF NOT EXISTS idx_ledger_v3_hash ON public.prediction_ledger_v3 (prediction_hash);
CREATE INDEX IF NOT EXISTS idx_microstructure_match ON public.market_microstructure_logs (match_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_drift_metric ON public.drift_detection_logs (metric_name, timestamp DESC);

-- 11. RLS Enable
ALTER TABLE public.model_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiment_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_odds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_overround ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_closing_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_microstructure_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prediction_ledger_v3 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prediction_settlements_v3 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_rolling_bias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drift_detection_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quant_sandbox_hypotheses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quant_sandbox_runs ENABLE ROW LEVEL SECURITY;

-- 12. RLS Select Policies
CREATE POLICY "Allow public read model_registry" ON public.model_registry FOR SELECT USING (true);
CREATE POLICY "Allow public read experiments" ON public.experiments FOR SELECT USING (true);
CREATE POLICY "Allow public read experiment_metrics" ON public.experiment_metrics FOR SELECT USING (true);
CREATE POLICY "Allow public read market_books" ON public.market_books FOR SELECT USING (true);
CREATE POLICY "Allow public read market_odds" ON public.market_odds FOR SELECT USING (true);
CREATE POLICY "Allow public read market_overround" ON public.market_overround FOR SELECT USING (true);
CREATE POLICY "Allow public read market_closing_lines" ON public.market_closing_lines FOR SELECT USING (true);
CREATE POLICY "Allow public read market_microstructure_logs" ON public.market_microstructure_logs FOR SELECT USING (true);
CREATE POLICY "Allow public read prediction_ledger_v3" ON public.prediction_ledger_v3 FOR SELECT USING (true);
CREATE POLICY "Allow public read prediction_settlements_v3" ON public.prediction_settlements_v3 FOR SELECT USING (true);
CREATE POLICY "Allow public read market_edges" ON public.market_edges FOR SELECT USING (true);
CREATE POLICY "Allow public read market_rolling_bias" ON public.market_rolling_bias FOR SELECT USING (true);
CREATE POLICY "Allow public read portfolios" ON public.portfolios FOR SELECT USING (true);
CREATE POLICY "Allow public read drift_detection_logs" ON public.drift_detection_logs FOR SELECT USING (true);
CREATE POLICY "Allow public read quant_sandbox_hypotheses" ON public.quant_sandbox_hypotheses FOR SELECT USING (true);
CREATE POLICY "Allow public read quant_sandbox_runs" ON public.quant_sandbox_runs FOR SELECT USING (true);

-- 13. Seed Core Data (Model Registry, Experiments)
INSERT INTO public.model_registry (model_id, version, description, role, parameters)
VALUES
  ('prematch-v1', '1.0.0', 'Production Poisson model for matches', 'champion', '{"lambda_scale": 1.0}'::jsonb),
  ('prematch-v2-test', '1.1.0-beta', 'Challenger model with temperature scaling adjustments', 'challenger', '{"lambda_scale": 1.02, "temperature": 1.05}'::jsonb)
ON CONFLICT (model_id) DO NOTHING;

INSERT INTO public.experiments (experiment_id, name, status, routing_key, parameters)
VALUES
  ('staking_comparison', 'Compare Fractional Kelly vs Equal Risk Contribution', 'active', 'match_id', '{"buckets": ["A", "B"]}'::jsonb),
  ('calibration_scaling', 'Compare Platt Scaling vs Temperature Scaling', 'active', 'match_id', '{"buckets": ["A", "B"]}'::jsonb)
ON CONFLICT (experiment_id) DO NOTHING;

INSERT INTO public.experiment_metrics (experiment_id, bucket, sample_size, brier_score, ece, roi)
VALUES
  ('staking_comparison', 'A', 0, 0.0, 0.0, 0.0),
  ('staking_comparison', 'B', 0, 0.0, 0.0, 0.0),
  ('calibration_scaling', 'A', 0, 0.0, 0.0, 0.0),
  ('calibration_scaling', 'B', 0, 0.0, 0.0, 0.0)
ON CONFLICT DO NOTHING;
