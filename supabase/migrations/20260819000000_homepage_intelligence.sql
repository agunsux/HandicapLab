-- ============================================================================
-- EPIC: Homepage Intelligence Layer — Backtest Persistence + Live Opportunity
-- Materialized result tables with full provenance.
-- Every statistic on the homepage must originate from these tables (real
-- computations from verified Gold Layer data), never from hardcoded values.
-- ============================================================================

-- 1. backtest_runs — one row per completed backtest execution (provenance)
CREATE TABLE IF NOT EXISTS public.backtest_runs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_key          TEXT NOT NULL UNIQUE,
  dataset_version  TEXT NOT NULL,
  dataset_hash     TEXT,
  model_version    TEXT NOT NULL,
  backtest_version TEXT NOT NULL DEFAULT 'walk-forward-v1',
  methodology      TEXT NOT NULL DEFAULT 'walk-forward-expanding-window',
  window_start     DATE NOT NULL,
  window_end       DATE NOT NULL,
  min_edge_pct     NUMERIC(6,2) NOT NULL DEFAULT 3.0,
  min_confidence   NUMERIC(6,2) NOT NULL DEFAULT 70.0,
  status           TEXT NOT NULL CHECK (status IN ('READY','COMPLETE','BLOCKED','RUNNING')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at     TIMESTAMPTZ
);
ALTER TABLE public.backtest_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "backtest_runs public read" ON public.backtest_runs FOR SELECT USING (true);

-- 2. backtest_summary_metrics — headline metrics per run
CREATE TABLE IF NOT EXISTS public.backtest_summary_metrics (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id         UUID NOT NULL REFERENCES public.backtest_runs(id) ON DELETE CASCADE,
  matches_tested INTEGER NOT NULL,
  total_bets     INTEGER NOT NULL,
  win_rate       NUMERIC(8,4),
  profit_units   NUMERIC(12,4),
  roi_pct        NUMERIC(10,4),
  avg_ev_pct     NUMERIC(10,4),
  avg_clv_pct    NUMERIC(10,4),
  brier_score    NUMERIC(10,4),
  log_loss       NUMERIC(10,4),
  max_drawdown   NUMERIC(10,4),
  avg_odds       NUMERIC(10,4),
  stake_units    NUMERIC(14,4),
  ci_95_low      NUMERIC(10,4),
  ci_95_high     NUMERIC(10,4),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.backtest_summary_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "backtest summary public read" ON public.backtest_summary_metrics FOR SELECT USING (true);

-- 3. backtest_market_results — market-level (ML / AH / OU / BTTS) metrics
CREATE TABLE IF NOT EXISTS public.backtest_market_results (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id        UUID NOT NULL REFERENCES public.backtest_runs(id) ON DELETE CASCADE,
  market        TEXT NOT NULL CHECK (market IN ('ML','AH','OU','BTTS')),
  total_bets    INTEGER NOT NULL,
  win_rate      NUMERIC(8,4),
  profit_units  NUMERIC(12,4),
  roi_pct       NUMERIC(10,4),
  avg_clv_pct   NUMERIC(10,4),
  brier_score   NUMERIC(10,4),
  avg_edge_pct  NUMERIC(10,4),
  avg_ev_pct    NUMERIC(10,4),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (run_id, market)
);
ALTER TABLE public.backtest_market_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "backtest markets public read" ON public.backtest_market_results FOR SELECT USING (true);

-- 4. backtest_league_results — league-level metrics
CREATE TABLE IF NOT EXISTS public.backtest_league_results (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id       UUID NOT NULL REFERENCES public.backtest_runs(id) ON DELETE CASCADE,
  league_id    TEXT NOT NULL,
  total_bets   INTEGER NOT NULL,
  win_rate     NUMERIC(8,4),
  profit_units NUMERIC(12,4),
  roi_pct      NUMERIC(10,4),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (run_id, league_id)
);
ALTER TABLE public.backtest_league_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "backtest leagues public read" ON public.backtest_league_results FOR SELECT USING (true);

-- 5. backtest_season_results — season-level metrics
CREATE TABLE IF NOT EXISTS public.backtest_season_results (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id       UUID NOT NULL REFERENCES public.backtest_runs(id) ON DELETE CASCADE,
  season       TEXT NOT NULL,
  total_bets   INTEGER NOT NULL,
  win_rate     NUMERIC(8,4),
  profit_units NUMERIC(12,4),
  roi_pct      NUMERIC(10,4),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (run_id, season)
);
ALTER TABLE public.backtest_season_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "backtest seasons public read" ON public.backtest_season_results FOR SELECT USING (true);

-- 6. backtest_equity_curve — one row per settled bet (drawdown & charting)
CREATE TABLE IF NOT EXISTS public.backtest_equity_curve (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id         UUID NOT NULL REFERENCES public.backtest_runs(id) ON DELETE CASCADE,
  seq            INTEGER NOT NULL,
  match_date     DATE NOT NULL,
  league_id      TEXT NOT NULL,
  market         TEXT NOT NULL,
  selection      TEXT NOT NULL,
  line           NUMERIC(8,2),
  entry_odds     NUMERIC(10,4) NOT NULL,
  closing_odds   NUMERIC(10,4),
  model_prob     NUMERIC(10,4) NOT NULL,
  outcome        TEXT NOT NULL CHECK (outcome IN ('WIN','HALF_WIN','PUSH','HALF_LOSS','LOSS')),
  pnl_units      NUMERIC(10,4) NOT NULL,
  cumulative_pnl NUMERIC(14,4) NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.backtest_equity_curve ENABLE ROW LEVEL SECURITY;
CREATE POLICY "backtest equity public read" ON public.backtest_equity_curve FOR SELECT USING (true);

-- 7. model_calibration_results — expected vs actual win rate per bucket
CREATE TABLE IF NOT EXISTS public.model_calibration_results (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id            UUID NOT NULL REFERENCES public.backtest_runs(id) ON DELETE CASCADE,
  bucket_label      TEXT NOT NULL,
  bucket_low        NUMERIC(6,4) NOT NULL,
  bucket_high       NUMERIC(6,4) NOT NULL,
  model_probability NUMERIC(8,4) NOT NULL,
  actual_win_rate   NUMERIC(8,4) NOT NULL,
  sample_count      INTEGER NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.model_calibration_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "calibration public read" ON public.model_calibration_results FOR SELECT USING (true);

-- 8. pipeline_diagnostics — last execution state per stage (observability)
CREATE TABLE IF NOT EXISTS public.pipeline_diagnostics (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage       TEXT NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('OK','FAILED','PARTIAL','BLOCKED')),
  ran_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_ms INTEGER,
  details     JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (stage, ran_at)
);
ALTER TABLE public.pipeline_diagnostics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pipeline diagnostics public read" ON public.pipeline_diagnostics FOR SELECT USING (true);
