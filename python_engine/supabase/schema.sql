-- Supabase Schema for HandicapLab (Python Engine)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: daily_picks
CREATE TABLE IF NOT EXISTS daily_picks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fixture_id TEXT NOT NULL,
    league TEXT NOT NULL,
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    kickoff_utc TIMESTAMP WITH TIME ZONE NOT NULL,
    market_type TEXT NOT NULL, -- ASIAN_HANDICAP|OVER_UNDER|MONEYLINE
    prediction TEXT NOT NULL,
    model_probability NUMERIC NOT NULL,
    fair_odds NUMERIC NOT NULL,
    market_odds NUMERIC NOT NULL,
    market_bookmaker TEXT NOT NULL,
    edge_pct NUMERIC NOT NULL,
    confidence NUMERIC NOT NULL,
    verdict TEXT NOT NULL, -- LAYAK|PANTAU|LEWATI
    reasoning TEXT NOT NULL, -- Bahasa Indonesia
    status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING|WON|LOST|PUSH
    actual_score TEXT,
    profit_loss NUMERIC,
    clv NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    settled_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_daily_picks_fixture_id ON daily_picks(fixture_id);
CREATE INDEX idx_daily_picks_status ON daily_picks(status);
CREATE INDEX idx_daily_picks_created_at ON daily_picks(created_at);

-- Table: odds_snapshots
CREATE TABLE IF NOT EXISTS odds_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fixture_id TEXT NOT NULL,
    bookmaker TEXT NOT NULL,
    snapshot_label TEXT NOT NULL, -- 'opening' or 'closing'
    ah_odds JSONB,
    ou_odds JSONB,
    ml_odds JSONB,
    snapshot_time TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: track_record
CREATE TABLE IF NOT EXISTS track_record (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    total_picks INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    pushes INTEGER DEFAULT 0,
    win_rate NUMERIC DEFAULT 0,
    roi NUMERIC DEFAULT 0,
    cumulative_profit NUMERIC DEFAULT 0,
    avg_edge NUMERIC DEFAULT 0,
    avg_clv NUMERIC DEFAULT 0,
    brier_score NUMERIC DEFAULT 0.25,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: public_ledger
CREATE TABLE IF NOT EXISTS public_ledger (
    signal_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match TEXT NOT NULL,
    prediction TEXT NOT NULL,
    odds NUMERIC NOT NULL,
    edge NUMERIC NOT NULL,
    confidence NUMERIC NOT NULL,
    result TEXT,
    profit_loss NUMERIC,
    cumulative_profit NUMERIC,
    crypto_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: user_subscriptions
CREATE TABLE IF NOT EXISTS user_subscriptions (
    user_id UUID PRIMARY KEY,
    tier TEXT NOT NULL DEFAULT 'FREE', -- FREE|PRO|QUANT|FOUNDER
    analyses_remaining INTEGER,
    ppp_tier TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: payments
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    gateway TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    currency TEXT NOT NULL,
    ppp_tier TEXT,
    product TEXT,
    status TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE daily_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_ledger ENABLE ROW LEVEL SECURITY;

-- Enable Realtime (This requires manual toggle in Supabase Dashboard or logical replication config)
-- ALTER PUBLICATION supabase_realtime ADD TABLE daily_picks;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public_ledger;

-- ===================================================================
-- BACKTEST MIGRATION (STEP 6) — source labeling + summary table
-- ===================================================================

-- Label picks by origin: 'live' (default) or 'backtest'
ALTER TABLE daily_picks ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'live';
ALTER TABLE public_ledger ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'live';

-- Backtest summary (single row, upserted on each seed run)
CREATE TABLE IF NOT EXISTS backtest_summary (
    id INT PRIMARY KEY DEFAULT 1,
    seasons TEXT,
    total_matches INT,
    total_picks INT,
    win_rate FLOAT,
    roi FLOAT,
    brier FLOAT,
    avg_clv FLOAT,
    max_drawdown FLOAT,
    per_market JSONB,
    generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Separate live start date from backtest data
ALTER TABLE track_record ADD COLUMN IF NOT EXISTS live_start_date DATE;

CREATE INDEX IF NOT EXISTS idx_daily_picks_source ON daily_picks(source);
CREATE INDEX IF NOT EXISTS idx_public_ledger_source ON public_ledger(source);

