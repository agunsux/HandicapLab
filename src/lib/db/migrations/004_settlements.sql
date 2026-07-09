-- 004_settlements
-- Outcome records for predictions. Linked to prediction_snapshots.
-- Created after the fixture result is known.

CREATE TABLE IF NOT EXISTS settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id UUID NOT NULL REFERENCES prediction_snapshots(id) ON DELETE CASCADE,
  fixture_id UUID NOT NULL REFERENCES fixtures(id) ON DELETE CASCADE,
  model_version VARCHAR(50) NOT NULL,
  actual_outcome SMALLINT,     -- 1 = win, 0 = loss, NULL = unsettled
  profit DECIMAL(10,6),        -- In units (1 = full stake)
  roi DECIMAL(10,6),           -- Return on investment for this bet
  clv DECIMAL(10,6),           -- Closing line value (positive means beat the market)
  settled_at TIMESTAMPTZ,
  is_settled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_settlements_prediction ON settlements(prediction_id);
CREATE INDEX idx_settlements_fixture ON settlements(fixture_id);
CREATE INDEX idx_settlements_settled ON settlements(is_settled);

COMMENT ON COLUMN settlements.clv IS 'CLV = closing_odds_market_prob - prediction_market_prob. Positive means model beat closing line.';
