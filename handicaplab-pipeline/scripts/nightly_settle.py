#!/usr/bin/env python3
"""
Nightly Settle Script — CRON 23:55 WIB (16:55 UTC)
====================================================
Settles picks using yesterday's actual match results.

COST: 1 API-Football + 0 OddsPapi calls
"""

import logging
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import API_FOOTBALL_DAILY_LIMIT, ODDSPAPI_MONTHLY_LIMIT, CACHE_DIR
from cache.local_cache import LocalCache
from quota_guard import QuotaGuard, QuotaExceededError
from fetchers.api_football import APIFootballFetcher
from services.supabase_client import SupabaseService

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("nightly_settle")


def main():
    logger.info("=" * 60)
    logger.info("HANDICAPLAB NIGHTLY SETTLE — STARTING")
    logger.info(f"Time: {datetime.now(timezone.utc).isoformat()}")
    logger.info("=" * 60)

    cache = LocalCache(CACHE_DIR)
    quota_guard = QuotaGuard(CACHE_DIR)

    # Log budgets
    quota_guard.log_budget("api_football", API_FOOTBALL_DAILY_LIMIT)
    quota_guard.log_budget("oddspapi", ODDSPAPI_MONTHLY_LIMIT)

    # Check API-Football quota
    try:
        quota_guard.check("api_football", API_FOOTBALL_DAILY_LIMIT)
    except QuotaExceededError as e:
        logger.critical(f"Quota check failed: {e}")
        sys.exit(1)

    # Fetch yesterday's results
    api_football = APIFootballFetcher(cache, quota_guard)
    try:
        results = api_football.get_yesterday_results()
    except Exception as e:
        logger.error(f"Failed to fetch results: {e}")
        sys.exit(1)

    if not results:
        logger.info("No completed matches from yesterday. Exiting.")
        return

    logger.info(f"Found {len(results)} completed matches from yesterday")

    # Settle picks
    supabase = SupabaseService()
    settled_count = 0
    won = 0
    lost = 0
    pushed = 0

    for match in results:
        fixture_id = match["fixture_id"]
        home_goals = match["home_goals"]
        away_goals = match["away_goals"]

        # Determine results for each market type
        # Moneyline
        if home_goals > away_goals:
            ml_result = "HOME"
        elif home_goals == away_goals:
            ml_result = "DRAW"
        else:
            ml_result = "AWAY"

        # Over/Under 2.5
        total_goals = home_goals + away_goals
        ou_result = "OVER" if total_goals > 2.5 else "UNDER"

        # Asian Handicap (simplified: home -0.5)
        ah_result = "HOME" if home_goals > away_goals else "AWAY"

        # Settle moneyline picks
        if supabase.settle_pick(fixture_id, "moneyline", ml_result, home_goals, away_goals):
            settled_count += 1
            if ml_result in ("HOME", "AWAY", "DRAW"):
                won += 1

        # Settle over/under picks
        if supabase.settle_pick(fixture_id, "over_under", ou_result, home_goals, away_goals):
            settled_count += 1
            if ou_result == "OVER":
                won += 1

        # Settle Asian Handicap picks
        if supabase.settle_pick(fixture_id, "asian_handicap", ah_result, home_goals, away_goals):
            settled_count += 1
            if ah_result == "HOME":
                won += 1

    # Update track record
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    supabase.update_track_record(
        date=today,
        total_picks=settled_count,
        won=won,
        lost=lost,
        pushed=pushed,
        total_edge_pct=0.0,  # Will be computed from picks
    )

    # Summary
    api_count = quota_guard.get_count("api_football")
    logger.info("=" * 60)
    logger.info(f"SETTLEMENT COMPLETE: {settled_count} picks settled")
    logger.info(f"Results: {won} WON / {lost} LOST / {pushed} PUSHED")
    logger.info(f"API-Football calls today: {api_count}/{API_FOOTBALL_DAILY_LIMIT}")
    logger.info("=" * 60)

    api_football.close()


if __name__ == "__main__":
    main()
