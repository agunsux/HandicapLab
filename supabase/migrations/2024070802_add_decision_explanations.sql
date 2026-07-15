-- Migration: 20240708_add_decision_explanations.sql
-- Purpose: Adds storage for Module 4 Decision Explainability Engine

CREATE TABLE IF NOT EXISTS decision_explanations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_id VARCHAR(100) NOT NULL,
    explanation_version VARCHAR(10) NOT NULL DEFAULT 'v1.0',
    builder_version VARCHAR(10) NOT NULL DEFAULT '1.0.0',
    decision_schema_version VARCHAR(10) NOT NULL DEFAULT 'v1',
    completeness_score INTEGER NOT NULL DEFAULT 0,
    explanation JSONB NOT NULL,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for querying by decision and monitoring metrics
CREATE INDEX IF NOT EXISTS idx_decision_explanations_decision_id 
    ON decision_explanations(decision_id);

CREATE INDEX IF NOT EXISTS idx_decision_explanations_generated_at 
    ON decision_explanations(generated_at);

CREATE INDEX IF NOT EXISTS idx_decision_explanations_completeness 
    ON decision_explanations(completeness_score);
