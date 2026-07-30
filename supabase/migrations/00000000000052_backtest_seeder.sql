-- Backtest Seeder Migration
-- Adds source tracking, backtest_summary table, and live_start_date

ALTER TABLE daily_picks ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'live';
ALTER TABLE public_ledger ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'live';
CREATE TABLE IF NOT EXISTS backtest_summary (
  id INT PRIMARY KEY DEFAULT 1,
  seasons TEXT,
  total_matches INT,
  total_picks INT,
  win_rate FLOAT,
  roi FLOAT,
  brier FLOAT,
  avg_clv FLOAT,
  max_drawdown FLOAT,
  per_market JSONB,
  generated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE track_record ADD COLUMN IF NOT EXISTS live_start_date DATE;
