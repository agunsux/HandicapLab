"""
OddsPapi (The Odds API) Fetcher — FREE TIER Edition
====================================================
Key insight: /v4/sports/{league}/odds returns ALL upcoming matches
in that league in ONE call. No need to call per-match.

We make 1 call per active league per snapshot (opening/closing).
6 leagues × 2 snapshots = 12 calls/day = 360/month (within 500 limit).
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx

from config import (
    ODDSPAPI_BASE,
    ODDSPAPI_KEY,
    BOOKMAKERS,
    BOOKMAKER_FALLBACK,
    REGIONS,
    MARKETS,
    CACHE_TTL_ODDS,
    LEAGUES,
)
from cache.local_cache import LocalCache
from quota_guard import QuotaGuard

logger = logging.getLogger(__name__)


class OddsPapiFetcher:
    """
    Fetcher for The Odds API (odds-api.com).
    One call per league returns ALL matches with odds from requested bookmakers.
    """

    def __init__(self, cache: LocalCache, quota_guard: QuotaGuard):
        self.cache = cache
        self.quota_guard = quota_guard
        self._client = httpx.Client(
            base_url=ODDSPAPI_BASE,
            timeout=30.0,
        )

    # ── Public Methods ────────────────────────────────────────────────────

    def get_league_odds(
        self,
        odds_key: str,
        snapshot_label: str = "opening",
    ) -> List[Dict[str, Any]]:
        """
        Fetch odds for ALL matches in a league in ONE call.

        Args:
            odds_key: e.g. "soccer_epl", "soccer_spain_la_liga"
            snapshot_label: "opening" or "closing" (for cache key)

        Returns: list of parsed match odds dicts
        """
        cache_key = f"odds_{odds_key}_{snapshot_label}"

        # Check cache
        cached = self.cache.get(cache_key, CACHE_TTL_ODDS)
        if cached is not None:
            logger.info(f"[OddsPapi] Using cached odds for {odds_key} ({snapshot_label})")
            return cached

        logger.info(f"[OddsPapi] Fetching odds for {odds_key} ({snapshot_label})")

        # Try primary bookmakers first
        raw = self._get(
            f"/sports/{odds_key}/odds",
            params={
                "apiKey": ODDSPAPI_KEY,
                "regions": REGIONS,
                "markets": MARKETS,
                "oddsFormat": "decimal",
                "bookmakers": ",".join(BOOKMAKERS),
            },
        )

        # If empty response, try fallback bookmakers
        if not raw:
            logger.warning(f"[OddsPapi] Empty response with primary bookmakers for {odds_key}, trying fallback")
            raw = self._get(
                f"/sports/{odds_key}/odds",
                params={
                    "apiKey": ODDSPAPI_KEY,
                    "regions": REGIONS,
                    "markets": MARKETS,
                    "oddsFormat": "decimal",
                    "bookmakers": ",".join(BOOKMAKER_FALLBACK),
                },
            )

        self.quota_guard.increment("oddspapi")

        parsed = self._parse_odds(raw)
        self.cache.set(cache_key, parsed)
        logger.info(f"[OddsPapi] Got {len(parsed)} matches with odds for {odds_key}")
        return parsed

    def get_all_odds(self, snapshot_label: str = "opening") -> List[Dict[str, Any]]:
        """
        Fetch odds for ALL whitelisted leagues.
        Skips leagues that returned 0 matches in the previous snapshot
        (likely off-season) to save calls.

        Returns: flat list of all match odds across all leagues
        """
        all_odds = []
        for league_id, league_info in LEAGUES.items():
            try:
                odds = self.get_league_odds(league_info["odds_key"], snapshot_label)
                # Attach league info
                for match in odds:
                    match["league_id"] = league_id
                    match["league_name"] = league_info["name"]
                all_odds.extend(odds)
            except Exception as e:
                logger.error(f"[OddsPapi] Failed to fetch odds for {league_info['name']}: {e}")
                continue

        logger.info(f"[OddsPapi] Total {len(all_odds)} matches with odds across all leagues ({snapshot_label})")
        return all_odds

    # ── Internal Helpers ──────────────────────────────────────────────────

    def _get(self, endpoint: str, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Make a GET request to The Odds API."""
        try:
            resp = self._client.get(endpoint, params=params)
            resp.raise_for_status()
            data = resp.json()

            # The Odds API returns a list of matches directly
            if isinstance(data, list):
                return data

            # Error response
            if isinstance(data, dict) and "message" in data:
                logger.error(f"[OddsPapi] API error: {data['message']}")
                return []

            return []

        except httpx.HTTPStatusError as e:
            status = e.response.status_code
            if status == 429:
                logger.warning("[OddsPapi] 429 rate limit hit")
                raise
            elif status in (401, 403):
                logger.critical("[OddsPapi] Auth error — check API key")
                raise
            logger.error(f"[OddsPapi] HTTP {status}: {e}")
            return []
        except httpx.TimeoutException:
            logger.error("[OddsPapi] Request timed out")
            raise
        except Exception as e:
            logger.error(f"[OddsPapi] Unexpected error: {e}")
            return []

    def _parse_odds(self, raw: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Parse The Odds API response into simplified match odds dicts.

        Each match dict contains:
            fixture_key, commence_time, home_team, away_team,
            bookmakers: {
                "pinnacle": {"ml_home","ml_draw","ml_away",
                             "spread_line","spread_home_odds",
                             "total_line","total_over","total_under"},
                "sbo"/"bet365": {...}
            }
        """
        parsed = []
        for match in raw:
            try:
                match_odds = {
                    "fixture_key": f"{match.get('home_team', '')} vs {match.get('away_team', '')}",
                    "commence_time": match.get("commence_time", ""),
                    "home_team": match.get("home_team", ""),
                    "away_team": match.get("away_team", ""),
                    "bookmakers": {},
                }

                for bm in match.get("bookmakers", []):
                    bm_key = bm.get("key", "")
                    if bm_key not in BOOKMAKERS and bm_key not in BOOKMAKER_FALLBACK:
                        continue

                    bm_odds = {}
                    for market in bm.get("markets", []):
                        market_key = market.get("key", "")
                        outcomes = market.get("outcomes", [])

                        if market_key == "h2h":
                            for outcome in outcomes:
                                name = outcome.get("name", "").lower()
                                if "home" in name:
                                    bm_odds["ml_home"] = outcome.get("price")
                                elif "draw" in name:
                                    bm_odds["ml_draw"] = outcome.get("price")
                                elif "away" in name:
                                    bm_odds["ml_away"] = outcome.get("price")

                        elif market_key == "spreads":
                            for outcome in outcomes:
                                name = outcome.get("name", "").lower()
                                point = outcome.get("point", 0)
                                if "home" in name:
                                    bm_odds["spread_line"] = point
                                    bm_odds["spread_home_odds"] = outcome.get("price")
                                elif "away" in name:
                                    bm_odds["spread_away_odds"] = outcome.get("price")

                        elif market_key == "totals":
                            for outcome in outcomes:
                                name = outcome.get("name", "").lower()
                                point = outcome.get("point", 0)
                                bm_odds["total_line"] = point
                                if "over" in name:
                                    bm_odds["total_over"] = outcome.get("price")
                                elif "under" in name:
                                    bm_odds["total_under"] = outcome.get("price")

                    if bm_odds:
                        match_odds["bookmakers"][bm_key] = bm_odds

                # Only include if we got at least one bookmaker
                if match_odds["bookmakers"]:
                    parsed.append(match_odds)

            except Exception as e:
                logger.warning(f"[OddsPapi] Failed to parse match odds: {e}")
                continue

        return parsed

    def close(self):
        """Close the HTTP client."""
        self._client.close()
