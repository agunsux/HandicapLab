-- 006_evaluation_runs
-- Snapshots of evaluation results for tracking model performance over time.
-- Each run captures the state of all metrics at a point in time.

CREATE TABLE IF NOT EXISTS evaluation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  window_label VARCHAR(20) NOT NULL,  -- '30d','90d','180d'
  total_predictions INTEGER NOT NULL DEFAULT 0,
  settled_predictions INTEGER NOT NULL DEFAULT 0,
  roi DECIMAL(10,6),
  avg_clv DECIMAL(10,6),
  clv_p_value DECIMAL(10,6),
  ece DECIMAL(10,6),
  brier_score DECIMAL(10,6),
  log_loss DECIMAL(10,6),
  sharpe_ratio DECIMAL(10,6),
  sortino_ratio DECIMAL(10,6),
  max_drawdown DECIMAL(10,6),
  bootstrap_roi_lower DECIMAL(10,6),
  bootstrap_roi_upper DECIMAL(10,6),
  meets_minimum BOOLEAN NOT NULL DEFAULT FALSE,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_evaluation_winddow ON evaluation_runs(window_label, evaluated_at);
