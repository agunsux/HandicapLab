#!/usr/bin/env python3
"""
DRY RUN — End-to-End Logic Verification
=========================================
Tests the pipeline logic WITHOUT making real API calls.
Uses mock data to verify:
1. QuotaGuard counters increment correctly
2. LocalCache works (set/get/expiry)
3. Edge detection math is correct
4. Pick generation filters properly
5. All modules import without errors

Run: python scripts/dry_run.py
"""

import json
import logging
import os
import sys
import time
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import (
    API_FOOTBALL_DAILY_LIMIT,
    ODDSPAPI_MONTHLY_LIMIT,
    CACHE_DIR,
    MIN_EDGE_PCT,
    MIN_CONFIDENCE,
)
from cache.local_cache import LocalCache
from quota_guard import QuotaGuard, QuotaExceededError
from models.dixon_coles import DixonColesModel
from engine.edge_detector import EdgeDetector, Edge
from engine.pick_generator import PickGenerator, Pick

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("dry_run")

PASS = 0
FAIL = 0


def check(name: str, condition: bool, detail: str = ""):
    global PASS, FAIL
    if condition:
        PASS += 1
        logger.info(f"  ✅ {name}")
    else:
        FAIL += 1
        logger.error(f"  ❌ {name}: {detail}")


def test_local_cache():
    """Test LocalCache set/get/expiry/invalidation."""
    logger.info("\n📦 LocalCache Tests")
    cache = LocalCache(CACHE_DIR)

    # Set and get
    cache.set("test_key", {"hello": "world"})
    val = cache.get("test_key", ttl=3600)
    check("set/get roundtrip", val == {"hello": "world"})

    # Expiry
    cache.set("test_expire", "data")
    val = cache.get("test_expire", ttl=-1)  # Already expired
    check("cache expiry (negative TTL)", val is None)

    # Invalidation
    cache.set("test_invalidate", "data")
    cache.invalidate("test_invalidate")
    val = cache.get("test_invalidate", ttl=3600)
    check("cache invalidation", val is None)

    # Missing key
    val = cache.get("nonexistent_key", ttl=3600)
    check("missing key returns None", val is None)

    # Age tracking
    cache.set("test_age", "data")
    age = cache.get_age("test_age")
    check("cache age tracking", age is not None and age < 2)

    # Cleanup
    cache.invalidate("test_key")
    cache.invalidate("test_expire")
    cache.invalidate("test_age")


def test_quota_guard():
    """Test QuotaGuard daily/monthly tracking."""
    logger.info("\n🛡️ QuotaGuard Tests")
    guard = QuotaGuard(CACHE_DIR)
    guard.reset_for_testing()

    # Initial state
    check("api_football starts at 0", guard.get_count("api_football") == 0)
    check("oddspapi starts at 0", guard.get_count("oddspapi") == 0)

    # Increment
    guard.increment("api_football")
    guard.increment("api_football")
    guard.increment("oddspapi")
    check("api_football count = 2", guard.get_count("api_football") == 2)
    check("oddspapi count = 1", guard.get_count("oddspapi") == 1)

    # Remaining
    remaining = guard.get_remaining("api_football", API_FOOTBALL_DAILY_LIMIT)
    check("remaining = limit - used", remaining == API_FOOTBALL_DAILY_LIMIT - 2)

    # Check should not raise
    try:
        guard.check("api_football", API_FOOTBALL_DAILY_LIMIT)
        check("check() passes under limit", True)
    except QuotaExceededError:
        check("check() passes under limit", False)

    # Exceed limit
    guard._usage["api_football"]["count"] = API_FOOTBALL_DAILY_LIMIT
    guard._save()
    try:
        guard.check("api_football", API_FOOTBALL_DAILY_LIMIT)
        check("check() raises when over limit", False)
    except QuotaExceededError:
        check("check() raises when over limit", True)

    # Reset for next tests
    guard.reset_for_testing()


def test_dixon_coles():
    """Test Dixon-Coles model with synthetic data."""
    logger.info("\n🧮 Dixon-Coles Model Tests")
    cache = LocalCache(CACHE_DIR)
    model = DixonColesModel(cache)

    # Create synthetic training data
    matches = []
    teams = ["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Tottenham"]
    for i in range(100):
        import random
        home = random.choice(teams)
        away = random.choice([t for t in teams if t != home])
        matches.append({
            "home_team": home,
            "away_team": away,
            "home_goals": random.randint(0, 4),
            "away_goals": random.randint(0, 3),
            "timestamp": int(time.time()) - i * 86400,
        })

    # Train
    params = model.train(matches)
    check("model trains successfully", params is not None)
    check("home_advantage is reasonable", 0.0 < params["home_advantage"] < 1.0)
    check("all teams have attack params", len(params["attacks"]) == len(teams))
    check("all teams have defense params", len(params["defenses"]) == len(teams))

    # Predict
    result = model.predict("Arsenal", "Chelsea")
    check("predict returns dict", isinstance(result, dict))
    check("lambda_home > 0", result["lambda_home"] > 0)
    check("lambda_away > 0", result["lambda_away"] > 0)
    check("probabilities sum to ~1.0",
          abs(result["p_home_win"] + result["p_draw"] + result["p_away_win"] - 1.0) < 0.01)
    check("p_over_25 + p_under_25 = 1.0",
          abs(result["p_over_25"] + result["p_under_25"] - 1.0) < 0.01)
    check("ah_probabilities has all lines",
          len(result["ah_probabilities"]) == 8)

    # Fair odds
    fair = model.fair_odds(0.5)
    check("fair_odds(0.5) = 2.0", abs(fair - 2.0) < 0.01)
    fair = model.fair_odds(0.0)
    check("fair_odds(0.0) = 999", fair == 999.0)

    # Cache
    cache.invalidate("model_params")


def test_edge_detector():
    """Test edge detection logic."""
    logger.info("\n⚡ Edge Detector Tests")
    detector = EdgeDetector(min_edge_pct=3.0)

    model_result = {
        "lambda_home": 1.8,
        "lambda_away": 1.2,
        "p_home_win": 0.45,
        "p_draw": 0.25,
        "p_away_win": 0.30,
        "p_over_25": 0.55,
        "p_under_25": 0.45,
        "ah_probabilities": {"-0.5": 0.55, "0.0": 0.50},
    }

    match_odds = {
        "bookmakers": {
            "pinnacle": {
                "ml_home": 2.10,
                "ml_draw": 3.50,
                "ml_away": 3.80,
                "spread_line": -0.5,
                "spread_home_odds": 1.90,
                "spread_away_odds": 2.00,
                "total_line": 2.5,
                "total_over": 1.85,
                "total_under": 2.05,
            }
        }
    }

    edges = detector.detect_all(
        fixture_id=12345,
        league="EPL",
        home_team="Arsenal",
        away_team="Chelsea",
        model_result=model_result,
        match_odds=match_odds,
    )

    check("edges detected", len(edges) > 0)

    # Check edge math
    for edge in edges:
        check(f"edge_pct >= {MIN_EDGE_PCT}", edge.edge_pct >= MIN_EDGE_PCT)
        check("confidence 0-100", 0 <= edge.confidence <= 100)
        check("reasoning is non-empty", len(edge.reasoning) > 0)
        check("market_type is valid",
              edge.market_type in ("moneyline", "asian_handicap", "over_under"))

    # Test with no edge (tight odds — market odds better than fair)
    # Model: p_home=0.45 → fair=2.222, p_draw=0.25 → fair=4.000, p_away=0.30 → fair=3.333
    # Market odds must be >= fair/1.03 to have edge < 3%:
    #   home >= 2.157, draw >= 3.883, away >= 3.236
    tight_odds = {
        "bookmakers": {
            "pinnacle": {
                "ml_home": 2.20,
                "ml_draw": 3.90,
                "ml_away": 3.30,
            }
        }
    }
    tight_edges = detector.detect_all(
        fixture_id=12346,
        league="EPL",
        home_team="Arsenal",
        away_team="Chelsea",
        model_result=model_result,
        match_odds=tight_odds,
    )
    check("no edges with tight odds", len(tight_edges) == 0)


def test_pick_generator():
    """Test pick generation and filtering."""
    logger.info("\n🎯 Pick Generator Tests")
    generator = PickGenerator(min_confidence=70)

    # Create mock edges
    edges = [
        Edge(
            fixture_id=1, league="EPL",
            home_team="Arsenal", away_team="Chelsea",
            market_type="moneyline", prediction="HOME (Arsenal)",
            model_probability=0.55, fair_odds=1.82,
            market_odds=2.10, market_bookmaker="pinnacle",
            edge_pct=15.4, confidence=85,
            reasoning="Test reasoning",
        ),
        Edge(
            fixture_id=1, league="EPL",
            home_team="Arsenal", away_team="Chelsea",
            market_type="over_under", prediction="OVER 2.5",
            model_probability=0.60, fair_odds=1.67,
            market_odds=1.85, market_bookmaker="pinnacle",
            edge_pct=10.8, confidence=78,
            reasoning="Test reasoning",
        ),
        # Low confidence — should be filtered out
        Edge(
            fixture_id=2, league="La Liga",
            home_team="Barcelona", away_team="Real Madrid",
            market_type="moneyline", prediction="HOME (Barcelona)",
            model_probability=0.40, fair_odds=2.50,
            market_odds=2.60, market_bookmaker="pinnacle",
            edge_pct=4.0, confidence=65,
            reasoning="Low confidence test",
        ),
        # Anomaly — should be filtered out
        Edge(
            fixture_id=3, league="Bundesliga",
            home_team="Bayern", away_team="Dortmund",
            market_type="moneyline", prediction="HOME (Bayern)",
            model_probability=0.97, fair_odds=1.03,
            market_odds=1.50, market_bookmaker="pinnacle",
            edge_pct=45.0, confidence=95,
            reasoning="Anomaly test",
        ),
    ]

    picks = generator.generate_picks(edges)

    # Should have 1 pick (fixture 1, highest edge)
    check("1 pick from fixture 1", len(picks) == 1)
    if picks:
        check("pick is moneyline (highest edge)", picks[0].market_type == "moneyline")
        check("verdict is LAYAK (edge=15.4, conf=85)", picks[0].verdict == "LAYAK")
        check("status is PENDING", picks[0].status == "PENDING")

    # Test PANTAU verdict
    pantau_edge = Edge(
        fixture_id=4, league="Serie A",
        home_team="Milan", away_team="Inter",
        market_type="moneyline", prediction="HOME (Milan)",
        model_probability=0.52, fair_odds=1.92,
        market_odds=2.00, market_bookmaker="pinnacle",
        edge_pct=4.2, confidence=75,
        reasoning="Pantau test",
    )
    pantau_picks = generator.generate_picks([pantau_edge])
    check("PANTAU verdict (edge=4.2, conf=75)",
          len(pantau_picks) > 0 and pantau_picks[0].verdict == "PANTAU")


def test_module_imports():
    """Test all modules import without errors."""
    logger.info("\n📚 Module Import Tests")
    modules = [
        "config",
        "cache.local_cache",
        "quota_guard",
        "fetchers.api_football",
        "fetchers.oddspapi",
        "models.dixon_coles",
        "engine.edge_detector",
        "engine.pick_generator",
        "services.supabase_client",
    ]
    for mod_name in modules:
        try:
            __import__(mod_name)
            check(f"{mod_name} imports", True)
        except Exception as e:
            check(f"{mod_name} imports", False, str(e))


def test_quota_usage_persistence():
    """Test that quota_usage.json persists correctly."""
    logger.info("\n💾 Quota Persistence Test")
    guard = QuotaGuard(CACHE_DIR)
    guard.reset_for_testing()

    guard.increment("api_football")
    guard.increment("oddspapi")

    # Create a new guard instance (simulates restart)
    guard2 = QuotaGuard(CACHE_DIR)
    check("api_football persists", guard2.get_count("api_football") == 1)
    check("oddspapi persists", guard2.get_count("oddspapi") == 1)

    guard2.reset_for_testing()


def main():
    logger.info("=" * 60)
    logger.info("HANDICAPLAB PIPELINE — DRY RUN")
    logger.info(f"Time: {datetime.now(timezone.utc).isoformat()}")
    logger.info("=" * 60)

    test_module_imports()
    test_local_cache()
    test_quota_guard()
    test_quota_usage_persistence()
    test_dixon_coles()
    test_edge_detector()
    test_pick_generator()

    # Summary
    logger.info("\n" + "=" * 60)
    logger.info(f"DRY RUN RESULTS: {PASS} passed, {FAIL} failed")
    logger.info("=" * 60)

    if FAIL > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
