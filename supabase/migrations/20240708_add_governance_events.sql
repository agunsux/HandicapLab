-- Phase 4: Database Migrations for Governance Event Sourcing (Module 7)
-- Adhering to Forward-Only, Idempotent, and Immutable philosophy.

-- 1. Governance Event Store (The Single Source of Truth)
CREATE TABLE IF NOT EXISTS governance_events (
    event_id UUID PRIMARY KEY, -- ULID converted/stored as UUID in Postgres
    event_type VARCHAR(50) NOT NULL,
    aggregate_id UUID NOT NULL,
    correlation_id UUID NOT NULL,
    causation_id UUID NOT NULL,
    version INT NOT NULL,
    schema_version VARCHAR(10) NOT NULL,
    actor VARCHAR(100) NOT NULL,
    event_time TIMESTAMPTZ NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    payload JSONB NOT NULL,

    -- Database Constraints for Absolute Protection
    CONSTRAINT unique_aggregate_version UNIQUE (aggregate_id, version)
);

-- Note: idempotency_key is usually tracked in a separate command log table
CREATE TABLE IF NOT EXISTS governance_commands (
    command_id UUID PRIMARY KEY,
    idempotency_key VARCHAR(100) NOT NULL UNIQUE,
    correlation_id UUID NOT NULL,
    actor VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Read Model / Projection (Disposable)
-- Can be TRUNCATED and rebuilt from governance_events at any time.
CREATE TABLE IF NOT EXISTS decision_read_model (
    decision_id UUID PRIMARY KEY,
    parent_decision_id UUID,
    override_chain_depth INT DEFAULT 0,
    
    correlation_id UUID NOT NULL,
    current_state VARCHAR(30) NOT NULL,
    
    assigned_to VARCHAR(100),
    assigned_at TIMESTAMPTZ,
    assignment_reason TEXT,
    
    prediction_probability NUMERIC(5, 4) NOT NULL,
    decision_confidence NUMERIC(5, 2) NOT NULL,
    final_verdict VARCHAR(20),
    
    created_at TIMESTAMPTZ NOT NULL,
    last_updated_at TIMESTAMPTZ NOT NULL,
    last_event_version INT NOT NULL,
    projection_hash VARCHAR(64)
);

-- Indexes for Dashboard Performance
CREATE INDEX IF NOT EXISTS idx_decision_correlation ON decision_read_model(correlation_id);
CREATE INDEX IF NOT EXISTS idx_decision_state ON decision_read_model(current_state);
CREATE INDEX IF NOT EXISTS idx_decision_assigned ON decision_read_model(assigned_to);
