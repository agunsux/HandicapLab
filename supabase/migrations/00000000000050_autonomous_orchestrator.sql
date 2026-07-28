-- EPIC 54 — Autonomous Prediction Orchestrator
--
-- Extends the fixture_states table with ENRICHMENT_PENDING, SETTLEMENT_PENDING,
-- METRICS_UPDATED states. Adds event_queue for event-driven processing,
-- audit_trail for structured observability, and league_evolution tracking.
--
-- Does NOT modify any existing tables — only adds new ones.

-- ─── Fixture Lifecycle (extends EPIC 53 fixture_states) ─────────────────────
-- New valid states: ENRICHMENT_PENDING, SNAPSHOT_COMPLETE, PREDICTION_GENERATED,
-- PRE_MATCH, SETTLEMENT_PENDING, METRICS_UPDATED.
-- Full lifecycle:
--   DISCOVERED
--     → HISTORICAL_READY
--       → ENRICHMENT_PENDING
--         → SNAPSHOT_PENDING (was SNAPSHOT_READY)
--           → SNAPSHOT_COMPLETE
--             → PREDICTION_GENERATED
--               → PRE_MATCH
--                 → LIVE
--                   → HALFTIME
--                     → FULLTIME
--                       → SETTLEMENT_PENDING
--                         → SETTLED
--                           → METRICS_UPDATED
--                             → ARCHIVED

-- The state CHECK on fixture_states is left unchanged (backward compatible).
-- New states are enforced at the application layer via fixtureState.ts.
-- A future migration can ALTER the CHECK if desired.

-- ─── Event Queue (Stage C) ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(40) NOT NULL,
  fixture_id TEXT,
  payload JSONB,
  priority INTEGER NOT NULL DEFAULT 0,  -- lower = higher priority
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  last_error TEXT,
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_queue_status ON event_queue(status, priority, scheduled_for)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_event_queue_fixture ON event_queue(fixture_id);

COMMENT ON TABLE event_queue IS 'Event-driven processing queue for autonomous pipeline. EPIC 54 Stage C.';

-- ─── Structured Audit Trail (Stage I) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  job_id TEXT NOT NULL,
  fixture_id TEXT,
  league_id INTEGER,
  trigger_source VARCHAR(40) NOT NULL,  -- 'scheduler', 'event_queue', 'cron', 'manual'
  state_transition VARCHAR(40),          -- e.g. 'DISCOVERED→SNAPSHOT_PENDING'
  event_type VARCHAR(40),               -- e.g. 'snapshot_due', 'settlement_available'
  provider VARCHAR(20),                  -- 'apifootball', 'oddspapi', null
  endpoint TEXT,
  duration_ms INTEGER,
  quota_consumed INTEGER DEFAULT 0,
  retry_count INTEGER DEFAULT 0,
  outcome VARCHAR(20) DEFAULT 'success'
    CHECK (outcome IN ('success', 'failure', 'skipped', 'partial')),
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_trail_timestamp ON audit_trail(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_trail_fixture ON audit_trail(fixture_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_event ON audit_trail(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_trail_job ON audit_trail(job_id);

COMMENT ON TABLE audit_trail IS 'Structured observability log for all pipeline operations. EPIC 54 Stage I.';

-- ─── League Evolution (Stage H) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS league_evolution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id INTEGER NOT NULL UNIQUE,
  league_name TEXT NOT NULL,
  season INTEGER NOT NULL,

  -- Certification level progresses: research → historical_imported → calibrated
  -- → building_track_record → verified
  certification VARCHAR(30) NOT NULL DEFAULT 'research'
    CHECK (certification IN ('research', 'historical_imported', 'calibrated', 'building_track_record', 'verified')),

  -- Coverage
  historical_coverage_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  prediction_count INTEGER NOT NULL DEFAULT 0,
  settled_matches INTEGER NOT NULL DEFAULT 0,
  total_fixtures_in_season INTEGER NOT NULL DEFAULT 0,

  -- Calibration quality
  calibration_brier NUMERIC(6,4),
  calibration_log_loss NUMERIC(6,4),
  calibration_ece NUMERIC(6,4),
  last_calibrated_at TIMESTAMPTZ,

  -- Performance
  roi NUMERIC(6,4),
  clv NUMERIC(6,4),
  win_rate NUMERIC(5,2),
  yield NUMERIC(6,4),

  -- Confidence trend (10 most recent predictions)
  confidence_trend JSONB,

  -- Samples
  min_samples_required INTEGER NOT NULL DEFAULT 200,

  -- Metadata
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_league_evolution_cert ON league_evolution(certification);
CREATE INDEX IF NOT EXISTS idx_league_evolution_roi ON league_evolution(roi DESC NULLS LAST);

COMMENT ON TABLE league_evolution IS 'Per-league evolution tracking & certification. EPIC 54 Stage H.';
