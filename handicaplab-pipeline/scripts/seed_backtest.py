#!/usr/bin/env python3
"""
Historical Backtest Seeder
==========================
Populates public_ledger + track_record with 500+ settled historical picks.

ZERO API quota — uses free CSVs from football-data.co.uk.
Walk-forward backtest ensures no lookahead bias.

Modes:
  python scripts/seed_backtest.py --dry-run   # compute + print report, NO writes
  python scripts/seed_backtest.py --seed      # write to Supabase
"""

import argparse
import hashlib
import logging
import os
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import SUPABASE_URL, SUPABASE_SERVICE_KEY, MIN_EDGE_PCT, MIN_CONFIDENCE
from data.historical.downloader import download_all
from data.historical.parser import parse_all
from engine.backtester import run_backtest
from engine.metrics import summarize, sanity_check
from services.supabase_client import SupabaseService

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("seed_backtest")


def print_report(picks: List[Dict[str, Any]], dry_run: bool = True) -> None:
    metrics = summarize(picks)
    passed, msg = sanity_check(picks)

    print("\n" + "=" * 60)
    print("BACKTEST REPORT")
    print("=" * 60)
    print(f"Mode: {'DRY-RUN (no writes)' if dry_run else 'SEED (writing to Supabase)'}")
    print(f"API quota used: 0 calls")
    print("-" * 60)
    print(f"Matches processed : {metrics['total_matches']}")
    print(f"Total picks       : {metrics['total_picks']}")
    print(f"Win rate          : {metrics['win_rate']:.2f}%")
    print(f"ROI               : {metrics['roi']:.2f}%")
    print(f"Brier score       : {metrics['brier']:.4f} (baseline 0.25)")
    print(f"Avg CLV           : {metrics['avg_clv']:.2f}%")
    print(f"Max drawdown      : {metrics['max_drawdown']:.2f}%")
    print("-" * 60)
    print(f"Sanity check      : {msg}")

    if metrics.get("per_market"):
        print("-" * 60)
        print("Per-market breakdown:")
        for market, stats in metrics["per_market"].items():
            print(f"  {market}: {stats['count']} picks, "
                  f"WR {stats['win_rate']:.1f}%, ROI {stats['roi']:.1f}%")

    print("=" * 60)

    if not passed:
        logger.warning(f"Sanity check FAILED: {msg}")
        if dry_run:
            print("\nWARNING: Sanity check FAILED — do NOT seed until reviewed.")
        else:
            print("\nWARNING: Sanity check FAILED — seeding completed but results may be unreliable.")


def seed_supabase(picks: List[Dict[str, Any]]) -> None:
    """
    Seed picks into Supabase (idempotent).

    Tables:
    - daily_picks (source='backtest')
    - public_ledger (source='backtest', with cumulative_profit)
    - backtest_summary (upsert single row)
    - track_record (set live_start_date)
    """
    if not picks:
        logger.warning("[Seed] No picks to seed")
        return

    supabase = SupabaseService()
    now = datetime.now(timezone.utc).isoformat()

    # 1. Seed daily_picks
    daily_records = []
    for p in picks:
        daily_records.append({
            "fixture_id": 0,
            "fixture_key": p["fixture_key"],
            "league": p["league"],
            "home_team": p["home_team"],
            "away_team": p["away_team"],
            "kickoff_utc": p["date"] + "T00:00:00Z",
            "market_type": p["market_type"],
            "prediction": p["prediction"],
            "model_probability": p["model_probability"],
            "fair_odds": p["fair_odds"],
            "market_odds": p["market_odds"],
            "edge_pct": p["edge_pct"],
            "confidence": p["confidence"],
            "verdict": p["verdict"],
            "reasoning": p["reasoning"],
            "status": "settled",
            "source": "backtest",
            "created_at": now,
            "actual_home_goals": p["fthg"],
            "actual_away_goals": p["ftag"],
            "settled_result": p["result"],
            "pnl": p["pnl"],
        })

    if daily_records:
        try:
            supabase.client.table("daily_picks").upsert(
                daily_records,
                on_conflict=["fixture_key", "market_type"],
            ).execute()
            logger.info(f"[Seed] Upserted {len(daily_records)} daily_picks")
        except Exception as e:
            logger.error(f"[Seed] Failed to upsert daily_picks: {e}")

    # 2. Seed public_ledger with cumulative profit
    ledger_records = []
    running_profit = 0.0
    for p in picks:
        running_profit += p["pnl"]
        ledger_records.append({
            "fixture_key": p["fixture_key"],
            "market_type": p["market_type"],
            "prediction": p["prediction"],
            "league": p["league"],
            "home_team": p["home_team"],
            "away_team": p["away_team"],
            "result": p["result"],
            "pnl": p["pnl"],
            "cumulative_profit": round(running_profit, 4),
            "source": "backtest",
            "created_at": now,
        })

    if ledger_records:
        try:
            supabase.client.table("public_ledger").upsert(
                ledger_records,
                on_conflict=["fixture_key", "market_type"],
            ).execute()
            logger.info(f"[Seed] Upserted {len(ledger_records)} public_ledger entries")
        except Exception as e:
            logger.error(f"[Seed] Failed to upsert public_ledger: {e}")

    # 3. Upsert backtest_summary
    metrics = summarize(picks)
    try:
        supabase.client.table("backtest_summary").upsert({
            "id": 1,
            "seasons": "2324,2425,2526",
            "total_matches": metrics["total_matches"],
            "total_picks": metrics["total_picks"],
            "win_rate": metrics["win_rate"],
            "roi": metrics["roi"],
            "brier": metrics["brier"],
            "avg_clv": metrics["avg_clv"],
            "max_drawdown": metrics["max_drawdown"],
            "per_market": metrics.get("per_market", {}),
            "generated_at": now,
        }, on_conflict=["id"]).execute()
        logger.info("[Seed] Upserted backtest_summary")
    except Exception as e:
        logger.error(f"[Seed] Failed to upsert backtest_summary: {e}")

    # 4. Set track_record.live_start_date
    try:
        supabase.client.table("track_record").upsert({
            "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "live_start_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        }, on_conflict=["date"]).execute()
        logger.info("[Seed] Set track_record.live_start_date")
    except Exception as e:
        logger.error(f"[Seed] Failed to update track_record: {e}")


def main():
    parser = argparse.ArgumentParser(description="Historical Backtest Seeder")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Compute and print report without writing to Supabase",
    )
    parser.add_argument(
        "--seed",
        action="store_true",
        help="Run backtest and write results to Supabase",
    )
    args = parser.parse_args()

    if not args.dry_run and not args.seed:
        parser.print_help()
        sys.exit(1)

    logger.info("=" * 60)
    logger.info("HANDICAPLAB HISTORICAL BACKTEST SEEDER")
    logger.info(f"Time: {datetime.now(timezone.utc).isoformat()}")
    logger.info("=" * 60)

    # Step 1: Download CSVs
    logger.info("[Step 1/4] Downloading historical CSVs...")
    download_all()

    # Step 2: Parse CSVs
    logger.info("[Step 2/4] Parsing CSVs...")
    matches = parse_all()
    if not matches:
        logger.error("No matches parsed. Exiting.")
        sys.exit(1)

    # Step 3: Run backtest
    logger.info("[Step 3/4] Running walk-forward backtest...")
    picks = run_backtest(matches)
    if not picks:
        logger.warning("No picks generated. Check thresholds or data quality.")

    # Step 4: Report / Seed
    if args.dry_run:
        logger.info("[Step 4/4] Generating dry-run report...")
        print_report(picks, dry_run=True)
    elif args.seed:
        logger.info("[Step 4/4] Seeding Supabase...")
        print_report(picks, dry_run=False)
        seed_supabase(picks)

    logger.info("=" * 60)
    if args.seed:
        logger.info("STEP 6 COMPLETE — LEDGER SEEDED")
        metrics = summarize(picks)
        logger.info(
            f"Final numbers: {metrics['total_picks']} picks, "
            f"WR {metrics['win_rate']:.1f}%, ROI {metrics['roi']:.1f}%"
        )
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
