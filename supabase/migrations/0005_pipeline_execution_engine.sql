-- Sprint 5a: Pipeline Execution Engine
-- =======================================
-- Adds state tracking to matches table and creates pipeline_events log.
-- This is the operational backbone of the pipeline.

-- ==========================================
-- 1. Add pipeline state columns to matches
-- ==========================================
ALTER TABLE matches ADD COLUMN IF NOT EXISTS pipeline_state TEXT NOT NULL DEFAULT 'CREATED'
  CHECK (pipeline_state IN (
    'CREATED', 'FEATURES_READY', 'PREDICTED', 'OPENING_CAPTURED',
    'TRACKING', 'CLOSING_CAPTURED', 'SETTLED', 'CLV_READY',
    'LEDGER_WRITTEN', 'ARCHIVED'
  ));

ALTER TABLE matches ADD COLUMN IF NOT EXISTS pipeline_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS pipeline_last_event TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS pipeline_transition_reason TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS pipeline_previous_state TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS pipeline_mode TEXT NOT NULL DEFAULT 'LIVE'
  CHECK (pipeline_mode IN ('LIVE', 'REPLAY'));
ALTER TABLE matches ADD COLUMN IF NOT EXISTS pipeline_metadata JSONB DEFAULT '{}'::jsonb;

-- Index for pipeline health queries
CREATE INDEX IF NOT EXISTS idx_matches_pipeline_state ON matches(pipeline_state);
CREATE INDEX IF NOT EXISTS idx_matches_pipeline_mode ON matches(pipeline_mode);

-- ==========================================
-- 2. Pipeline Events Table (Event Sourcing)
-- ==========================================
CREATE TABLE IF NOT EXISTS pipeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- What changed
  fixture_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  step TEXT NOT NULL,
  
  -- State transition
  previous_state TEXT,
  new_state TEXT NOT NULL,
  event TEXT NOT NULL,
  reason TEXT NOT NULL,
  
  -- Timing
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_ms INTEGER NOT NULL DEFAULT 0,
  
  -- Execution context
  mode TEXT NOT NULL DEFAULT 'LIVE' CHECK (mode IN ('LIVE', 'REPLAY')),
  version INTEGER NOT NULL DEFAULT 0,
  success BOOLEAN NOT NULL DEFAULT true,
  
  -- Rich metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_pipeline_events_fixture ON pipeline_events(fixture_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_events_timestamp ON pipeline_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_events_step ON pipeline_events(step);
CREATE INDEX IF NOT EXISTS idx_pipeline_events_event ON pipeline_events(event);
CREATE INDEX IF NOT EXISTS idx_pipeline_events_success ON pipeline_events(success);
CREATE INDEX IF NOT EXISTS idx_pipeline_events_mode ON pipeline_events(mode);

-- Composite index for health dashboard
CREATE INDEX IF NOT EXISTS idx_pipeline_events_step_success ON pipeline_events(step, success, created_at DESC);

-- ==========================================
-- 3. Enforce state transitions at DB level
-- ==========================================
-- This is a safety net — the engine enforces in application logic,
-- but the DB also prevents impossible transitions.

CREATE OR REPLACE FUNCTION check_valid_pipeline_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow initial state
  IF OLD.pipeline_state IS NULL THEN
    RETURN NEW;
  END IF;

  -- Same state is always allowed (e.g., TRACKING → TRACKING for periodic updates)
  IF NEW.pipeline_state = OLD.pipeline_state THEN
    RETURN NEW;
  END IF;

  -- Allow admin override
  IF NEW.pipeline_transition_reason = 'admin_override' OR NEW.pipeline_transition_reason = 'replay' THEN
    RETURN NEW;
  END IF;

  -- Never-allowed transitions
  IF (OLD.pipeline_state = 'CREATED' AND NEW.pipeline_state IN ('SETTLED', 'ARCHIVED')) OR
     (OLD.pipeline_state = 'PREDICTED' AND NEW.pipeline_state = 'ARCHIVED') OR
     (OLD.pipeline_state = 'CLV_READY' AND NEW.pipeline_state IN ('PREDICTED', 'CREATED')) OR
     (OLD.pipeline_state = 'LEDGER_WRITTEN' AND NEW.pipeline_state IN ('PREDICTED', 'SETTLED')) OR
     (OLD.pipeline_state = 'CREATED' AND NEW.pipeline_state = 'PREDICTED') OR
     (OLD.pipeline_state = 'PREDICTED' AND NEW.pipeline_state IN ('TRACKING', 'SETTLED')) OR
     (OLD.pipeline_state = 'TRACKING' AND NEW.pipeline_state = 'SETTLED') OR
     (OLD.pipeline_state = 'OPENING_CAPTURED' AND NEW.pipeline_state = 'SETTLED') OR
     (OLD.pipeline_state = 'CLOSING_CAPTURED' AND NEW.pipeline_state IN ('CLV_READY', 'LEDGER_WRITTEN')) OR
     (OLD.pipeline_state = 'SETTLED' AND NEW.pipeline_state IN ('LEDGER_WRITTEN', 'ARCHIVED')) OR
     (OLD.pipeline_state = 'CLV_READY' AND NEW.pipeline_state = 'ARCHIVED') OR
     (OLD.pipeline_state = 'SETTLED' AND NEW.pipeline_state = 'ARCHIVED') THEN
    RAISE EXCEPTION 'Invalid pipeline transition: % → %', OLD.pipeline_state, NEW.pipeline_state;
  END IF;

  -- Version must increase
  IF NEW.pipeline_version <= OLD.pipeline_version THEN
    RAISE EXCEPTION 'Pipeline version must increase: % → %', OLD.pipeline_version, NEW.pipeline_version;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists, then recreate
DROP TRIGGER IF EXISTS trg_check_pipeline_transition ON matches;
CREATE TRIGGER trg_check_pipeline_transition
  BEFORE UPDATE OF pipeline_state ON matches
  FOR EACH ROW
  EXECUTE FUNCTION check_valid_pipeline_transition();

-- ==========================================
-- 4. Pipeline Health View
-- ==========================================
CREATE OR REPLACE VIEW view_pipeline_health AS
SELECT
  -- Count by state
  COALESCE((SELECT jsonb_object_agg(pipeline_state, count)
    FROM (SELECT pipeline_state, COUNT(*) as count FROM matches GROUP BY pipeline_state) sub), '{}'::jsonb) as by_state,

  -- Success/failure by step (last 7 days)
  COALESCE((SELECT jsonb_object_agg(step, jsonb_build_object(
    'total', total,
    'success', success,
    'failed', failed
  ))
    FROM (
      SELECT step, 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE success = true) as success,
        COUNT(*) FILTER (WHERE success = false) as failed
      FROM pipeline_events
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY step
    ) sub), '{}'::jsonb) as by_step,

  -- Latency percentiles by step
  COALESCE((SELECT jsonb_object_agg(step, jsonb_build_object(
    'avg_ms', ROUND(AVG(duration_ms)),
    'p50_ms', ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms)),
    'p99_ms', ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms))
  ))
    FROM (
      SELECT step, duration_ms
      FROM pipeline_events
      WHERE success = true
        AND created_at >= NOW() - INTERVAL '7 days'
    ) sub
    GROUP BY step), '{}'::jsonb) as latency;

-- ==========================================
-- 5. Function: Get Transition Timeline for Fixture
-- ==========================================
CREATE OR REPLACE FUNCTION get_fixture_timeline(p_fixture_id UUID)
RETURNS TABLE(
  version INTEGER,
  event TEXT,
  from_state TEXT,
  to_state TEXT,
  reason TEXT,
  duration_ms INTEGER,
  success BOOLEAN,
  timestamp TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pe.version,
    pe.event,
    pe.previous_state,
    pe.new_state,
    pe.reason,
    pe.duration_ms,
    pe.success,
    pe.timestamp
  FROM pipeline_events pe
  WHERE pe.fixture_id = p_fixture_id
  ORDER BY pe.version ASC;
END;
$$ LANGUAGE plpgsql;