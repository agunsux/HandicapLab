-- 002_odds_snapshots
-- Immutable, append-only odds movement storage.
-- Every odds change is recorded as a new row. No updates, no deletes.

CREATE TABLE IF NOT EXISTS odds_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id UUID NOT NULL REFERENCES fixtures(id) ON DELETE CASCADE,
  bookmaker VARCHAR(50) NOT NULL DEFAULT 'pinnacle',
  market_type VARCHAR(20) NOT NULL CHECK (market_type IN ('asian_handicap','over_under','moneyline')),
  line DECIMAL(10,4) NOT NULL DEFAULT 0,
  price_home DECIMAL(10,4) NOT NULL,
  price_away DECIMAL(10,4) NOT NULL,
  price_draw DECIMAL(10,4),  -- null for two-way markets (AH, OU)
  captured_at TIMESTAMPTZ NOT NULL,
  chain_hash VARCHAR(64) NOT NULL,
  previous_snapshot_id UUID REFERENCES odds_snapshots(id),
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_odds_snapshots_fixture ON odds_snapshots(fixture_id, captured_at);
CREATE INDEX idx_odds_snapshots_captured ON odds_snapshots(captured_at);
CREATE INDEX idx_odds_snapshots_market ON odds_snapshots(fixture_id, market_type, line);

-- Prevent tampering: ensure chain integrity at database level
COMMENT ON COLUMN odds_snapshots.chain_hash IS 'SHA-256 of record fields + previous chain_hash for audit trail';
