-- ============================================================================
-- EPIC: Historical European League Data Expansion — Gold Layer
-- Tables + views for the verified historical dataset (data/golden/europe).
-- Populated by src/historical/europe/goldDbLoader.ts in a credentialed
-- (production/CI) environment. No fabricated rows: the loader only inserts
-- records produced by the deterministic canonical pipeline.
-- ============================================================================

-- 1. Canonical historical matches
CREATE TABLE IF NOT EXISTS public.historical_matches (
  canonical_id TEXT PRIMARY KEY,
  league_id TEXT NOT NULL,
  cluster CHAR(1) NOT NULL CHECK (cluster IN ('A', 'B', 'C')),
  season TEXT NOT NULL,
  match_date DATE NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_goals INTEGER NOT NULL,
  away_goals INTEGER NOT NULL,
  result CHAR(1) NOT NULL CHECK (result IN ('H', 'D', 'A')),
  result_verified BOOLEAN NOT NULL DEFAULT FALSE,
  total_goals INTEGER NOT NULL,
  home_win BOOLEAN NOT NULL,
  draw BOOLEAN NOT NULL,
  away_win BOOLEAN NOT NULL,
  btts BOOLEAN NOT NULL,
  over15 BOOLEAN NOT NULL,
  over25 BOOLEAN NOT NULL,
  over35 BOOLEAN NOT NULL,
  under15 BOOLEAN NOT NULL,
  under25 BOOLEAN NOT NULL,
  under35 BOOLEAN NOT NULL,
  source_provider TEXT NOT NULL,
  source_file TEXT NOT NULL,
  source_row INTEGER NOT NULL,
  normalization_version TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (league_id, season, match_date, home_team, away_team)
);
CREATE INDEX IF NOT EXISTS idx_historical_matches_league_season ON public.historical_matches (league_id, season);
CREATE INDEX IF NOT EXISTS idx_historical_matches_cluster ON public.historical_matches (cluster);
ALTER TABLE public.historical_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "historical matches public read" ON public.historical_matches FOR SELECT USING (true);

-- 2. Historical odds — one row per genuine market OBSERVATION
--    (match × market × opening/closing × bookmaker) with the ACTUAL source
--    line and odds. No collapsing of distinct observations, no pseudo-odds.
CREATE TABLE IF NOT EXISTS public.historical_odds (
  odds_id TEXT PRIMARY KEY,
  canonical_id TEXT NOT NULL REFERENCES public.historical_matches(canonical_id) ON DELETE CASCADE,
  league_id TEXT NOT NULL,
  cluster CHAR(1) NOT NULL CHECK (cluster IN ('A', 'B', 'C')),
  season TEXT NOT NULL,
  match_date DATE NOT NULL,
  market TEXT NOT NULL CHECK (market IN ('ML', 'AH', 'OU')),
  observation TEXT NOT NULL CHECK (observation IN ('opening', 'closing')),
  bookmaker_source TEXT NOT NULL,
  line NUMERIC,
  home_odds NUMERIC,
  draw_odds NUMERIC,
  away_odds NUMERIC,
  over_odds NUMERIC,
  under_odds NUMERIC,
  source_file TEXT NOT NULL,
  source_row INTEGER NOT NULL,
  dataset_version TEXT NOT NULL,
  ingestion_version TEXT NOT NULL,
  UNIQUE (canonical_id, market, observation, bookmaker_source)
);
CREATE INDEX IF NOT EXISTS idx_historical_odds_market ON public.historical_odds (market);
CREATE INDEX IF NOT EXISTS idx_historical_odds_canonical ON public.historical_odds (canonical_id);
ALTER TABLE public.historical_odds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "historical odds public read" ON public.historical_odds FOR SELECT USING (true);

-- 3. League registry (cluster assignment + status, incl. EXCLUDED reasons)
CREATE TABLE IF NOT EXISTS public.historical_league_meta (
  league_id TEXT PRIMARY KEY,
  cluster CHAR(1) NOT NULL CHECK (cluster IN ('A', 'B', 'C')),
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  football_data_code TEXT,
  status TEXT NOT NULL,
  exclude_reason TEXT
);
ALTER TABLE public.historical_league_meta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "historical league meta public read" ON public.historical_league_meta FOR SELECT USING (true);

-- 4. Dataset manifest (freeze marker)
CREATE TABLE IF NOT EXISTS public.historical_dataset_manifest (
  dataset_version TEXT PRIMARY KEY,
  generated_at TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  normalization_version TEXT NOT NULL,
  raw_record_count INTEGER NOT NULL,
  valid_match_count INTEGER NOT NULL,
  rejected_match_count INTEGER NOT NULL,
  duplicate_resolved_count INTEGER NOT NULL,
  duplicate_count INTEGER NOT NULL,
  hash TEXT NOT NULL,
  payload JSONB
);
ALTER TABLE public.historical_dataset_manifest ENABLE ROW LEVEL SECURITY;
CREATE POLICY "historical manifest public read" ON public.historical_dataset_manifest FOR SELECT USING (true);

-- 5. Gold views over the verified historical layer
CREATE OR REPLACE VIEW gold_historical_matches AS
SELECT
  m.canonical_id,
  m.league_id,
  m.cluster,
  m.season,
  m.match_date,
  m.home_team,
  m.away_team,
  m.home_goals,
  m.away_goals,
  m.result,
  m.total_goals,
  m.home_win,
  m.draw,
  m.away_win,
  m.btts,
  m.over25,
  m.under25,
  m.source_file,
  EXISTS (SELECT 1 FROM public.historical_odds o WHERE o.canonical_id = m.canonical_id AND o.market = 'ML' AND o.observation = 'opening') AS has_ml,
  EXISTS (SELECT 1 FROM public.historical_odds o WHERE o.canonical_id = m.canonical_id AND o.market = 'AH' AND o.observation = 'opening') AS has_ah,
  EXISTS (SELECT 1 FROM public.historical_odds o WHERE o.canonical_id = m.canonical_id AND o.market = 'OU' AND o.observation = 'opening') AS has_ou
FROM public.historical_matches m;

CREATE OR REPLACE VIEW gold_historical_coverage AS
SELECT
  m.league_id,
  l.name,
  l.country,
  m.cluster,
  l.status,
  l.exclude_reason,
  COUNT(DISTINCT m.canonical_id) AS matches,
  COUNT(DISTINCT m.season) AS seasons,
  COUNT(DISTINCT o.canonical_id) FILTER (WHERE o.market = 'ML') AS ml_matches,
  COUNT(DISTINCT o.canonical_id) FILTER (WHERE o.market = 'AH') AS ah_matches,
  COUNT(DISTINCT o.canonical_id) FILTER (WHERE o.market = 'OU') AS ou_matches,
  COUNT(*) FILTER (WHERE o.market = 'ML') AS ml_rows,
  COUNT(*) FILTER (WHERE o.market = 'AH') AS ah_rows,
  COUNT(*) FILTER (WHERE o.market = 'OU') AS ou_rows,
  ROUND(100.0 * COUNT(DISTINCT o.canonical_id) FILTER (WHERE o.market = 'ML') / NULLIF(COUNT(DISTINCT m.canonical_id), 0), 2) AS ml_coverage,
  ROUND(100.0 * COUNT(DISTINCT o.canonical_id) FILTER (WHERE o.market = 'AH') / NULLIF(COUNT(DISTINCT m.canonical_id), 0), 2) AS ah_coverage,
  ROUND(100.0 * COUNT(DISTINCT o.canonical_id) FILTER (WHERE o.market = 'OU') / NULLIF(COUNT(DISTINCT m.canonical_id), 0), 2) AS ou_coverage
FROM public.historical_matches m
LEFT JOIN public.historical_league_meta l USING (league_id)
LEFT JOIN public.historical_odds o ON o.canonical_id = m.canonical_id
GROUP BY m.league_id, l.name, l.country, m.cluster, l.status, l.exclude_reason;
