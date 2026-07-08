CREATE TABLE IF NOT EXISTS uncertainty_registry (
    id SERIAL PRIMARY KEY,
    experiment_id VARCHAR(100) NOT NULL,
    uncertainty_method VARCHAR(100) NOT NULL,
    entropy DOUBLE PRECISION,
    variance DOUBLE PRECISION,
    ood_score DOUBLE PRECISION,
    shift_score DOUBLE PRECISION,
    agreement_score DOUBLE PRECISION,
    confidence DOUBLE PRECISION,
    decision_accuracy DOUBLE PRECISION,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
