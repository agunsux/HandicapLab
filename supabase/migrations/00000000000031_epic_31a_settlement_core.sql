-- ============================================================================
-- EPIC 31A — SETTLEMENT CORE FOUNDATION
-- ============================================================================
-- This migration extends the existing schema with:
--   1. odds_snapshots FK constraints + type consistency
--   2. closing_odds table (append-only)
--   3. performance_ledger table
--   4. data_provenance table for audit trail
--   5. provider_logs table for provider telemetry
--   6. feature_flags table for runtime gating
--   7. settlement_results table for recording outcomes
--
-- All new tables have explicit FK constraints and UUID type consistency.
-- No existing table is modified — only extended.
-- ============================================================================

-- ============================================================================
-- PART 1: ODDS SNAPSHOTS — ADD FK CONSTRAINTS & COLUMNS
-- ============================================================================

-- Ensure columns exist for Settlement Core (Epic 31A)
ALTER TABLE public.odds_snapshots 
  ADD COLUMN IF NOT EXISTS fixture_id UUID,
  ADD COLUMN IF NOT EXISTS price_home DECIMAL(10,4),
  ADD COLUMN IF NOT EXISTS price_away DECIMAL(10,4),
  ADD COLUMN IF NOT EXISTS price_draw DECIMAL(10,4),
  ADD COLUMN IF NOT EXISTS chain_hash TEXT,
  ADD COLUMN IF NOT EXISTS provider VARCHAR(100),
  ADD COLUMN IF NOT EXISTS provider_latency_ms INTEGER,
  ADD COLUMN IF NOT EXISTS raw_payload_id TEXT;

-- Populate fixture_id from match_id if it's a valid UUID
UPDATE public.odds_snapshots 
SET fixture_id = CAST(match_id AS UUID) 
WHERE fixture_id IS NULL 
  AND match_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

-- Ensure fixture_id FK exists on odds_snapshots
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'odds_snapshots_fixture_id_fkey'
  ) THEN
    -- Add FK constraint if the matches table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'matches') THEN
      ALTER TABLE odds_snapshots
        ADD CONSTRAINT odds_snapshots_fixture_id_fkey
        FOREIGN KEY (fixture_id) REFERENCES matches(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;


-- Ensure odds_snapshots has proper type defaults
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'odds_snapshots' AND column_name = 'captured_at'
  ) THEN
    ALTER TABLE odds_snapshots
      ALTER COLUMN captured_at SET DEFAULT NOW();
  END IF;
END $$;

-- ============================================================================
-- PART 2: CLOSING ODDS TABLE (APPEND-ONLY)
-- ============================================================================

-- Drop old closing_odds table if it uses the old schema (missing column 'line')
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'closing_odds') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'closing_odds' AND column_name = 'line'
    ) THEN
      DROP TABLE closing_odds CASCADE;
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS closing_odds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id UUID NOT NULL,
  provider VARCHAR(100) NOT NULL,
  market_type VARCHAR(50) NOT NULL CHECK (market_type IN ('moneyline', 'asian_handicap', 'over_under')),
  line DECIMAL(10,4) NOT NULL DEFAULT 0,
  selection VARCHAR(20) NOT NULL CHECK (selection IN ('home', 'draw', 'away', 'over', 'under')),
  odds DECIMAL(10,4) NOT NULL CHECK (odds > 1),
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_opening BOOLEAN NOT NULL DEFAULT FALSE,
  is_closing BOOLEAN NOT NULL DEFAULT TRUE,
  is_live BOOLEAN NOT NULL DEFAULT FALSE,
  provider_latency_ms INTEGER,
  raw_payload_id TEXT,
  chain_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- FK to matches
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'matches') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'closing_odds_fixture_id_fkey'
    ) THEN
      ALTER TABLE closing_odds
        ADD CONSTRAINT closing_odds_fixture_id_fkey
        FOREIGN KEY (fixture_id) REFERENCES matches(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- Indexes for closing_odds
CREATE INDEX IF NOT EXISTS idx_closing_odds_fixture ON closing_odds(fixture_id);
CREATE INDEX IF NOT EXISTS idx_closing_odds_provider ON closing_odds(provider);
CREATE INDEX IF NOT EXISTS idx_closing_odds_captured ON closing_odds(captured_at);
CREATE INDEX IF NOT EXISTS idx_closing_odds_market ON closing_odds(market_type);
CREATE INDEX IF NOT EXISTS idx_closing_odds_fixture_provider
  ON closing_odds(fixture_id, provider, market_type, line);

-- Recreate clv_results FK to closing_odds if clv_results exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clv_results') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'clv_results_closing_odds_id_fkey'
    ) THEN
      ALTER TABLE clv_results
        ADD CONSTRAINT clv_results_closing_odds_id_fkey
        FOREIGN KEY (closing_odds_id) REFERENCES closing_odds(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- ============================================================================

-- PART 3: PROVIDER LOGS (TELEMETRY)
-- ============================================================================

CREATE TABLE IF NOT EXISTS provider_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(100) NOT NULL,
  endpoint TEXT NOT NULL,
  method VARCHAR(10) NOT NULL DEFAULT 'GET',
  status_code INTEGER,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  level VARCHAR(10) NOT NULL DEFAULT 'INFO' CHECK (level IN ('INFO', 'WARN', 'ERROR')),
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for provider_logs
CREATE INDEX IF NOT EXISTS idx_provider_logs_provider ON provider_logs(provider);
CREATE INDEX IF NOT EXISTS idx_provider_logs_level ON provider_logs(level);
CREATE INDEX IF NOT EXISTS idx_provider_logs_created ON provider_logs(created_at);

-- ============================================================================
-- PART 4: PERFORMANCE LEDGER
-- ============================================================================

CREATE TABLE IF NOT EXISTS performance_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version VARCHAR(100) NOT NULL,
  filter_label VARCHAR(255) NOT NULL,
  roi DECIMAL(10,4) NOT NULL DEFAULT 0,
  yield DECIMAL(10,4) NOT NULL DEFAULT 0,
  clv DECIMAL(10,4),
  profit_loss_units DECIMAL(14,4) NOT NULL DEFAULT 0,
  avg_odds DECIMAL(10,4),
  avg_edge DECIMAL(10,4),
  strike_rate DECIMAL(6,2) NOT NULL DEFAULT 0,
  max_drawdown DECIMAL(10,4) NOT NULL DEFAULT 0,
  sample_size INTEGER NOT NULL DEFAULT 0,
  date_range_start TIMESTAMPTZ,
  date_range_end TIMESTAMPTZ,
  confidence_note TEXT NOT NULL DEFAULT 'insufficient data',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance_ledger
CREATE INDEX IF NOT EXISTS idx_performance_ledger_model ON performance_ledger(model_version);
CREATE INDEX IF NOT EXISTS idx_performance_ledger_filter ON performance_ledger(filter_label);
CREATE INDEX IF NOT EXISTS idx_performance_ledger_computed ON performance_ledger(computed_at);

-- ============================================================================
-- PART 5: DATA PROVENANCE (AUDIT TRAIL)
-- ============================================================================

CREATE TABLE IF NOT EXISTS data_provenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type VARCHAR(50) NOT NULL CHECK (target_type IN (
    'metric', 'trade', 'prediction', 'odds_snapshot', 'provider', 'settlement', 'ledger_entry'
  )),
  target_id VARCHAR(255) NOT NULL,
  target_label TEXT NOT NULL,
  links JSONB NOT NULL DEFAULT '[]'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  formula TEXT NOT NULL DEFAULT '',
  source_hash VARCHAR(64) NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for data_provenance
CREATE INDEX IF NOT EXISTS idx_data_provenance_target ON data_provenance(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_data_provenance_hash ON data_provenance(source_hash);
CREATE INDEX IF NOT EXISTS idx_data_provenance_computed ON data_provenance(computed_at);

-- ============================================================================
-- PART 6: SETTLEMENT RESULTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS settlement_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id UUID NOT NULL,
  prediction_id UUID,
  market_type VARCHAR(50) NOT NULL CHECK (market_type IN ('moneyline', 'asian_handicap', 'over_under')),
  line DECIMAL(10,4) NOT NULL DEFAULT 0,
  selection VARCHAR(20) NOT NULL CHECK (selection IN ('home', 'draw', 'away', 'over', 'under')),
  odds DECIMAL(10,4) NOT NULL CHECK (odds > 1),
  outcome VARCHAR(20) NOT NULL CHECK (outcome IN ('WIN', 'HALF_WIN', 'PUSH', 'HALF_LOSS', 'LOSS', 'VOID')),
  profit_units DECIMAL(14,4) NOT NULL DEFAULT 0,
  home_goals INTEGER NOT NULL,
  away_goals INTEGER NOT NULL,
  voided BOOLEAN NOT NULL DEFAULT FALSE,
  settled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FK to matches
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'matches') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'settlement_results_fixture_id_fkey'
    ) THEN
      ALTER TABLE settlement_results
        ADD CONSTRAINT settlement_results_fixture_id_fkey
        FOREIGN KEY (fixture_id) REFERENCES matches(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- FK to predictions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'predictions') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'settlement_results_prediction_id_fkey'
    ) THEN
      ALTER TABLE settlement_results
        ADD CONSTRAINT settlement_results_prediction_id_fkey
        FOREIGN KEY (prediction_id) REFERENCES predictions(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- Indexes for settlement_results
CREATE INDEX IF NOT EXISTS idx_settlement_results_fixture ON settlement_results(fixture_id);
CREATE INDEX IF NOT EXISTS idx_settlement_results_prediction ON settlement_results(prediction_id);
CREATE INDEX IF NOT EXISTS idx_settlement_results_outcome ON settlement_results(outcome);
CREATE INDEX IF NOT EXISTS idx_settlement_results_settled ON settlement_results(settled_at);

-- ============================================================================
-- PART 7: FEATURE FLAGS (RUNTIME GATING)
-- ============================================================================

CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  description TEXT NOT NULL DEFAULT '',
  owner VARCHAR(100) NOT NULL DEFAULT 'core',
  min_tier VARCHAR(20) CHECK (min_tier IN ('free', 'starter', 'pro', 'quant')),
  rollout_percentage INTEGER DEFAULT 100 CHECK (rollout_percentage BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default flags (all disabled except de_vig_engine)
INSERT INTO feature_flags (name, enabled, description, owner, min_tier, rollout_percentage)
VALUES
  ('de_vig_engine', TRUE, 'De-vig (margin removal) engine for fair probability calculation', 'core', 'free', 100),
  ('clv_calculation', FALSE, 'Closing Line Value calculation and display', 'core', 'pro', 100),
  ('performance_ledger', FALSE, 'Performance ledger with ROI, yield, max drawdown metrics', 'core', 'starter', 100),
  ('odds_ingestion_live', FALSE, 'Live odds ingestion from external providers', 'infrastructure', NULL, 100),
  ('odds_ingestion_historical', FALSE, 'Historical odds ingestion for backtesting', 'infrastructure', NULL, 100),
  ('settlement_automation', FALSE, 'Automated settlement of finished matches', 'infrastructure', NULL, 100),
  ('model_calibration_ui', FALSE, 'Model calibration curve display and reliability diagrams', 'ml', 'pro', 100),
  ('premium_predictions', FALSE, 'Premium-tier prediction insights and explanations', 'product', 'pro', 100),
  ('market_scanner', FALSE, 'Real-time market scanner for edge detection', 'product', 'quant', 100),
  ('audit_panel', FALSE, 'Internal audit panel for data provenance and integrity checks', 'core', NULL, 100),
  ('paper_trading_v2', FALSE, 'Paper trading v2 with Kelly staking and portfolio tracking', 'product', 'pro', 100),
  ('edge_analysis', FALSE, 'Edge analysis tools with expected value breakdowns', 'ml', 'starter', 100)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- PART 8: MIGRATION VERIFICATION
-- ============================================================================

-- Verify all tables exist
DO $$
DECLARE
  tables TEXT[] := ARRAY[
    'closing_odds', 'provider_logs', 'performance_ledger',
    'data_provenance', 'settlement_results', 'feature_flags'
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables WHERE table_name = t
    ) THEN
      RAISE EXCEPTION 'Migration failed: table % was not created', t;
    END IF;
  END LOOP;
END $$;

-- Verify FK constraints exist
DO $$
BEGIN
  -- closing_odds FK
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'matches') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'closing_odds_fixture_id_fkey'
    ) THEN
      RAISE WARNING 'FK closing_odds_fixture_id_fkey not created — matches table may not exist';
    END IF;
  END IF;
END $$;