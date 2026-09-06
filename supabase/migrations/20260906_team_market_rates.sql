-- ============================================================================
-- MODULE 1: HARDENED TEAM MARKET RATES & POINT-IN-TIME COVERAGE ENGINE
-- Canonical identity: No HASHTEXT team IDs. Exact deduplication.
-- Zero future-data leakage: Strict match_time < as_of_time parameter.
-- Authoritative AH settlement: Separate outcome probabilities from settlement expectations.
-- ============================================================================

-- 1. Deduplicated Matches Base CTE Helper / View
CREATE OR REPLACE VIEW public.canonical_finished_matches AS
WITH raw_combined AS (
  -- Source 1: Canonical finished fixtures from public.matches
  SELECT
    m.id::text AS match_id,
    CASE 
      WHEN m.league ILIKE '%premier%' THEN 39
      WHEN m.league ILIKE '%la liga%' THEN 140
      WHEN m.league ILIKE '%serie a%' THEN 135
      WHEN m.league ILIKE '%bundesliga%' THEN 78
      WHEN m.league ILIKE '%ligue 1%' THEN 61
      WHEN m.league ILIKE '%eredivisie%' THEN 88
      ELSE 0
    END AS league_id,
    COALESCE(EXTRACT(YEAR FROM m.kickoff)::INT, 2026) AS season,
    TRIM(m.home_team) AS home_team,
    TRIM(m.away_team) AS away_team,
    m.home_goals::INT AS home_goals,
    m.away_goals::INT AS away_goals,
    m.ht_home_goals::INT AS ht_home_goals,
    m.ht_away_goals::INT AS ht_away_goals,
    m.kickoff AS match_time,
    'matches' AS source_table,
    -- Canonical Match Natural Key for Deduplication
    LOWER(TRIM(m.home_team)) || '|' || LOWER(TRIM(m.away_team)) || '|' || (m.kickoff::date)::text AS fixture_natural_key
  FROM public.matches m
  WHERE m.home_goals IS NOT NULL 
    AND m.away_goals IS NOT NULL
    AND (m.status = 'FINISHED' OR m.status = 'FT')

  UNION ALL

  -- Source 2: Verified historical matches from public.historical_matches
  SELECT
    h.canonical_id AS match_id,
    CASE 
      WHEN h.league_id IN ('ENG-PL', 'ENG-PREMIER-LEAGUE') THEN 39
      WHEN h.league_id IN ('ESP-LALIGA', 'ESP-LA-LIGA') THEN 140
      WHEN h.league_id IN ('ITA-SERIEA', 'ITA-SERIE-A') THEN 135
      WHEN h.league_id IN ('DEU-BUNDESLIGA') THEN 78
      WHEN h.league_id IN ('FRA-LIGUE1', 'FRA-LIGUE-1') THEN 61
      WHEN h.league_id IN ('NLD-EREDIVISIE') THEN 88
      ELSE 0
    END AS league_id,
    COALESCE(
      NULLIF(SPLIT_PART(h.season, '-', 1), '')::INT,
      EXTRACT(YEAR FROM h.match_date)::INT
    ) AS season,
    TRIM(h.home_team) AS home_team,
    TRIM(h.away_team) AS away_team,
    h.home_goals::INT AS home_goals,
    h.away_goals::INT AS away_goals,
    NULL::INT AS ht_home_goals,
    NULL::INT AS ht_away_goals,
    h.match_date::timestamptz AS match_time,
    'historical_matches' AS source_table,
    LOWER(TRIM(h.home_team)) || '|' || LOWER(TRIM(h.away_team)) || '|' || (h.match_date)::text AS fixture_natural_key
  FROM public.historical_matches h
  WHERE h.home_goals IS NOT NULL 
    AND h.away_goals IS NOT NULL
),
deduplicated AS (
  -- Enforce: 1 canonical match = 1 observation
  -- Priority: public.matches over historical_matches if same fixture exists in both
  SELECT DISTINCT ON (fixture_natural_key)
    match_id,
    league_id,
    season,
    home_team,
    away_team,
    home_goals,
    away_goals,
    ht_home_goals,
    ht_away_goals,
    match_time,
    fixture_natural_key
  FROM raw_combined
  ORDER BY fixture_natural_key, (CASE WHEN source_table = 'matches' THEN 1 ELSE 2 END)
)
SELECT * FROM deduplicated;

-- 2. Team Perspective Matches View
CREATE OR REPLACE VIEW public.team_perspective_matches AS
WITH raw AS (
  SELECT * FROM public.canonical_finished_matches
)
-- Perspective for Home Teams
SELECT
  home_team AS team_name,
  league_id,
  season,
  'home' AS venue,
  home_goals AS goals_for,
  away_goals AS goals_against,
  (home_goals - away_goals) AS goal_diff,
  (home_goals + away_goals) AS total_goals,
  ht_home_goals AS ht_goals_for,
  ht_away_goals AS ht_goals_against,
  match_time
FROM raw

UNION ALL

-- Perspective for Away Teams
SELECT
  away_team AS team_name,
  league_id,
  season,
  'away' AS venue,
  away_goals AS goals_for,
  home_goals AS goals_against,
  (away_goals - home_goals) AS goal_diff,
  (home_goals + away_goals) AS total_goals,
  ht_away_goals AS ht_goals_for,
  ht_home_goals AS ht_goals_against,
  match_time
FROM raw

UNION ALL

-- Perspective for Overall (Home matches)
SELECT
  home_team AS team_name,
  league_id,
  season,
  'overall' AS venue,
  home_goals AS goals_for,
  away_goals AS goals_against,
  (home_goals - away_goals) AS goal_diff,
  (home_goals + away_goals) AS total_goals,
  ht_home_goals AS ht_goals_for,
  ht_away_goals AS ht_goals_against,
  match_time
FROM raw

UNION ALL

-- Perspective for Overall (Away matches)
SELECT
  away_team AS team_name,
  league_id,
  season,
  'overall' AS venue,
  away_goals AS goals_for,
  home_goals AS goals_against,
  (away_goals - home_goals) AS goal_diff,
  (home_goals + away_goals) AS total_goals,
  ht_away_goals AS ht_goals_for,
  ht_home_goals AS ht_goals_against,
  match_time
FROM raw;

-- 3. Base Historical Aggregation View (team_market_rates)
-- Maintained for backward compatibility, referencing canonical team_name
CREATE OR REPLACE VIEW public.team_market_rates AS
WITH aggregated AS (
  SELECT
    team_name,
    league_id,
    season,
    venue,
    COUNT(*)::INT AS sample_size,
    COUNT(*)::INT AS matches_played,
    -- Goals averages
    ROUND(AVG(goals_for)::numeric, 3)::FLOAT AS goals_for_avg,
    ROUND(AVG(goals_against)::numeric, 3)::FLOAT AS goals_against_avg,

    -- ========================================================================
    -- ASIAN HANDICAP EXPLICIT SETTLEMENT SEMANTICS
    -- ========================================================================
    -- AH -0.5: Win (diff >= 1), Loss (diff <= 0)
    ROUND((COUNT(*) FILTER (WHERE goal_diff >= 1)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS ah_p_win_minus_050,
    ROUND((COUNT(*) FILTER (WHERE goal_diff <= 0)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS ah_p_loss_minus_050,
    ROUND((COUNT(*) FILTER (WHERE goal_diff >= 1)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS ah_cover_rate,

    -- AH -0.25: Win (diff >= 1) = full cover, Draw (diff = 0) = half loss (0.5 stake lost), Loss (diff <= -1)
    ROUND((COUNT(*) FILTER (WHERE goal_diff >= 1)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS ah_p_win_minus_025,
    ROUND((COUNT(*) FILTER (WHERE goal_diff = 0)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS ah_p_half_loss_minus_025,
    ROUND((COUNT(*) FILTER (WHERE goal_diff <= -1)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS ah_p_loss_minus_025,
    -- Expected settlement unit multiplier (win=1, draw=-0.5, loss=-1)
    ROUND((
      (COUNT(*) FILTER (WHERE goal_diff >= 1)::numeric * 1.0 +
       COUNT(*) FILTER (WHERE goal_diff = 0)::numeric * (-0.5) +
       COUNT(*) FILTER (WHERE goal_diff <= -1)::numeric * (-1.0)) / NULLIF(COUNT(*), 0)
    )::numeric, 4)::FLOAT AS ah_expected_return_minus_025,
    ROUND((COUNT(*) FILTER (WHERE goal_diff >= 1)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS ah_cover_rate_minus_025,

    -- AH -0.75: Win by 2+ (full win), Win by 1 (half win, 0.5 win + 0.5 push), Draw/Loss (diff <= 0)
    ROUND((COUNT(*) FILTER (WHERE goal_diff >= 2)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS ah_p_win_minus_075,
    ROUND((COUNT(*) FILTER (WHERE goal_diff = 1)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS ah_p_half_win_minus_075,
    ROUND((COUNT(*) FILTER (WHERE goal_diff <= 0)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS ah_p_loss_minus_075,
    ROUND((
      (COUNT(*) FILTER (WHERE goal_diff >= 2)::numeric * 1.0 +
       COUNT(*) FILTER (WHERE goal_diff = 1)::numeric * 0.5 +
       COUNT(*) FILTER (WHERE goal_diff <= 0)::numeric * (-1.0)) / NULLIF(COUNT(*), 0)
    )::numeric, 4)::FLOAT AS ah_expected_return_minus_075,
    ROUND((
      (COUNT(*) FILTER (WHERE goal_diff >= 2)::numeric + 0.5 * COUNT(*) FILTER (WHERE goal_diff = 1)::numeric) / NULLIF(COUNT(*), 0)
    )::numeric, 4)::FLOAT AS ah_cover_rate_minus_075,

    -- AH -1.0: Win by 2+ (full win), Win by 1 (PUSH = 0 profit), Draw/Loss (diff <= 0)
    ROUND((COUNT(*) FILTER (WHERE goal_diff >= 2)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS ah_p_win_minus_100,
    ROUND((COUNT(*) FILTER (WHERE goal_diff = 1)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS ah_p_push_minus_100,
    ROUND((COUNT(*) FILTER (WHERE goal_diff <= 0)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS ah_p_loss_minus_100,
    ROUND((
      (COUNT(*) FILTER (WHERE goal_diff >= 2)::numeric * 1.0 +
       COUNT(*) FILTER (WHERE goal_diff = 1)::numeric * 0.0 +
       COUNT(*) FILTER (WHERE goal_diff <= 0)::numeric * (-1.0)) / NULLIF(COUNT(*), 0)
    )::numeric, 4)::FLOAT AS ah_expected_return_minus_100,
    -- Win rate excluding pushes vs total matches
    ROUND((COUNT(*) FILTER (WHERE goal_diff >= 2)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS ah_cover_rate_minus_100,

    -- AH -1.5: Win by 2+ (full win), otherwise loss
    ROUND((COUNT(*) FILTER (WHERE goal_diff >= 2)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS ah_p_win_minus_150,
    ROUND((COUNT(*) FILTER (WHERE goal_diff <= 1)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS ah_p_loss_minus_150,
    ROUND((COUNT(*) FILTER (WHERE goal_diff >= 2)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS ah_cover_rate_minus_150,

    -- ========================================================================
    -- OVER / UNDER EXPLICIT SETTLEMENT RATES
    -- ========================================================================
    ROUND((COUNT(*) FILTER (WHERE total_goals >= 2)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS ou_over_15_rate,
    ROUND((COUNT(*) FILTER (WHERE total_goals <= 1)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS ou_under_15_rate,
    ROUND((COUNT(*) FILTER (WHERE total_goals >= 3)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS ou_over_25_rate,
    ROUND((COUNT(*) FILTER (WHERE total_goals <= 2)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS ou_under_25_rate,
    ROUND((COUNT(*) FILTER (WHERE total_goals >= 4)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS ou_over_35_rate,
    ROUND((COUNT(*) FILTER (WHERE total_goals <= 3)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS ou_under_35_rate,

    -- ========================================================================
    -- BTTS & CLEAN SHEET METRICS
    -- ========================================================================
    ROUND((COUNT(*) FILTER (WHERE goals_for >= 1 AND goals_against >= 1)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS btts_yes_rate,
    ROUND((COUNT(*) FILTER (WHERE goals_for = 0 OR goals_against = 0)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS btts_no_rate,
    ROUND((COUNT(*) FILTER (WHERE goals_against = 0)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS clean_sheet_rate,
    ROUND((COUNT(*) FILTER (WHERE goals_for = 0)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS failed_to_score_rate,

    -- Halftime averages
    ROUND(AVG(ht_goals_for + ht_goals_against)::numeric, 3)::FLOAT AS first_half_goals_avg,
    ROUND(AVG((goals_for + goals_against) - COALESCE(ht_goals_for + ht_goals_against, 0))::numeric, 3)::FLOAT AS second_half_goals_avg,

    NULL::FLOAT AS avg_goal_minute,
    NOW() AS last_updated
  FROM public.team_perspective_matches
  GROUP BY team_name, league_id, season, venue
)
SELECT
  team_name::VARCHAR,
  league_id,
  season,
  venue,
  matches_played,
  sample_size,
  -- Goals averages
  goals_for_avg,
  goals_against_avg,
  -- Asian Handicap rates
  ah_cover_rate,
  ah_cover_rate_minus_025,
  ah_cover_rate_minus_075,
  ah_cover_rate_minus_100,
  ah_cover_rate_minus_150,
  -- Detailed AH Probabilities
  ah_p_win_minus_050,
  ah_p_loss_minus_050,
  ah_p_win_minus_025,
  ah_p_half_loss_minus_025,
  ah_p_loss_minus_025,
  ah_expected_return_minus_025,
  ah_p_win_minus_075,
  ah_p_half_win_minus_075,
  ah_p_loss_minus_075,
  ah_expected_return_minus_075,
  ah_p_win_minus_100,
  ah_p_push_minus_100,
  ah_p_loss_minus_100,
  ah_expected_return_minus_100,
  ah_p_win_minus_150,
  ah_p_loss_minus_150,
  -- Over / Under rates
  ou_over_15_rate,
  ou_under_15_rate,
  ou_over_25_rate,
  ou_under_25_rate,
  ou_over_35_rate,
  ou_under_35_rate,
  -- BTTS
  btts_yes_rate,
  btts_no_rate,
  clean_sheet_rate,
  failed_to_score_rate,
  first_half_goals_avg,
  second_half_goals_avg,
  avg_goal_minute,
  last_updated
FROM aggregated;

-- ============================================================================
-- 4. POINT-IN-TIME COVERAGE ENGINE (Zero Data Leakage RPC)
-- Guarantees: match_time < p_as_of for every contributing match
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_team_coverage_rates_as_of(
  p_team_name TEXT,
  p_venue TEXT DEFAULT 'overall',
  p_season INT DEFAULT NULL,
  p_as_of TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  team_name VARCHAR,
  league_id INT,
  season INT,
  venue TEXT,
  matches_played INT,
  sample_size INT,
  goals_for_avg FLOAT,
  goals_against_avg FLOAT,
  ah_cover_rate FLOAT,
  ah_cover_rate_minus_025 FLOAT,
  ah_cover_rate_minus_075 FLOAT,
  ah_cover_rate_minus_100 FLOAT,
  ah_cover_rate_minus_150 FLOAT,
  ah_p_win_minus_050 FLOAT,
  ah_p_loss_minus_050 FLOAT,
  ah_p_win_minus_025 FLOAT,
  ah_p_half_loss_minus_025 FLOAT,
  ah_p_loss_minus_025 FLOAT,
  ah_expected_return_minus_025 FLOAT,
  ah_p_win_minus_075 FLOAT,
  ah_p_half_win_minus_075 FLOAT,
  ah_p_loss_minus_075 FLOAT,
  ah_expected_return_minus_075 FLOAT,
  ah_p_win_minus_100 FLOAT,
  ah_p_push_minus_100 FLOAT,
  ah_p_loss_minus_100 FLOAT,
  ah_expected_return_minus_100 FLOAT,
  ah_p_win_minus_150 FLOAT,
  ah_p_loss_minus_150 FLOAT,
  ou_over_15_rate FLOAT,
  ou_under_15_rate FLOAT,
  ou_over_25_rate FLOAT,
  ou_under_25_rate FLOAT,
  ou_over_35_rate FLOAT,
  ou_under_35_rate FLOAT,
  btts_yes_rate FLOAT,
  btts_no_rate FLOAT,
  clean_sheet_rate FLOAT,
  failed_to_score_rate FLOAT,
  first_half_goals_avg FLOAT,
  second_half_goals_avg FLOAT
)
LANGUAGE sql
STABLE
AS $$
  WITH point_in_time_matches AS (
    SELECT *
    FROM public.team_perspective_matches tpm
    WHERE LOWER(TRIM(tpm.team_name)) = LOWER(TRIM(p_team_name))
      AND tpm.venue = LOWER(p_venue)
      AND (p_season IS NULL OR tpm.season = p_season)
      -- ZERO FUTURE-DATA LEAKAGE INVARIANT
      AND tpm.match_time < p_as_of
  )
  SELECT
    p_team_name::VARCHAR AS team_name,
    COALESCE(MAX(league_id), 0)::INT AS league_id,
    COALESCE(MAX(season), p_season, 2026)::INT AS season,
    p_venue AS venue,
    COUNT(*)::INT AS matches_played,
    COUNT(*)::INT AS sample_size,
    ROUND(COALESCE(AVG(goals_for), 0)::numeric, 3)::FLOAT AS goals_for_avg,
    ROUND(COALESCE(AVG(goals_against), 0)::numeric, 3)::FLOAT AS goals_against_avg,
    ROUND((COUNT(*) FILTER (WHERE goal_diff >= 1)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS ah_cover_rate,
    ROUND((COUNT(*) FILTER (WHERE goal_diff >= 1)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS ah_cover_rate_minus_025,
    ROUND(((COUNT(*) FILTER (WHERE goal_diff >= 2)::numeric + 0.5 * COUNT(*) FILTER (WHERE goal_diff = 1)::numeric) / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS ah_cover_rate_minus_075,
    ROUND((COUNT(*) FILTER (WHERE goal_diff >= 2)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS ah_cover_rate_minus_100,
    ROUND((COUNT(*) FILTER (WHERE goal_diff >= 2)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS ah_cover_rate_minus_150,
    ROUND((COUNT(*) FILTER (WHERE goal_diff >= 1)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS ah_p_win_minus_050,
    ROUND((COUNT(*) FILTER (WHERE goal_diff <= 0)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS ah_p_loss_minus_050,
    ROUND((COUNT(*) FILTER (WHERE goal_diff >= 1)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS ah_p_win_minus_025,
    ROUND((COUNT(*) FILTER (WHERE goal_diff = 0)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS ah_p_half_loss_minus_025,
    ROUND((COUNT(*) FILTER (WHERE goal_diff <= -1)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS ah_p_loss_minus_025,
    ROUND(((COUNT(*) FILTER (WHERE goal_diff >= 1)::numeric * 1.0 + COUNT(*) FILTER (WHERE goal_diff = 0)::numeric * (-0.5) + COUNT(*) FILTER (WHERE goal_diff <= -1)::numeric * (-1.0)) / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS ah_expected_return_minus_025,
    ROUND((COUNT(*) FILTER (WHERE goal_diff >= 2)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS ah_p_win_minus_075,
    ROUND((COUNT(*) FILTER (WHERE goal_diff = 1)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS ah_p_half_win_minus_075,
    ROUND((COUNT(*) FILTER (WHERE goal_diff <= 0)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS ah_p_loss_minus_075,
    ROUND(((COUNT(*) FILTER (WHERE goal_diff >= 2)::numeric * 1.0 + COUNT(*) FILTER (WHERE goal_diff = 1)::numeric * 0.5 + COUNT(*) FILTER (WHERE goal_diff <= 0)::numeric * (-1.0)) / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS ah_expected_return_minus_075,
    ROUND((COUNT(*) FILTER (WHERE goal_diff >= 2)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS ah_p_win_minus_100,
    ROUND((COUNT(*) FILTER (WHERE goal_diff = 1)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS ah_p_push_minus_100,
    ROUND((COUNT(*) FILTER (WHERE goal_diff <= 0)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS ah_p_loss_minus_100,
    ROUND(((COUNT(*) FILTER (WHERE goal_diff >= 2)::numeric * 1.0 + COUNT(*) FILTER (WHERE goal_diff <= 0)::numeric * (-1.0)) / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS ah_expected_return_minus_100,
    ROUND((COUNT(*) FILTER (WHERE goal_diff >= 2)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS ah_p_win_minus_150,
    ROUND((COUNT(*) FILTER (WHERE goal_diff <= 1)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS ah_p_loss_minus_150,
    ROUND((COUNT(*) FILTER (WHERE total_goals >= 2)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS ou_over_15_rate,
    ROUND((COUNT(*) FILTER (WHERE total_goals <= 1)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS ou_under_15_rate,
    ROUND((COUNT(*) FILTER (WHERE total_goals >= 3)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS ou_over_25_rate,
    ROUND((COUNT(*) FILTER (WHERE total_goals <= 2)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS ou_under_25_rate,
    ROUND((COUNT(*) FILTER (WHERE total_goals >= 4)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS ou_over_35_rate,
    ROUND((COUNT(*) FILTER (WHERE total_goals <= 3)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS ou_under_35_rate,
    ROUND((COUNT(*) FILTER (WHERE goals_for >= 1 AND goals_against >= 1)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS btts_yes_rate,
    ROUND((COUNT(*) FILTER (WHERE goals_for = 0 OR goals_against = 0)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS btts_no_rate,
    ROUND((COUNT(*) FILTER (WHERE goals_against = 0)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS clean_sheet_rate,
    ROUND((COUNT(*) FILTER (WHERE goals_for = 0)::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::FLOAT AS failed_to_score_rate,
    ROUND(COALESCE(AVG(ht_goals_for + ht_goals_against), 0)::numeric, 3)::FLOAT AS first_half_goals_avg,
    ROUND(COALESCE(AVG((goals_for + goals_against) - COALESCE(ht_goals_for + ht_goals_against, 0)), 0)::numeric, 3)::FLOAT AS second_half_goals_avg
  FROM point_in_time_matches;
$$;
