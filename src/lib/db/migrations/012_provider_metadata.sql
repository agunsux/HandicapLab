-- 012_provider_metadata
-- Add provider metadata columns to odds_snapshots for better tracking.
-- New migration — does not modify existing 002_odds_snapshots.sql.

ALTER TABLE odds_snapshots
  ADD COLUMN IF NOT EXISTS provider VARCHAR(50) NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS provider_version VARCHAR(20) NOT NULL DEFAULT '1.0',
  ADD COLUMN IF NOT EXISTS sport_key VARCHAR(50) NOT NULL DEFAULT 'soccer',
  ADD COLUMN IF NOT EXISTS raw_payload_id UUID REFERENCES provider_payloads(id);

CREATE INDEX IF NOT EXISTS idx_odds_snapshots_provider ON odds_snapshots(provider);
CREATE INDEX IF NOT EXISTS idx_odds_snapshots_sport ON odds_snapshots(sport_key);

COMMENT ON COLUMN odds_snapshots.provider IS 'Name of the odds provider (e.g. the-odds-api, pinnacle)';
COMMENT ON COLUMN odds_snapshots.provider_version IS 'Version of the provider API used';
COMMENT ON COLUMN odds_snapshots.sport_key IS 'Sport identifier from the provider (e.g. soccer_epl, basketball_nba)';
COMMENT ON COLUMN odds_snapshots.raw_payload_id IS 'Reference to the raw API response in provider_payloads table';
