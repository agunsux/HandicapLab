-- Re-create child tables from Phase 3 that might be missing locally

CREATE TABLE IF NOT EXISTS public.prediction_snapshot_features (
    snapshot_id UUID NOT NULL,
    snapshot_time TIMESTAMPTZ NOT NULL,
    feature_name VARCHAR(100) NOT NULL,
    feature_value DOUBLE PRECISION,
    normalized_value DOUBLE PRECISION,
    weight DOUBLE PRECISION,
    importance DOUBLE PRECISION,
    source_provenance JSONB,
    importance_score DOUBLE PRECISION,
    z_score DOUBLE PRECISION,
    raw_value TEXT,
    PRIMARY KEY (snapshot_id, snapshot_time, feature_name)
);

CREATE TABLE IF NOT EXISTS public.prediction_snapshot_markets (
    snapshot_id UUID NOT NULL,
    snapshot_time TIMESTAMPTZ NOT NULL,
    market_name VARCHAR(50),
    selection_name VARCHAR(50),
    line VARCHAR(20),
    odds DOUBLE PRECISION,
    pinnacle_odds DOUBLE PRECISION,
    bet365_odds DOUBLE PRECISION,
    betfair_odds DOUBLE PRECISION,
    market_average DOUBLE PRECISION,
    market_median DOUBLE PRECISION,
    opening_odds DOUBLE PRECISION,
    current_odds DOUBLE PRECISION,
    implied_prob DOUBLE PRECISION,
    fair_odds DOUBLE PRECISION,
    model_probability DOUBLE PRECISION,
    expected_value DOUBLE PRECISION,
    kelly_stake DOUBLE PRECISION,
    implied_probability DOUBLE PRECISION,
    PRIMARY KEY (snapshot_id, snapshot_time)
);

CREATE TABLE IF NOT EXISTS public.prediction_snapshot_explainability (
    snapshot_id UUID NOT NULL,
    snapshot_time TIMESTAMPTZ NOT NULL,
    factor_name VARCHAR(100) NOT NULL,
    impact_direction VARCHAR(10) NOT NULL, -- UP, DOWN, NEUTRAL
    impact_magnitude DOUBLE PRECISION NOT NULL,
    description TEXT,
    PRIMARY KEY (snapshot_id, snapshot_time, factor_name)
);

CREATE TABLE IF NOT EXISTS public.prediction_snapshot_execution (
    snapshot_id UUID NOT NULL,
    snapshot_time TIMESTAMPTZ NOT NULL,
    execution_channel VARCHAR(50) NOT NULL, -- paper_trading, sharp_ledger, telegram_bot
    status VARCHAR(20) DEFAULT 'queued' NOT NULL, -- queued, executed, skipped, failed
    executed_at TIMESTAMPTZ,
    execution_details JSONB DEFAULT '{}'::jsonb,
    PRIMARY KEY (snapshot_id, snapshot_time, execution_channel)
);

CREATE TABLE IF NOT EXISTS public.prediction_model_versions (
    version_string VARCHAR(50) PRIMARY KEY,
    release_date TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    git_commit VARCHAR(50),
    hyperparameters JSONB DEFAULT '{}'::jsonb,
    features_list TEXT[] DEFAULT '{}'::TEXT[],
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.prediction_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prediction_uuid UUID NOT NULL,
    match_id TEXT NOT NULL,
    market_type TEXT NOT NULL,
    selection TEXT NOT NULL,
    line TEXT,
    pinnacle_odds DOUBLE PRECISION,
    probability DOUBLE PRECISION NOT NULL,
    expected_value DOUBLE PRECISION NOT NULL,
    kelly_stake DOUBLE PRECISION,
    decision TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
