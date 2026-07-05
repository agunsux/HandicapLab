-- Migration: 00000000000011_metadata_foundation.sql
-- Goal: Establish the Surrogate Integer ID Canonical Database tables, Alias Registry, Dataset Metadata, and Knowledge Graph foundations.

-- 1. DROP EXISTING TO AVOID CONFLICTS
DROP TABLE IF EXISTS public.wh_knowledge_edges CASCADE;
DROP TABLE IF EXISTS public.wh_dataset_metadata CASCADE;
DROP TABLE IF EXISTS public.wh_entity_aliases CASCADE;
DROP TABLE IF EXISTS public.wh_fixtures CASCADE;
DROP TABLE IF EXISTS public.wh_venues CASCADE;
DROP TABLE IF EXISTS public.wh_teams CASCADE;
DROP TABLE IF EXISTS public.wh_seasons CASCADE;
DROP TABLE IF EXISTS public.wh_leagues CASCADE;
DROP TABLE IF EXISTS public.wh_competitions CASCADE;
DROP TABLE IF EXISTS public.wh_bookmakers CASCADE;
DROP TABLE IF EXISTS public.wh_markets CASCADE;

-- 2. CANONICAL ENTITY REGISTRIES (Using BIGINT Surrogate Keys)
CREATE TABLE public.wh_competitions (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  country VARCHAR(100) NOT NULL,
  type VARCHAR(50) DEFAULT 'league', -- league, cup
  logo_url TEXT
);

CREATE TABLE public.wh_leagues (
  id BIGSERIAL PRIMARY KEY,
  competition_id BIGINT REFERENCES public.wh_competitions(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  slug VARCHAR(150) UNIQUE NOT NULL
);

CREATE TABLE public.wh_seasons (
  id BIGSERIAL PRIMARY KEY,
  competition_id BIGINT REFERENCES public.wh_competitions(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  start_date DATE,
  end_date DATE,
  CONSTRAINT unique_comp_season_surrogate UNIQUE (competition_id, year)
);

CREATE TABLE public.wh_teams (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  country VARCHAR(100),
  logo_url TEXT
);

CREATE TABLE public.wh_venues (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  city VARCHAR(100),
  capacity INTEGER,
  surface VARCHAR(50)
);

CREATE TABLE public.wh_fixtures (
  id BIGSERIAL PRIMARY KEY,
  competition_id BIGINT REFERENCES public.wh_competitions(id) ON DELETE CASCADE,
  season_id BIGINT REFERENCES public.wh_seasons(id) ON DELETE CASCADE,
  home_team_id BIGINT REFERENCES public.wh_teams(id) ON DELETE CASCADE,
  away_team_id BIGINT REFERENCES public.wh_teams(id) ON DELETE CASCADE,
  venue_id BIGINT REFERENCES public.wh_venues(id) ON DELETE SET NULL,
  kickoff_time TIMESTAMPTZ NOT NULL,
  status VARCHAR(50) NOT NULL, -- scheduled, live, finished, postponed, cancelled, abandoned
  home_goals INTEGER,
  away_goals INTEGER,
  details_json JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE public.wh_bookmakers (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE public.wh_markets (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
);

-- 3. ALIAS REGISTRY
CREATE TABLE public.wh_entity_aliases (
  id BIGSERIAL PRIMARY KEY,
  canonical_id BIGINT NOT NULL,
  entity_type VARCHAR(50) NOT NULL, -- TEAM, LEAGUE, COMPETITION
  provider_name VARCHAR(100) NOT NULL,
  alias_name VARCHAR(255) NOT NULL,
  confidence_score NUMERIC(5,2) DEFAULT 100.00, -- 0.00 to 100.00%
  manual_override BOOLEAN DEFAULT false,
  CONSTRAINT unique_provider_alias UNIQUE (provider_name, entity_type, alias_name)
);
CREATE INDEX idx_entity_aliases_lookup ON public.wh_entity_aliases(provider_name, entity_type, alias_name);

-- 4. DATASET METADATA REGISTRY
CREATE TABLE public.wh_dataset_metadata (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dataset_id VARCHAR(100) NOT NULL,
  version VARCHAR(50) NOT NULL,
  schema_definition JSONB NOT NULL,
  checksum VARCHAR(64) NOT NULL,
  compression VARCHAR(20) DEFAULT 'gzip', -- gzip, none, zstd
  partition_count INTEGER DEFAULT 0,
  row_count BIGINT DEFAULT 0,
  provider VARCHAR(100) NOT NULL,
  coverage_pct NUMERIC(5,2),
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_dataset_version UNIQUE (dataset_id, version)
);

-- 5. CANONICAL KNOWLEDGE GRAPH EDGES
CREATE TABLE public.wh_knowledge_edges (
  id BIGSERIAL PRIMARY KEY,
  source_id BIGINT NOT NULL,
  source_type VARCHAR(50) NOT NULL,
  target_id BIGINT NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  relationship_type VARCHAR(100) NOT NULL,
  confidence_score NUMERIC(5,2) DEFAULT 100.00,
  source_provenance VARCHAR(100) NOT NULL,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_knowledge_edge UNIQUE (source_id, source_type, target_id, target_type, relationship_type)
);
CREATE INDEX idx_knowledge_edges_source ON public.wh_knowledge_edges(source_id, source_type);
CREATE INDEX idx_knowledge_edges_target ON public.wh_knowledge_edges(target_id, target_type);

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE public.wh_competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wh_leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wh_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wh_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wh_venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wh_fixtures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wh_bookmakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wh_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wh_entity_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wh_dataset_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wh_knowledge_edges ENABLE ROW LEVEL SECURITY;

-- SELECT POLICIES
CREATE POLICY "Select Competitions" ON public.wh_competitions FOR SELECT USING (true);
CREATE POLICY "Select Leagues" ON public.wh_leagues FOR SELECT USING (true);
CREATE POLICY "Select Seasons" ON public.wh_seasons FOR SELECT USING (true);
CREATE POLICY "Select Teams" ON public.wh_teams FOR SELECT USING (true);
CREATE POLICY "Select Venues" ON public.wh_venues FOR SELECT USING (true);
CREATE POLICY "Select Fixtures" ON public.wh_fixtures FOR SELECT USING (true);
CREATE POLICY "Select Bookmakers" ON public.wh_bookmakers FOR SELECT USING (true);
CREATE POLICY "Select Markets" ON public.wh_markets FOR SELECT USING (true);
CREATE POLICY "Select Aliases" ON public.wh_entity_aliases FOR SELECT USING (true);
CREATE POLICY "Select Dataset Metadata" ON public.wh_dataset_metadata FOR SELECT USING (true);
CREATE POLICY "Select Knowledge Edges" ON public.wh_knowledge_edges FOR SELECT USING (true);
