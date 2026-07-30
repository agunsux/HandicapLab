"""
API-Football Fetcher — FREE TIER Edition
=========================================
Minimises calls via aggressive caching and single-call-per-day batching.

Key design decisions:
- /fixtures?date= returns ALL leagues in ONE call → filter client-side
- Team stats cached for 48h (most teams already cached on typical day)
- Yesterday results fetched in 1 call for settlement
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import httpx

from config import (
    API_FOOTBALL_BASE,
    API_FOOTBALL_KEY,
    CACHE_TTL_FIXTURES,
    CACHE_TTL_TEAM_STATS,
    LEAGUES,
)
from cache.local_cache import LocalCache
from quota_guard import QuotaGuard

logger = logging.getLogger(__name__)

# Whitelist of league IDs for client-side filtering
WHITELIST_IDS = set(LEAGUES.keys())


class APIFootballFetcher:
    """
    Fetcher for API-Football (api-sports.io).
    Every public method checks cache first, then calls API only if needed.
    """

    def __init__(self, cache: LocalCache, quota_guard: QuotaGuard):
        self.cache = cache
        self.quota_guard = quota_guard
        self._client = httpx.Client(
            base_url=API_FOOTBALL_BASE,
            headers={
                "x-apisports-key": API_FOOTBALL_KEY,
                "x-rapidapi-host": "v3.football.api-sports.io",
            },
            timeout=30.0,
        )

    # ── Public Methods ────────────────────────────────────────────────────

    def get_todays_fixtures(self) -> List[Dict[str, Any]]:
        """
        Fetch ALL fixtures for today in ONE API call.
        Filters client-side to whitelisted leagues.

        Returns: list of {fixture_id, league_id, league_name, home_team,
                          away_team, home_id, away_id, kickoff_utc, status}
        """
        today_utc = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        cache_key = f"fixtures_{today_utc}"

        # Check cache first
        cached = self.cache.get(cache_key, CACHE_TTL_FIXTURES)
        if cached is not None:
            logger.info(f"[API-Football] Using cached fixtures for {today_utc}")
            return cached

        # Fetch from API
        logger.info(f"[API-Football] Fetching fixtures for {today_utc}")
        raw = self._get(f"/fixtures", params={"date": today_utc})
        self.quota_guard.increment("api_football")

        fixtures = self._parse_fixtures(raw)
        self.cache.set(cache_key, fixtures)
        logger.info(f"[API-Football] Got {len(fixtures)} fixtures across {len(WHITELIST_IDS)} leagues")
        return fixtures

    def get_team_stats(self, team_id: int, league_id: int) -> Optional[Dict[str, Any]]:
        """
        Fetch team statistics for a given team and league.
        Cached for 48h — most teams are cached on a typical day.

        Returns dict with:
            goals_for_avg_home, goals_against_avg_home,
            goals_for_avg_away, goals_against_avg_away,
            matches_played_home, matches_played_away, form_last_5
        or None if unavailable.
        """
        cache_key = f"team_{team_id}_{league_id}"

        cached = self.cache.get(cache_key, CACHE_TTL_TEAM_STATS)
        if cached is not None:
            return cached

        # Determine current season
        season = self._current_season()

        logger.info(f"[API-Football] Fetching stats for team {team_id} in league {league_id}")
        raw = self._get(
            "/teams/statistics",
            params={"league": league_id, "team": team_id, "season": season},
        )
        self.quota_guard.increment("api_football")

        stats = self._parse_team_stats(raw)
        if stats:
            self.cache.set(cache_key, stats)
        return stats

    def get_yesterday_results(self) -> List[Dict[str, Any]]:
        """
        Fetch yesterday's completed match results in ONE API call.
        Used by nightly_settle.py to settle picks.

        Returns: list of {fixture_id, home_goals, away_goals, home_id, away_id}
        """
        yesterday_utc = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
        cache_key = f"results_{yesterday_utc}"

        cached = self.cache.get(cache_key, CACHE_TTL_FIXTURES)
        if cached is not None:
            logger.info(f"[API-Football] Using cached results for {yesterday_utc}")
            return cached

        logger.info(f"[API-Football] Fetching results for {yesterday_utc}")
        raw = self._get("/fixtures", params={"date": yesterday_utc})
        self.quota_guard.increment("api_football")

        results = self._parse_results(raw)
        self.cache.set(cache_key, results)
        logger.info(f"[API-Football] Got {len(results)} completed matches")
        return results

    def get_historical_season(self, league_id: int, season: str) -> List[Dict[str, Any]]:
        """
        Fetch all fixtures for a league+season (one-time use for model training).
        Cost: 1 call per league per season.

        Returns: list of {fixture_id, home_team, away_team, home_goals,
                          away_goals, timestamp, status}
        """
        cache_key = f"historical_{league_id}_{season}"

        cached = self.cache.get(cache_key, 86400 * 365)  # 1 year TTL
        if cached is not None:
            return cached

        logger.info(f"[API-Football] Fetching historical season {season} for league {league_id}")
        raw = self._get("/fixtures", params={"league": league_id, "season": season})
        self.quota_guard.increment("api_football")

        results = self._parse_historical(raw)
        self.cache.set(cache_key, results)
        logger.info(f"[API-Football] Got {len(results)} historical matches for league {league_id}")
        return results

    # ── Internal Helpers ──────────────────────────────────────────────────

    def _get(self, endpoint: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Make a GET request with error handling."""
        try:
            resp = self._client.get(endpoint, params=params)
            resp.raise_for_status()
            data = resp.json()

            # API-Football wraps responses in { "get": ..., "parameters": ..., "results": ..., "response": [...] }
            if data.get("errors") and any(data["errors"].values()):
                errors = {k: v for k, v in data["errors"].items() if v}
                raise RuntimeError(f"API-Football error: {errors}")

            return data
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                logger.warning("[API-Football] 429 rate limit hit")
                raise
            elif e.response.status_code in (401, 403):
                logger.critical("[API-Football] Auth error — check API key")
                raise
            raise
        except httpx.TimeoutException:
            logger.error("[API-Football] Request timed out")
            raise

    def _parse_fixtures(self, raw: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Parse /fixtures response into simplified fixture dicts."""
        fixtures = []
        for item in raw.get("response", []):
            league_id = item.get("league", {}).get("id")
            if league_id not in WHITELIST_IDS:
                continue

            fixture = item.get("fixture", {})
            teams = item.get("teams", {})

            fixtures.append({
                "fixture_id": fixture.get("id"),
                "league_id": league_id,
                "league_name": item.get("league", {}).get("name", ""),
                "home_team": teams.get("home", {}).get("name", ""),
                "away_team": teams.get("away", {}).get("name", ""),
                "home_id": teams.get("home", {}).get("id"),
                "away_id": teams.get("away", {}).get("id"),
                "kickoff_utc": fixture.get("date", ""),
                "status": fixture.get("status", {}).get("short", ""),
            })
        return fixtures

    def _parse_team_stats(self, raw: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Parse /teams/statistics response."""
        response = raw.get("response", {})
        if not response:
            return None

        goals = response.get("goals", {})
        home_goals = goals.get("for", {}).get("home", {}) or {}
        away_goals = goals.get("for", {}).get("away", {}) or {}
        against_home = goals.get("against", {}).get("home", {}) or {}
        against_away = goals.get("against", {}).get("away", {}) or {}

        form = response.get("form", "")
        fixtures_data = response.get("fixtures", {}) or {}
        home_played = (fixtures_data.get("played", {}) or {}).get("home", 0) or 0
        away_played = (fixtures_data.get("played", {}) or {}).get("away", 0) or 0

        return {
            "goals_for_avg_home": self._safe_avg(home_goals, home_played),
            "goals_against_avg_home": self._safe_avg(against_home, home_played),
            "goals_for_avg_away": self._safe_avg(away_goals, away_played),
            "goals_against_avg_away": self._safe_avg(against_away, away_played),
            "matches_played_home": home_played,
            "matches_played_away": away_played,
            "form_last_5": self._parse_form(form),
        }

    def _parse_results(self, raw: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Parse /fixtures response for completed matches only."""
        results = []
        for item in raw.get("response", []):
            league_id = item.get("league", {}).get("id")
            if league_id not in WHITELIST_IDS:
                continue

            status = item.get("fixture", {}).get("status", {}).get("short", "")
            if status not in ("FT", "AET", "PEN"):
                continue

            goals = item.get("goals", {})
            teams = item.get("teams", {})

            results.append({
                "fixture_id": item.get("fixture", {}).get("id"),
                "home_goals": goals.get("home"),
                "away_goals": goals.get("away"),
                "home_id": teams.get("home", {}).get("id"),
                "away_id": teams.get("away", {}).get("id"),
                "home_team": teams.get("home", {}).get("name", ""),
                "away_team": teams.get("away", {}).get("name", ""),
                "league_id": league_id,
            })
        return results

    def _parse_historical(self, raw: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Parse /fixtures response for historical data (all statuses)."""
        matches = []
        for item in raw.get("response", []):
            fixture = item.get("fixture", {})
            teams = item.get("teams", {})
            goals = item.get("goals", {})

            matches.append({
                "fixture_id": fixture.get("id"),
                "home_team": teams.get("home", {}).get("name", ""),
                "away_team": teams.get("away", {}).get("name", ""),
                "home_goals": goals.get("home"),
                "away_goals": goals.get("away"),
                "timestamp": fixture.get("timestamp"),
                "status": fixture.get("status", {}).get("short", ""),
                "league_id": item.get("league", {}).get("id"),
            })
        return matches

    @staticmethod
    def _safe_avg(stats_dict: dict, divisor: int) -> float:
        """Safely compute average, return 0.0 if no data."""
        total = sum(
            v for k, v in stats_dict.items()
            if isinstance(v, (int, float)) and k != "total"
        )
        return round(total / divisor, 2) if divisor > 0 else 0.0

    @staticmethod
    def _parse_form(form_str: str) -> List[str]:
        """Parse form string like 'WWDLW' into list."""
        if not form_str:
            return []
        return list(form_str[-5:]) if len(form_str) >= 5 else list(form_str)

    @staticmethod
    def _current_season() -> str:
        """Determine the current season string (e.g., '2026')."""
        now = datetime.now(timezone.utc)
        year = now.year
        # If we're in Jan-June, season started last year
        if now.month <= 6:
            return str(year - 1)
        return str(year)

    def close(self):
        """Close the HTTP client."""
        self._client.close()
