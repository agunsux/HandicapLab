-- ==============================================================================
-- HANDICAPLAB ARCHIVE & SCRAPING INGESTION SCHEMA
-- Migration: 20260907000000_scoreroom_archive_pipeline.sql
-- Description: Ensures idempotency and foreign key integrity for matches,
-- odds movements (AH, O/U, ML), and in-game Pressure Index team stats.
-- ==============================================================================

-- 1. MATCHES TABLE AUGMENTATION
-- Ensure matches table exists with unique source_fixture_id for idempotent upserts
CREATE TABLE IF NOT EXISTS public.matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_fixture_id VARCHAR(100) UNIQUE,
    home_team VARCHAR(100) NOT NULL,
    away_team VARCHAR(100) NOT NULL,
    league VARCHAR(100) NOT NULL,
    kickoff TIMESTAMPTZ NOT NULL,
    status VARCHAR(30) DEFAULT 'upcoming',
    home_goals INTEGER,
    away_goals INTEGER,
    ht_home_goals INTEGER,
    ht_away_goals INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add column if table previously existed without source_fixture_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'matches' 
        AND column_name = 'source_fixture_id'
    ) THEN
        ALTER TABLE public.matches ADD COLUMN source_fixture_id VARCHAR(100) UNIQUE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_matches_source_fixture_id ON public.matches(source_fixture_id);
CREATE INDEX IF NOT EXISTS idx_matches_kickoff ON public.matches(kickoff);
CREATE INDEX IF NOT EXISTS idx_matches_league_status ON public.matches(league, status);

-- 2. HISTORICAL ODDS MOVEMENTS (ODDS_HISTORY)
CREATE TABLE IF NOT EXISTS public.odds_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    bookmaker VARCHAR(64) NOT NULL DEFAULT 'pinnacle',
    market_type VARCHAR(32) NOT NULL, -- 'ah', 'ou', 'ml'
    line NUMERIC(6, 3),               -- e.g. -0.75, +0.25, 2.50, 2.75
    selection VARCHAR(64),            -- 'home', 'away', 'over', 'under', 'draw'
    price NUMERIC(7, 3),              -- Decimal odds
    home_odds NUMERIC(7, 3),
    away_odds NUMERIC(7, 3),
    draw_odds NUMERIC(7, 3),
    over_odds NUMERIC(7, 3),
    under_odds NUMERIC(7, 3),
    odds_stage VARCHAR(32) NOT NULL DEFAULT 'closing', -- 'opening', 'closing', 'live'
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Unique constraint guarantees idempotency during batch upserts
    CONSTRAINT uq_odds_history_snapshot UNIQUE (
        match_id,
        bookmaker,
        market_type,
        line,
        odds_stage,
        recorded_at
    )
);

CREATE INDEX IF NOT EXISTS idx_odds_history_match_id ON public.odds_history(match_id);
CREATE INDEX IF NOT EXISTS idx_odds_history_bookmaker_market ON public.odds_history(bookmaker, market_type);
CREATE INDEX IF NOT EXISTS idx_odds_history_recorded_at ON public.odds_history(recorded_at);

-- 3. MATCH TEAM STATS (PRESSURE INDEX INPUTS)
CREATE TABLE IF NOT EXISTS public.match_team_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    team_name VARCHAR(128) NOT NULL,
    is_home BOOLEAN NOT NULL,
    xg NUMERIC(5, 2),
    shots_on_target INTEGER,
    total_shots INTEGER,
    possession_pct NUMERIC(5, 2),
    corners INTEGER,
    fouls INTEGER,
    dangerous_attacks INTEGER,
    yellow_cards INTEGER,
    red_cards INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Prevent duplicate stats for same team and match
    CONSTRAINT uq_match_team_stats UNIQUE (match_id, team_name)
);

CREATE INDEX IF NOT EXISTS idx_match_team_stats_match_id ON public.match_team_stats(match_id);
CREATE INDEX IF NOT EXISTS idx_match_team_stats_team ON public.match_team_stats(team_name);

-- 4. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.odds_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_team_stats ENABLE ROW LEVEL SECURITY;

-- Public Read-Only Access
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read matches') THEN
        CREATE POLICY "Public read matches" ON public.matches FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read odds_history') THEN
        CREATE POLICY "Public read odds_history" ON public.odds_history FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read match_team_stats') THEN
        CREATE POLICY "Public read match_team_stats" ON public.match_team_stats FOR SELECT USING (true);
    END IF;
END $$;

-- Service Role Full Read/Write Access
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access matches') THEN
        CREATE POLICY "Service role full access matches" ON public.matches FOR ALL TO service_role USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access odds_history') THEN
        CREATE POLICY "Service role full access odds_history" ON public.odds_history FOR ALL TO service_role USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access match_team_stats') THEN
        CREATE POLICY "Service role full access match_team_stats" ON public.match_team_stats FOR ALL TO service_role USING (true);
    END IF;
END $$;
