-- Migration: 20240708_add_attribution_tables.sql
-- Purpose: Adds storage for Module 5 Decision Attribution & Driver Intelligence

-- 1. Decision Attributions (Stores both Phase 1 and Phase 2 JSON)
CREATE TABLE IF NOT EXISTS decision_attributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_id VARCHAR(100) NOT NULL UNIQUE,
    phase VARCHAR(20) NOT NULL DEFAULT 'DECISION_TIME',
    decision_dna_hash VARCHAR(64) NOT NULL,
    quality_score INTEGER NOT NULL DEFAULT 0,
    attribution JSONB NOT NULL,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    settled_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_decision_attributions_decision_id 
    ON decision_attributions(decision_id);

CREATE INDEX IF NOT EXISTS idx_decision_attributions_dna 
    ON decision_attributions(decision_dna_hash);

-- 2. Driver Statistics (Driver Intelligence Registry)
CREATE TABLE IF NOT EXISTS driver_statistics (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL,
    lifecycle VARCHAR(20) NOT NULL DEFAULT 'CANDIDATE',
    frequency INTEGER NOT NULL DEFAULT 0,
    avg_impact NUMERIC(5, 4) NOT NULL DEFAULT 0,
    historical_accuracy NUMERIC(5, 4) NOT NULL DEFAULT 0,
    historical_utility NUMERIC(10, 4) NOT NULL DEFAULT 0,
    stability INTEGER NOT NULL DEFAULT 0,
    reliability_score INTEGER NOT NULL DEFAULT 0,
    drift NUMERIC(5, 4) NOT NULL DEFAULT 0,
    owner VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Review',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    promoted_at TIMESTAMP WITH TIME ZONE,
    deprecated_at TIMESTAMP WITH TIME ZONE,
    last_evaluated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_statistics_reliability 
    ON driver_statistics(reliability_score DESC);

-- 3. Interaction Rules (Deterministic Interaction Registry)
CREATE TABLE IF NOT EXISTS interaction_rules (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    participating_factors JSONB NOT NULL, -- Array of driver names
    interaction_type VARCHAR(20) NOT NULL,
    multiplier NUMERIC(5, 2) NOT NULL
);
