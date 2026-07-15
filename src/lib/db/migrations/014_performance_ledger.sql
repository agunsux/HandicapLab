-- 014_performance_ledger
-- Epic 31A Section E: append-only store of generated performance metrics.
-- Each row is one reproducible metric snapshot (per model_version / filter),
-- labelled with sample_size, date_range and a confidence_note so small samples
-- are never mistaken for settled conclusions. Pure aggregates — no FK to live
-- pipeline rows, so this never constrains the existing settlement tables.

CREATE TABLE IF NOT EXISTS performance_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version VARCHAR(50),
  filter_label VARCHAR(100),           -- e.g. 'AH', 'OU', 'all', league name
  roi DECIMAL(10,4) NOT NULL,
  yield DECIMAL(10,4) NOT NULL,
  clv DECIMAL(10,4),                   -- null when no closing odds available
  profit_loss_units DECIMAL(12,4) NOT NULL,
  avg_odds DECIMAL(10,4),
  avg_edge DECIMAL(10,4),
  strike_rate DECIMAL(6,2) NOT NULL,
  max_drawdown DECIMAL(12,4) NOT NULL,
  sample_size INTEGER NOT NULL,
  date_range_start TIMESTAMPTZ,
  date_range_end TIMESTAMPTZ,
  confidence_note VARCHAR(120) NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_performance_ledger_model ON performance_ledger(model_version, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_performance_ledger_filter ON performance_ledger(filter_label, computed_at DESC);
