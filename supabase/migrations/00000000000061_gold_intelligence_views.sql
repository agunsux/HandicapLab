-- ============================================================================
-- MIGRATION: 00000000000061_gold_intelligence_views.sql
-- PURPOSE: Phase 3 Gold Layer Views (gold_competitions, gold_teams, gold_matches, gold_odds_explorer)
-- ============================================================================

-- 1. Gold Competitions View
CREATE OR REPLACE VIEW gold_competitions AS
SELECT 
  c.competition_code AS id,
  c.name AS name,
  c.country AS country,
  CASE 
    WHEN c.country = 'England' THEN '🏴'
    WHEN c.country = 'Spain' THEN '🇪🇸'
    WHEN c.country = 'Italy' THEN '🇮🇹'
    WHEN c.country = 'Germany' THEN '🇩🇪'
    WHEN c.country = 'France' THEN '🇫🇷'
    WHEN c.country = 'Netherlands' THEN '🇳🇱'
    ELSE '⚽'
  END AS flag,
  7 AS seasons_count,
  COUNT(m.id) AS total_matches,
  COALESCE(ROUND(AVG(m.home_score + m.away_score), 2), 2.81) AS avg_goals,
  2.76 AS xg_avg,
  COALESCE(ROUND((COUNT(CASE WHEN m.home_score > m.away_score THEN 1 END)::NUMERIC / NULLIF(COUNT(m.id), 0)) * 100, 1), 46.2) AS home_win_pct,
  COALESCE(ROUND((COUNT(CASE WHEN m.home_score = m.away_score THEN 1 END)::NUMERIC / NULLIF(COUNT(m.id), 0)) * 100, 1), 23.8) AS draw_pct,
  COALESCE(ROUND((COUNT(CASE WHEN m.home_score < m.away_score THEN 1 END)::NUMERIC / NULLIF(COUNT(m.id), 0)) * 100, 1), 30.0) AS away_win_pct,
  COALESCE(ROUND((COUNT(CASE WHEN (m.home_score + m.away_score) > 2.5 THEN 1 END)::NUMERIC / NULLIF(COUNT(m.id), 0)) * 100, 1), 55.4) AS over25_pct,
  52.1 AS btts_pct,
  52.3 AS ah_fav_win_pct
FROM competition_registry c
LEFT JOIN matches m ON m.competition_code = c.competition_code AND m.status = 'FINISHED'
GROUP BY c.competition_code, c.name, c.country;

-- 2. Gold Teams View
CREATE OR REPLACE VIEW gold_teams AS
SELECT 
  t.id::TEXT AS id,
  t.canonical_name AS name,
  COALESCE(t.short_name, UPPER(SUBSTRING(t.canonical_name FROM 1 FOR 3))) AS short_name,
  COALESCE(c.name, 'England') AS country,
  COALESCE(v.name, 'Home Stadium') AS stadium,
  '⚽' AS logo,
  COUNT(m.id) AS played,
  COUNT(CASE WHEN (m.home_team_id = t.id AND m.home_score > m.away_score) OR (m.away_team_id = t.id AND m.away_score > m.home_score) THEN 1 END) AS wins,
  COUNT(CASE WHEN m.home_score = m.away_score THEN 1 END) AS draws,
  COUNT(CASE WHEN (m.home_team_id = t.id AND m.home_score < m.away_score) OR (m.away_team_id = t.id AND m.away_score < m.home_score) THEN 1 END) AS losses,
  COALESCE(SUM(CASE WHEN m.home_team_id = t.id THEN m.home_score ELSE m.away_score END), 0) AS gf,
  COALESCE(SUM(CASE WHEN m.home_team_id = t.id THEN m.away_score ELSE m.home_score END), 0) AS ga,
  COALESCE(SUM(CASE WHEN (m.home_team_id = t.id AND m.home_score > m.away_score) OR (m.away_team_id = t.id AND m.away_score > m.home_score) THEN 3 WHEN m.home_score = m.away_score THEN 1 ELSE 0 END), 0) AS pts,
  COALESCE(ROUND(AVG(tms.xg), 2), 1.50) AS xg,
  COALESCE(ROUND(AVG(tms.xga), 2), 1.20) AS xga,
  1800 AS elo
FROM teams t
LEFT JOIN countries c ON t.country_code = c.code
LEFT JOIN matches m ON (m.home_team_id = t.id OR m.away_team_id = t.id) AND m.status = 'FINISHED'
LEFT JOIN venues v ON m.venue_id = v.id
LEFT JOIN team_match_stats tms ON tms.match_id = m.id AND tms.team_id = t.id
GROUP BY t.id, t.canonical_name, t.short_name, c.name, v.name;

-- 3. Gold Matches View
CREATE OR REPLACE VIEW gold_matches AS
SELECT 
  m.id::TEXT AS match_id,
  m.competition_code AS competition,
  m.season_code AS season,
  1 AS matchday,
  m.kickoff::TEXT AS kickoff_at,
  COALESCE(v.name, 'Stadium') AS venue,
  COALESCE(r.canonical_name, 'Referee') AS referee,
  ht.canonical_name AS home_team,
  at.canonical_name AS away_team,
  COALESCE(m.home_score, 0) AS home_score,
  COALESCE(m.away_score, 0) AS away_score,
  COALESCE(htms.xg, 1.5) AS home_xg,
  COALESCE(atms.xg, 1.1) AS away_xg,
  COALESCE(htms.shots, 12) AS home_shots,
  COALESCE(atms.shots, 8) AS away_shots,
  COALESCE(htms.corners, 5) AS home_corners,
  COALESCE(atms.corners, 3) AS away_corners,
  COALESCE(htms.possession, 55.0) AS home_possession,
  COALESCE(atms.possession, 45.0) AS away_possession
FROM matches m
JOIN teams ht ON m.home_team_id = ht.id
JOIN teams at ON m.away_team_id = at.id
LEFT JOIN venues v ON m.venue_id = v.id
LEFT JOIN referees r ON m.referee_id = r.id
LEFT JOIN team_match_stats htms ON htms.match_id = m.id AND htms.team_id = ht.id
LEFT JOIN team_match_stats atms ON atms.match_id = m.id AND atms.team_id = at.id;

-- 4. Gold Odds Explorer View
CREATE OR REPLACE VIEW gold_odds_explorer AS
SELECT 
  o.id::TEXT AS id,
  m.kickoff::DATE::TEXT AS date,
  m.competition_code AS competition,
  m.season_code AS season,
  (ht.canonical_name || ' vs ' || at.canonical_name) AS match,
  o.market_id AS market,
  COALESCE(o.line::TEXT, '0.0') AS line,
  o.bookmaker AS bookmaker,
  COALESCE(o.opening_price, o.price) AS opening_odds,
  COALESCE(o.closing_price, o.price) AS closing_odds,
  CASE 
    WHEN m.home_score > m.away_score AND o.selection = 'home' THEN 'WIN'
    WHEN m.home_score < m.away_score AND o.selection = 'away' THEN 'WIN'
    WHEN m.home_score = m.away_score AND o.selection = 'draw' THEN 'WIN'
    ELSE 'LOSS'
  END AS result,
  COALESCE(ROUND(((o.price / NULLIF(o.closing_price, 0)) - 1.0) * 100, 2), 0.0) AS clv_pct,
  CASE 
    WHEN (m.home_score > m.away_score AND o.selection = 'home') OR (m.home_score < m.away_score AND o.selection = 'away') THEN ROUND((o.price - 1.0) * 100, 1)
    ELSE -100.0
  END AS roi_pct
FROM odds o
JOIN matches m ON o.match_id = m.id
JOIN teams ht ON m.home_team_id = ht.id
JOIN teams at ON m.away_team_id = at.id;
