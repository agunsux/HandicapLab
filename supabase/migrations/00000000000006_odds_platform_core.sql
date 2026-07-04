-- Migration: Production Odds Data Platform Schema
-- Location: supabase/migrations/00000000000006_odds_platform_core.sql

-- 1. Create External Odds Providers Metadata Table
CREATE TABLE IF NOT EXISTS public.odds_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name VARCHAR(100) UNIQUE NOT NULL,
  provider_type VARCHAR(50) DEFAULT 'API' NOT NULL,
  timezone VARCHAR(50) DEFAULT 'UTC' NOT NULL,
  active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Create Bookmakers Table (linked to a provider)
CREATE TABLE IF NOT EXISTS public.bookmakers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID REFERENCES public.odds_providers(id) ON DELETE CASCADE NOT NULL,
  bookmaker_name VARCHAR(100) NOT NULL,
  country VARCHAR(100),
  active BOOLEAN DEFAULT TRUE NOT NULL,
  CONSTRAINT unique_provider_bookmaker UNIQUE (provider_id, bookmaker_name)
);

-- 3. Create Master Markets Table
CREATE TABLE IF NOT EXISTS public.markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_code VARCHAR(50) UNIQUE NOT NULL, -- e.g. 'ML', 'AH', 'OU'
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 4. Alter the existing odds_snapshots table to link with normalized tables
-- Keeps existing columns to ensure 100% backward compatibility
ALTER TABLE public.odds_snapshots 
  ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES public.odds_providers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bookmaker_id UUID REFERENCES public.bookmakers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS market_id UUID REFERENCES public.markets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS implied_probability NUMERIC,
  ADD COLUMN IF NOT EXISTS is_live BOOLEAN DEFAULT FALSE;

-- 5. Create Odds Movements Table (tracks every shift in odds for H-7 to kickoff analysis)
CREATE TABLE IF NOT EXISTS public.odds_movements (
  snapshot_id UUID PRIMARY KEY REFERENCES public.odds_snapshots(id) ON DELETE CASCADE,
  fixture_id TEXT NOT NULL,
  previous_snapshot_id UUID REFERENCES public.odds_snapshots(id) ON DELETE SET NULL,
  odds_before NUMERIC NOT NULL,
  odds_after NUMERIC NOT NULL,
  movement NUMERIC NOT NULL, -- odds_after - odds_before
  timestamp TIMESTAMPTZ NOT NULL
);

-- 6. Create Opening Lines Table (automatically recorded first odds)
CREATE TABLE IF NOT EXISTS public.opening_lines (
  fixture_id TEXT NOT NULL,
  bookmaker_id UUID REFERENCES public.bookmakers(id) ON DELETE CASCADE NOT NULL,
  market_id UUID REFERENCES public.markets(id) ON DELETE CASCADE NOT NULL,
  opening_odds NUMERIC NOT NULL,
  opening_timestamp TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (fixture_id, bookmaker_id, market_id)
);

-- 7. Create Closing Lines Table (final odds logged before match starts)
CREATE TABLE IF NOT EXISTS public.closing_lines (
  fixture_id TEXT NOT NULL,
  bookmaker_id UUID REFERENCES public.bookmakers(id) ON DELETE CASCADE NOT NULL,
  market_id UUID REFERENCES public.markets(id) ON DELETE CASCADE NOT NULL,
  closing_odds NUMERIC NOT NULL,
  closing_timestamp TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (fixture_id, bookmaker_id, market_id)
);

-- 8. Create Consensus Lines Table (holds average, median, sharp consensus, and overrounds)
CREATE TABLE IF NOT EXISTS public.consensus_lines (
  fixture_id TEXT NOT NULL,
  market_id UUID REFERENCES public.markets(id) ON DELETE CASCADE NOT NULL,
  average_odds NUMERIC NOT NULL,
  median_odds NUMERIC NOT NULL,
  sharp_consensus NUMERIC, -- Pinnacle/Exchange weighted odds
  overround NUMERIC, -- consensus overround percentage
  timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (fixture_id, market_id)
);

-- 9. Create Market Efficiency Table
CREATE TABLE IF NOT EXISTS public.market_efficiency (
  fixture_id TEXT NOT NULL,
  market_id UUID REFERENCES public.markets(id) ON DELETE CASCADE NOT NULL,
  efficiency_score NUMERIC, -- calculated via variance and CLV drift
  volatility NUMERIC,
  liquidity_proxy NUMERIC,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (fixture_id, market_id)
);

-- 10. Composite Indexes for High Performance Querying (< 200 ms)
CREATE INDEX IF NOT EXISTS idx_odds_snapshots_composite_lookup 
  ON public.odds_snapshots (match_id, bookmaker_id, market_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_odds_movements_fixture_timeline 
  ON public.odds_movements (fixture_id, timestamp DESC);

-- 11. Enable Row Level Security (RLS)
ALTER TABLE public.odds_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.odds_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opening_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.closing_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consensus_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_efficiency ENABLE ROW LEVEL SECURITY;

-- 12. Create Public Read Policies
CREATE POLICY "Allow public read on odds_providers" ON public.odds_providers FOR SELECT USING (true);
CREATE POLICY "Allow public read on bookmakers" ON public.bookmakers FOR SELECT USING (true);
CREATE POLICY "Allow public read on markets" ON public.markets FOR SELECT USING (true);
CREATE POLICY "Allow public read on odds_movements" ON public.odds_movements FOR SELECT USING (true);
CREATE POLICY "Allow public read on opening_lines" ON public.opening_lines FOR SELECT USING (true);
CREATE POLICY "Allow public read on closing_lines" ON public.closing_lines FOR SELECT USING (true);
CREATE POLICY "Allow public read on consensus_lines" ON public.consensus_lines FOR SELECT USING (true);
CREATE POLICY "Allow public read on market_efficiency" ON public.market_efficiency FOR SELECT USING (true);

-- 13. Seed Core Data (Providers, Markets)
INSERT INTO public.odds_providers (provider_name, provider_type, timezone)
VALUES 
  ('api-football', 'API', 'UTC'),
  ('the-odds-api', 'API', 'UTC'),
  ('pinnacle-direct', 'API', 'UTC'),
  ('csv-import', 'CSV', 'UTC')
ON CONFLICT (provider_name) DO NOTHING;

INSERT INTO public.markets (market_code, description)
VALUES 
  ('ML', 'Moneyline (1X2)'),
  ('AH', 'Asian Handicap'),
  ('OU', 'Over/Under 2.5')
ON CONFLICT (market_code) DO NOTHING;

-- Seed default bookmakers linked to api-football
DO $$
DECLARE
  v_provider_uuid UUID;
BEGIN
  SELECT id INTO v_provider_uuid FROM public.odds_providers WHERE provider_name = 'api-football';
  IF v_provider_uuid IS NOT NULL THEN
    INSERT INTO public.bookmakers (provider_id, bookmaker_name, country)
    VALUES 
      (v_provider_uuid, 'Pinnacle', 'Global'),
      (v_provider_uuid, 'Bet365', 'United Kingdom'),
      (v_provider_uuid, 'Bwin', 'Austria'),
      (v_provider_uuid, 'William Hill', 'United Kingdom'),
      (v_provider_uuid, 'Consensus', 'Global')
    ON CONFLICT (provider_id, bookmaker_name) DO NOTHING;
  END IF;
END $$;
