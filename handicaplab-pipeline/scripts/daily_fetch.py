#!/usr/bin/env python3
"""
Daily Fetch Script — CRON 06:00 WIB (23:00 UTC)
=================================================
The main daily pipeline. Runs once per day to:
1. Check quota budgets
2. Fetch today's fixtures (1 API-Football call)
3. Fetch team stats (cached, ~0-4 calls)
4. Load model and predict each match
5. Detect edges vs market odds
6. Generate picks
7. Upsert to Supabase

COST: ~6 API-Football + 6 OddsPapi calls
"""

import logging
import os
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import (
    API_FOOTBALL_DAILY_LIMIT,
    ODDSPAPI_MONTHLY_LIMIT,
    CACHE_DIR,
    LEAGUES,
)
from cache.local_cache import LocalCache
from quota_guard import QuotaGuard, QuotaExceededError
from fetchers.api_football import APIFootballFetcher
from fetchers.oddspapi import OddsPapiFetcher
from models.dixon_coles import DixonColesModel
from engine.edge_detector import EdgeDetector
from engine.pick_generator import PickGenerator
from services.supabase_client import SupabaseService

# ── Logging Setup ──────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("daily_fetch")


def main():
    logger.info("=" * 60)
    logger.info("HANDICAPLAB DAILY FETCH — STARTING")
    logger.info(f"Time: {datetime.now(timezone.utc).isoformat()}")
    logger.info("=" * 60)

    # ── Initialise ───────────────────────────────────────────────────────
    cache = LocalCache(CACHE_DIR)
    quota_guard = QuotaGuard(CACHE_DIR)

    # Log budgets
    quota_guard.log_budget("api_football", API_FOOTBALL_DAILY_LIMIT)
    quota_guard.log_budget("oddspapi", ODDSPAPI_MONTHLY_LIMIT)

    # ── Step 1: Check quotas before starting ─────────────────────────────
    try:
        quota_guard.check("api_football", API_FOOTBALL_DAILY_LIMIT)
        quota_guard.check("oddspapi", ODDSPAPI_MONTHLY_LIMIT)
    except QuotaExceededError as e:
        logger.critical(f"Quota check failed: {e}")
        sys.exit(1)

    # ── Step 2: Fetch today's fixtures ───────────────────────────────────
    api_football = APIFootballFetcher(cache, quota_guard)
    try:
        fixtures = api_football.get_todays_fixtures()
    except Exception as e:
        logger.error(f"Failed to fetch fixtures: {e}")
        sys.exit(1)

    if not fixtures:
        logger.info("No fixtures today across all 6 leagues. Rest day. Exiting.")
        logger.info("=" * 60)
        return

    logger.info(f"Found {len(fixtures)} fixtures today")

    # ── Step 3: Load model ───────────────────────────────────────────────
    model = DixonColesModel(cache)
    try:
        model.load_or_train()  # Will use cached params
    except ValueError as e:
        logger.error(f"Model not available: {e}")
        logger.error("Run weekly_training.py first to train the model.")
        sys.exit(1)

    # ── Step 4: Process each fixture ─────────────────────────────────────
    edge_detector = EdgeDetector()
    pick_generator = PickGenerator()
    all_edges: List[Any] = []

    for fixture in fixtures:
        fixture_id = fixture["fixture_id"]
        league_id = fixture["league_id"]
        league_name = fixture["league_name"]
        home_team = fixture["home_team"]
        away_team = fixture["away_team"]
        home_id = fixture["home_id"]
        away_id = fixture["away_id"]
        kickoff_utc = fixture["kickoff_utc"]

        logger.info(f"Processing: {home_team} vs {away_team} ({league_name})")

        try:
            # Get team stats (cached)
            stats_home = api_football.get_team_stats(home_id, league_id)
            stats_away = api_football.get_team_stats(away_id, league_id)

            # Run model prediction
            model_result = model.predict(home_team, away_team)

            # Check for anomaly
            if model_result["p_home_win"] > 0.95 or model_result["p_home_win"] < 0.05:
                logger.warning(f"Anomalous probability for {home_team} vs {away_team}: "
                               f"p_home={model_result['p_home_win']:.4f}. Skipping edge detection.")
                continue

            # We'll attach odds later (Step 5)
            # For now, store the model result for later matching
            fixture["_model_result"] = model_result
            fixture["_stats_home"] = stats_home
            fixture["_stats_away"] = stats_away

        except Exception as e:
            logger.error(f"Failed to process {home_team} vs {away_team}: {e}")
            continue

    # ── Step 5: Fetch opening odds and detect edges ──────────────────────
    odds_fetcher = OddsPapiFetcher(cache, quota_guard)
    try:
        all_odds = odds_fetcher.get_all_odds("opening")
    except Exception as e:
        logger.error(f"Failed to fetch odds: {e}")
        all_odds = []

    # Match odds to fixtures via fuzzy name matching
    import difflib

    for fixture in fixtures:
        model_result = fixture.pop("_model_result", None)
        stats_home = fixture.pop("_stats_home", None)
        stats_away = fixture.pop("_stats_away", None)

        if not model_result:
            continue

        # Find matching odds
        match_odds = None
        for odds in all_odds:
            home_sim = difflib.SequenceMatcher(
                None, fixture["home_team"].lower(), odds.get("home_team", "").lower()
            ).ratio()
            away_sim = difflib.SequenceMatcher(
                None, fixture["away_team"].lower(), odds.get("away_team", "").lower()
            ).ratio()

            if home_sim >= 0.85 and away_sim >= 0.85:
                match_odds = odds
                break

        if not match_odds:
            logger.debug(f"No odds found for {fixture['home_team']} vs {fixture['away_team']}")
            continue

        # Detect edges
        edges = edge_detector.detect_all(
            fixture_id=fixture["fixture_id"],
            league=fixture["league_name"],
            home_team=fixture["home_team"],
            away_team=fixture["away_team"],
            model_result=model_result,
            match_odds=match_odds,
            team_stats_home=stats_home,
            team_stats_away=stats_away,
        )
        all_edges.extend(edges)

    # ── Step 6: Generate picks ───────────────────────────────────────────
    picks = pick_generator.generate_picks(all_edges)

    if not picks:
        logger.info("No actionable picks generated today.")
    else:
        logger.info(f"Generated {len(picks)} picks:")
        for pick in picks:
            logger.info(f"  [{pick.verdict}] {pick.home_team} vs {pick.away_team} → "
                        f"{pick.prediction} (edge={pick.edge_pct:.1f}%, conf={pick.confidence})")

    # ── Step 7: Upsert to Supabase ───────────────────────────────────────
    try:
        supabase = SupabaseService()
        supabase.upsert_daily_picks(picks)
        supabase.save_odds_snapshot("opening", all_odds)
    except Exception as e:
        logger.error(f"Failed to write to Supabase: {e}")
        # Don't exit — the pipeline should still report success for the data work

    # ── Summary ──────────────────────────────────────────────────────────
    api_count = quota_guard.get_count("api_football")
    odds_count = quota_guard.get_count("oddspapi")
    logger.info("=" * 60)
    logger.info(f"SUMMARY: {len(fixtures)} matches, {len(picks)} picks")
    logger.info(f"API-Football calls today: {api_count}/{API_FOOTBALL_DAILY_LIMIT}")
    logger.info(f"OddsPapi calls this month: {odds_count}/{ODDSPAPI_MONTHLY_LIMIT}")
    logger.info("DAILY FETCH COMPLETE")
    logger.info("=" * 60)

    # Cleanup
    api_football.close()
    odds_fetcher.close()


if __name__ == "__main__":
    main()
