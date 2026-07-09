-- 010_provider_logs
-- Append-only log of all provider interactions for observability and debugging.
-- Every HTTP request/response cycle is recorded here.

CREATE TABLE IF NOT EXISTS provider_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) NOT NULL,
  endpoint VARCHAR(500) NOT NULL,
  method VARCHAR(10) NOT NULL,
  status_code INTEGER,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  level VARCHAR(10) NOT NULL DEFAULT 'INFO' CHECK (level IN ('INFO', 'WARN', 'ERROR')),
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_provider_logs_provider ON provider_logs(provider, created_at DESC);
CREATE INDEX idx_provider_logs_level ON provider_logs(level, created_at DESC);
CREATE INDEX idx_provider_logs_created ON provider_logs(created_at DESC);

COMMENT ON TABLE provider_logs IS 'Append-only log of all provider HTTP interactions for observability';
COMMENT ON COLUMN provider_logs.metadata IS 'Free-form JSON payload with request/response details';
