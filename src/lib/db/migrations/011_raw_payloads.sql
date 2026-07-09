-- 011_raw_payloads
-- Append-only storage for raw API responses from external providers.
-- Enables audit, replay, and debugging of every API interaction.

CREATE TABLE IF NOT EXISTS provider_payloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) NOT NULL,
  endpoint VARCHAR(500) NOT NULL,
  method VARCHAR(10) NOT NULL DEFAULT 'GET',
  status_code INTEGER NOT NULL DEFAULT 200,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_ms INTEGER NOT NULL DEFAULT 0,
  payload_json JSONB NOT NULL,
  checksum VARCHAR(64) NOT NULL,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_provider_payloads_provider ON provider_payloads(provider, created_at DESC);
CREATE INDEX idx_provider_payloads_checksum ON provider_payloads(checksum);
CREATE INDEX idx_provider_payloads_requested ON provider_payloads(requested_at DESC);

COMMENT ON TABLE provider_payloads IS 'Append-only raw API response storage for audit and replay';
COMMENT ON COLUMN provider_payloads.checksum IS 'SHA-256 of payload_json for integrity verification';
COMMENT ON COLUMN provider_payloads.error IS 'Error message if the request failed (status_code will reflect the error)';
