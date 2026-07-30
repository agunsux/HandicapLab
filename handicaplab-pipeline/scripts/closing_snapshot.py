#!/usr/bin/env python3
"""
Closing Snapshot Script — CRON 18:00 WIB (11:00 UTC)
======================================================
Fetches closing odds for CLV computation.
NO fixtures, NO team stats, NO model — just odds.

COST: 0 API-Football + 6 OddsPapi calls
"""

import logging
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import API_FOOTBALL_DAILY_LIMIT, ODDSPAPI_MONTHLY_LIMIT, CACHE_DIR
from cache.local_cache import LocalCache
from quota_guard import QuotaGuard, QuotaExceededError
from fetchers.oddspapi import OddsPapiFetcher
from services.supabase_client import SupabaseService

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("closing_snapshot")


def main():
    logger.info("=" * 60)
    logger.info("HANDICAPLAB CLOSING SNAPSHOT — STARTING")
    logger.info(f"Time: {datetime.now(timezone.utc).isoformat()}")
    logger.info("=" * 60)

    cache = LocalCache(CACHE_DIR)
    quota_guard = QuotaGuard(CACHE_DIR)

    # Log budgets
    quota_guard.log_budget("api_football", API_FOOTBALL_DAILY_LIMIT)
    quota_guard.log_budget("oddspapi", ODDSPAPI_MONTHLY_LIMIT)

    # Check OddsPapi quota only (no API-Football calls in this script)
    try:
        quota_guard.check("oddspapi", ODDSPAPI_MONTHLY_LIMIT)
    except QuotaExceededError as e:
        logger.critical(f"Quota check failed: {e}")
        sys.exit(1)

    # Fetch closing odds
    odds_fetcher = OddsPapiFetcher(cache, quota_guard)
    try:
        all_odds = odds_fetcher.get_all_odds("closing")
    except Exception as e:
        logger.error(f"Failed to fetch closing odds: {e}")
        sys.exit(1)

    if not all_odds:
        logger.info("No odds data returned. Exiting.")
        return

    logger.info(f"Fetched closing odds for {len(all_odds)} matches")

    # Save to Supabase
    try:
        supabase = SupabaseService()
        supabase.save_odds_snapshot("closing", all_odds)
    except Exception as e:
        logger.error(f"Failed to save closing snapshot: {e}")
        sys.exit(1)

    # Summary
    odds_count = quota_guard.get_count("oddspapi")
    logger.info("=" * 60)
    logger.info(f"CLOSING SNAPSHOT COMPLETE: {len(all_odds)} matches saved")
    logger.info(f"OddsPapi calls this month: {odds_count}/{ODDSPAPI_MONTHLY_LIMIT}")
    logger.info("=" * 60)

    odds_fetcher.close()


if __name__ == "__main__":
    main()
