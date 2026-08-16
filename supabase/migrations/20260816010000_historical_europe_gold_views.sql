-- ============================================================================
-- EPIC: Historical European Gold Layer — wire the Historical UI gold views to
-- the real historical_* tables. Idempotent (CREATE OR REPLACE VIEW). After this
-- migration is applied, goldService.ts and the Historical UI read REAL records.
-- Metrics the dataset does not provide (xG, venue, referee, CLV/ROI, AH-fav%)
-- are NULL — never fabricated.
-- ============================================================================

-- 1. gold_competitions — real per-league aggregates over historical_matches
CREATE OR REPLACE VIEW gold_competitions AS
SELECT
  lm.league_id AS id,
  lm.name,
  lm.country,
  CASE lm.country
    WHEN 'England' THEN 'GB-ENG'
    WHEN 'Spain' THEN 'ES'
    WHEN 'Germany' THEN 'DE'
    WHEN 'Italy' THEN 'IT'
    WHEN 'France' THEN 'FR'
    ELSE 'UEFA'
  END AS flag,
  COUNT(DISTINCT m.season) AS seasons_count,
  COUNT(m.canonical_id) AS total_matches,
  ROUND(COALESCE(AVG(m.total_goals), 0), 2) AS avg_goals,
  NULL AS xg_avg,
  ROUND(100.0 * COUNT(*) FILTER (WHERE m.home_win) / NULLIF(COUNT(*), 0), 1) AS home_win_pct,
  ROUND(100.0 * COUNT(*) FILTER (WHERE m.draw) / NULLIF(COUNT(*), 0), 1) AS draw_pct,
  ROUND(100.0 * COUNT(*) FILTER (WHERE m.away_win) / NULLIF(COUNT(*), 0), 1) AS away_win_pct,
  ROUND(100.0 * COUNT(*) FILTER (WHERE m.over25) / NULLIF(COUNT(*), 0), 1) AS over25_pct,
  ROUND(100.0 * COUNT(*) FILTER (WHERE m.btts) / NULLIF(COUNT(*), 0), 1) AS btts_pct,
  NULL AS ah_fav_win_pct
FROM public.historical_league_meta lm
LEFT JOIN public.historical_matches m ON m.league_id = lm.league_id AND lm.status = 'INCLUDED'
GROUP BY lm.league_id, lm.name, lm.country;

-- 2. gold_teams — real per-team aggregates derived from home+away scores
CREATE OR REPLACE VIEW gold_teams AS
WITH sides AS (
  SELECT m.league_id, m.home_team AS team, m.home_goals AS gf_side, m.away_goals AS ga_side,
         CASE WHEN m.home_win THEN 'W' WHEN m.draw THEN 'D' ELSE 'L' END AS side_result
  FROM public.historical_matches m
  UNION ALL
  SELECT m.league_id, m.away_team AS team, m.away_goals AS gf_side, m.home_goals AS ga_side,
         CASE WHEN m.away_win THEN 'W' WHEN m.draw THEN 'D' ELSE 'L' END AS side_result
  FROM public.historical_matches m
)
SELECT
  (s.league_id || '|' || s.team) AS id,
  s.team AS name,
  UPPER(LEFT(REPLACE(s.team, ' ', ''), 3)) AS short_name,
  COALESCE(lm.country, '') AS country,
  NULL AS stadium,
  NULL AS logo,
  COUNT(*) AS played,
  COUNT(*) FILTER (WHERE s.side_result = 'W') AS wins,
  COUNT(*) FILTER (WHERE s.side_result = 'D') AS draws,
  COUNT(*) FILTER (WHERE s.side_result = 'L') AS losses,
  SUM(s.gf_side) AS gf,
  SUM(s.ga_side) AS ga,
  SUM(CASE s.side_result WHEN 'W' THEN 3 WHEN 'D' THEN 1 ELSE 0 END) AS pts,
  NULL AS xg,
  NULL AS xga,
  NULL AS elo,
  NULL AS form_last_5
FROM sides s
JOIN public.historical_league_meta lm ON lm.league_id = s.league_id AND lm.status = 'INCLUDED'
GROUP BY s.league_id, s.team, lm.country;

-- 3. gold_matches — real historical matches (+ raw ML odds columns)
CREATE OR REPLACE VIEW gold_matches AS
SELECT
  m.canonical_id AS match_id,
  m.league_id AS competition,
  m.season,
  1 AS matchday,
  m.match_date::TEXT AS kickoff_at,
  NULL AS venue,
  NULL AS referee,
  m.home_team,
  m.away_team,
  m.home_goals AS home_score,
  m.away_goals AS away_score,
  NULL AS home_xg,
  NULL AS away_xg,
  NULL AS home_shots,
  NULL AS away_shots,
  NULL AS home_corners,
  NULL AS away_corners,
  NULL AS home_possession,
  NULL AS away_possession,
  o.ml_h, o.ml_d, o.ml_a
FROM public.historical_matches m
LEFT JOIN public.historical_odds o USING (canonical_id);

-- 4. gold_odds_explorer — real 1X2 opening rows from historical_odds (with the
--    actual source bookmaker + closing reference where present; CLV/ROI NULL
--    until the next EPIC). Result derived from the actual scoreline.
CREATE OR REPLACE VIEW gold_odds_explorer AS
SELECT
  o.odds_id AS id,
  o.match_date::TEXT AS date,
  o.league_id AS competition,
  o.season,
  (m.home_team || ' vs ' || m.away_team) AS match,
  'Moneyline' AS market,
  '0' AS line,
  CASE o.bookmaker_source WHEN 'pinnacle' THEN 'Pinnacle' WHEN 'bet365' THEN 'Bet365' WHEN 'betbrain' THEN 'BetBrain' ELSE o.bookmaker_source END AS bookmaker,
  o.home_odds AS opening_odds,
  (SELECT mlc.home_odds FROM public.historical_odds mlc
   WHERE mlc.canonical_id = o.canonical_id AND mlc.market = 'ML' AND mlc.observation = 'closing'
     AND mlc.bookmaker_source = o.bookmaker_source LIMIT 1) AS closing_odds,
  CASE WHEN m.result = 'H' THEN 'WIN' ELSE 'LOSS' END AS result,
  NULL AS clv_pct,
  NULL AS roi_pct
FROM public.historical_odds o
JOIN public.historical_matches m ON m.canonical_id = o.canonical_id
WHERE o.market = 'ML' AND o.observation = 'opening';
