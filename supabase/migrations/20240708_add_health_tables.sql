-- Module 3: Model Health Monitor — Database Schema
-- Three tables: health_snapshots, health_events, golden_baselines

-- ─── Health Snapshots (Hourly immutable records) ──────────────────────────────
CREATE TABLE IF NOT EXISTS health_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    model_version VARCHAR(50) NOT NULL,
    brier_score DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    ece DOUBLE PRECISION NOT NULL DEFAULT 0,
    win_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
    avg_clv DOUBLE PRECISION,
    decision_accuracy DOUBLE PRECISION NOT NULL DEFAULT 0,
    missed_opportunity_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
    correct_skip_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
    avg_confidence DOUBLE PRECISION NOT NULL DEFAULT 0,
    data_quality_score DOUBLE PRECISION NOT NULL DEFAULT 1,
    decision_gate_pass_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
    skip_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
    health_score DOUBLE PRECISION NOT NULL DEFAULT 0,
    health_status VARCHAR(30) NOT NULL DEFAULT 'INSUFFICIENT_DATA',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_snapshots_model_version ON health_snapshots(model_version);
CREATE INDEX IF NOT EXISTS idx_health_snapshots_timestamp ON health_snapshots(timestamp DESC);

-- ─── Health Events (Audit trail / incident timeline) ─────────────────────────
CREATE TABLE IF NOT EXISTS health_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(60) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'info',
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    model_version VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_events_model_version ON health_events(model_version);
CREATE INDEX IF NOT EXISTS idx_health_events_timestamp ON health_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_health_events_event_type ON health_events(event_type);
CREATE INDEX IF NOT EXISTS idx_health_events_severity ON health_events(severity);

-- ─── Golden Baselines (Versioned, approved reference points) ──────────────────
CREATE TABLE IF NOT EXISTS golden_baselines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version VARCHAR(20) NOT NULL UNIQUE,
    league VARCHAR(100),
    season VARCHAR(20),
    approved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    approved_by VARCHAR(100),
    model_version VARCHAR(50) NOT NULL,
    calibration_method VARCHAR(50) NOT NULL,
    snapshot JSONB NOT NULL,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_golden_baselines_is_active ON golden_baselines(is_active);
CREATE INDEX IF NOT EXISTS idx_golden_baselines_version ON golden_baselines(version);
