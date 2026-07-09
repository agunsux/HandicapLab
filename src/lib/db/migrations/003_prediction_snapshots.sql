-- 003_prediction_snapshots
-- Immutable record of every model prediction.
-- Generated before the match outcome is known.

CREATE TABLE IF NOT EXISTS prediction_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id UUID NOT NULL REFERENCES fixtures(id) ON DELETE CASCADE,
  model_version VARCHAR(50) NOT NULL,
  market_type VARCHAR(20) NOT NULL CHECK (market_type IN ('asian_handicap','over_under','moneyline')),
  line DECIMAL(10,4) NOT NULL DEFAULT 0,
  prediction_prob DECIMAL(10,6) NOT NULL,
  market_prob DECIMAL(10,6) NOT NULL,
  edge DECIMAL(10,6) NOT NULL,
  confidence DECIMAL(10,6) NOT NULL,
  odds_snapshot_id UUID NOT NULL REFERENCES odds_snapshots(id),
  input_data_hash VARCHAR(64) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prediction_fixture ON prediction_snapshots(fixture_id);
CREATE INDEX idx_prediction_model ON prediction_snapshots(model_version);
CREATE INDEX idx_prediction_timestamp ON prediction_snapshots(timestamp);

COMMENT ON COLUMN prediction_snapshots.input_data_hash IS 'SHA-256 of all inputs used for this prediction — enables full reproducibility';
