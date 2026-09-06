-- ==============================================================================
-- MIGRATION: Create advanced_team_stats table
-- Purpose: Store scraped advanced football metrics (xG, xGA, PPDA, BTTS%, OU%)
--          from Understat and public trend sources to supplement paid APIs.
-- ==============================================================================

-- Enable UUID extension if not already available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.advanced_team_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_name VARCHAR(150) NOT NULL,
    league VARCHAR(100) NOT NULL,
    season INT NOT NULL DEFAULT 2025,
    matches_played INT NOT NULL DEFAULT 0,
    avg_xg FLOAT NOT NULL DEFAULT 0.0,
    avg_xga FLOAT NOT NULL DEFAULT 0.0,
    avg_ppda FLOAT DEFAULT NULL,
    btts_pct FLOAT DEFAULT NULL,
    over_25_pct FLOAT DEFAULT NULL,
    under_25_pct FLOAT DEFAULT NULL,
    data_source VARCHAR(100) NOT NULL DEFAULT 'understat',
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Composite unique constraint required for ON CONFLICT (team_name, league) UPSERT
    CONSTRAINT uq_advanced_team_stats_team_league UNIQUE (team_name, league)
);

-- Performance & Query Optimization Indexes
CREATE INDEX IF NOT EXISTS idx_adv_team_stats_league 
    ON public.advanced_team_stats (league);

CREATE INDEX IF NOT EXISTS idx_adv_team_stats_team 
    ON public.advanced_team_stats (team_name);

CREATE INDEX IF NOT EXISTS idx_adv_team_stats_updated 
    ON public.advanced_team_stats (last_updated DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.advanced_team_stats ENABLE ROW LEVEL SECURITY;

-- Grant read access to anon & authenticated users; full access to service_role
CREATE POLICY "Allow public read-only access to advanced_team_stats"
    ON public.advanced_team_stats
    FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "Allow service_role full access to advanced_team_stats"
    ON public.advanced_team_stats
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

COMMENT ON TABLE public.advanced_team_stats IS 'Scraped advanced xG, PPDA, and market trend statistics to feed quant Bayesian & Poisson models.';
COMMENT ON COLUMN public.advanced_team_stats.avg_xg IS 'Expected Goals For per match (xG per 90)';
COMMENT ON COLUMN public.advanced_team_stats.avg_xga IS 'Expected Goals Against per match (xGA per 90)';
COMMENT ON COLUMN public.advanced_team_stats.avg_ppda IS 'Passes Allowed Per Defensive Action in opponent 3/5ths (Pressing Intensity)';
COMMENT ON COLUMN public.advanced_team_stats.btts_pct IS 'Both Teams To Score match percentage (0.0 - 100.0)';
COMMENT ON COLUMN public.advanced_team_stats.over_25_pct IS 'Over 2.5 Goals match percentage (0.0 - 100.0)';
COMMENT ON COLUMN public.advanced_team_stats.under_25_pct IS 'Under 2.5 Goals match percentage (0.0 - 100.0)';
