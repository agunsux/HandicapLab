-- 005_evidence_ledger
-- Immutable, chained evidence records for every prediction.
-- Enables full reproducibility and audit of all claims.

CREATE TABLE IF NOT EXISTS evidence_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id UUID NOT NULL REFERENCES prediction_snapshots(id) ON DELETE CASCADE,
  settlement_id UUID REFERENCES settlements(id) ON DELETE SET NULL,
  fixture_id UUID NOT NULL REFERENCES fixtures(id) ON DELETE CASCADE,
  model_version VARCHAR(50) NOT NULL,
  market_type VARCHAR(20) NOT NULL,
  input_data_hash VARCHAR(64) NOT NULL,
  odds_snapshot_id UUID NOT NULL REFERENCES odds_snapshots(id),
  prediction_prob DECIMAL(10,6) NOT NULL,
  market_prob DECIMAL(10,6) NOT NULL,
  edge DECIMAL(10,6) NOT NULL,
  actual_outcome SMALLINT,
  profit DECIMAL(10,6),
  clv DECIMAL(10,6),
  chain_hash VARCHAR(64) NOT NULL,
  previous_entry_id UUID REFERENCES evidence_ledger(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_evidence_prediction ON evidence_ledger(prediction_id);
CREATE INDEX idx_evidence_fixture ON evidence_ledger(fixture_id);
CREATE INDEX idx_evidence_created ON evidence_ledger(created_at);
CREATE UNIQUE INDEX idx_evidence_chain ON evidence_ledger(previous_entry_id) WHERE previous_entry_id IS NULL;

COMMENT ON TABLE evidence_ledger IS 'Immutable audit trail: every prediction, settlement, and edge measurement. Chain-linked for integrity.';
COMMENT ON COLUMN evidence_ledger.chain_hash IS 'SHA-256(previous_entry_chain_hash + JSON of current record fields)';
