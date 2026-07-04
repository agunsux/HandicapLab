-- Phase 4: Trading & Performance Layer
-- Location: supabase/migrations/00000000000004_phase4_trading_performance.sql

-- Public Prediction Ledger
CREATE TABLE IF NOT EXISTS public.prediction_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_snapshot_id UUID,
  match_id TEXT NOT NULL,
  competition_id INTEGER,
  published_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  market VARCHAR(50) NOT NULL,
  selection VARCHAR(50),
  odds_at_prediction DOUBLE PRECISION,
  confidence NUMERIC,
  model_version VARCHAR(100) NOT NULL,
  result_status VARCHAR(20) DEFAULT 'pending' NOT NULL,
  settled_at TIMESTAMPTZ,
  roi DOUBLE PRECISION,
  verified BOOLEAN DEFAULT FALSE NOT NULL,
  decision VARCHAR(20) DEFAULT 'SKIP',
  decision_reason TEXT DEFAULT 'Does not meet EV/confidence criteria',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_ledger_match_market UNIQUE (match_id, market)
);
CREATE INDEX IF NOT EXISTS idx_prediction_ledger_match_id ON public.prediction_ledger(match_id);
CREATE INDEX IF NOT EXISTS idx_prediction_ledger_competition_id ON public.prediction_ledger(competition_id);
CREATE INDEX IF NOT EXISTS idx_prediction_ledger_result_status ON public.prediction_ledger(result_status);
ALTER TABLE public.prediction_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Prediction ledger entries are viewable by everyone" ON public.prediction_ledger FOR SELECT USING (true);

-- Prediction Decisions
CREATE TABLE IF NOT EXISTS public.prediction_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_ledger_id UUID REFERENCES public.prediction_ledger(id) ON DELETE CASCADE NOT NULL,
  decision VARCHAR(20) NOT NULL, -- BET / SKIP
  reason_category VARCHAR(100) NOT NULL,
  reason_text TEXT NOT NULL,
  confidence_score NUMERIC,
  edge_score NUMERIC,
  expected_value NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_decision_ledger UNIQUE (prediction_ledger_id)
);
CREATE INDEX IF NOT EXISTS idx_prediction_decisions_ledger ON public.prediction_decisions(prediction_ledger_id);
CREATE INDEX IF NOT EXISTS idx_prediction_decisions_decision ON public.prediction_decisions(decision);
ALTER TABLE public.prediction_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Prediction decisions are viewable by everyone" ON public.prediction_decisions FOR SELECT USING (true);

-- Paper Trading Config
CREATE TABLE IF NOT EXISTS public.paper_trading_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  starting_bankroll NUMERIC DEFAULT 1000.0,
  unit_size NUMERIC DEFAULT 10.0,
  max_stake_percentage NUMERIC DEFAULT 5.0,
  min_edge_threshold NUMERIC DEFAULT 2.0,
  min_confidence_threshold NUMERIC DEFAULT 70.0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.paper_trading_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY paper_trading_config_public_read ON public.paper_trading_config FOR SELECT USING (true);

-- Seed default config if empty
INSERT INTO public.paper_trading_config (starting_bankroll, unit_size, max_stake_percentage, min_edge_threshold, min_confidence_threshold)
SELECT 1000.0, 10.0, 5.0, 2.0, 70.0
WHERE NOT EXISTS (SELECT 1 FROM public.paper_trading_config);

-- Paper Trades Table
CREATE TABLE IF NOT EXISTS public.paper_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id TEXT,
  competition_id TEXT,
  market_type TEXT,
  prediction_id UUID,
  odds DOUBLE PRECISION,
  stake DOUBLE PRECISION,
  status TEXT DEFAULT 'pending',
  pnl DOUBLE PRECISION,
  closing_clv DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  market_subtype TEXT,
  selection VARCHAR(50),
  entry_odds DOUBLE PRECISION,
  opening_odds DOUBLE PRECISION,
  cohort_tag TEXT DEFAULT 'GENERAL',
  profit NUMERIC,
  is_win BOOLEAN,
  clv DOUBLE PRECISION,
  brier_score DOUBLE PRECISION,
  signal_id UUID REFERENCES public.signals(id) ON DELETE CASCADE,
  result TEXT,
  bankroll_after NUMERIC,
  drawdown NUMERIC,
  kelly_fraction NUMERIC,
  kelly_metadata JSONB,
  prediction_ledger_id UUID REFERENCES public.prediction_ledger(id) ON DELETE CASCADE,
  closing_odds DOUBLE PRECISION,
  stake_units DOUBLE PRECISION DEFAULT 1.0,
  expected_value DOUBLE PRECISION,
  edge_score DOUBLE PRECISION,
  pnl_units DOUBLE PRECISION,
  clv_percentage DOUBLE PRECISION,
  settled_at TIMESTAMPTZ,
  prediction_decision_id UUID REFERENCES public.prediction_decisions(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_paper_trades_prediction_ledger_id ON public.paper_trades(prediction_ledger_id);
CREATE INDEX IF NOT EXISTS idx_paper_trades_status ON public.paper_trades(status);
ALTER TABLE public.paper_trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY paper_trades_public_read ON public.paper_trades FOR SELECT USING (true);

-- Forensic Reports
CREATE TABLE IF NOT EXISTS public.forensic_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type VARCHAR(50) NOT NULL, -- 'daily', 'weekly'
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  signals_analyzed INTEGER DEFAULT 0,
  bets_taken INTEGER DEFAULT 0,
  skips INTEGER DEFAULT 0,
  roi_units NUMERIC DEFAULT 0.0,
  avg_clv NUMERIC DEFAULT 0.0,
  sample_size INTEGER DEFAULT 0,
  forensic_score NUMERIC DEFAULT 0.0,
  generated_content JSONB DEFAULT '{}'::jsonb,
  status VARCHAR(20) DEFAULT 'DRAFT',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.forensic_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Forensic reports are viewable by everyone" ON public.forensic_reports FOR SELECT USING (true);

-- Shadow Predictions (References core matches table)
CREATE TABLE IF NOT EXISTS public.shadow_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
  shadow_prob_home DOUBLE PRECISION NOT NULL,
  shadow_prob_draw DOUBLE PRECISION NOT NULL,
  shadow_prob_away DOUBLE PRECISION NOT NULL,
  simulated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.shadow_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shadow predictions viewable by everyone" ON public.shadow_predictions FOR SELECT USING (true);
