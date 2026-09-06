"""
HandicapLab - ScoreRoom Archive Sync Orchestrator
=================================================
Main entry point for scraping historical and live match fixtures,
odds movements (AH, O/U, ML), and match stats from ScoreRoom and
upserting them into Supabase.

Usage:
  python scripts/run_archive_sync.py --url https://scoreroom.com/football/fixtures
  python scripts/run_archive_sync.py --league "Premier League" --date-from 2026-08-01
  python scripts/run_archive_sync.py --dry-run
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
import time
from pathlib import Path
from typing import List

# Ensure python_engine root is in python path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from scraper.data_parser import ScoreRoomDataParser, ScrapedMatchBundle
from scraper.skoreroom_client import SkoreroomScraperClient
from services.archive_ingestor import ArchiveIngestor

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("HandicapLab.ArchiveSync")


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="HandicapLab ScoreRoom Historical & Live Scraper Pipeline"
    )
    parser.add_argument(
        "--url",
        type=str,
        default="https://scoreroom.com/",
        help="Target ScoreRoom URL (archive, league, or fixture page)",
    )
    parser.add_argument(
        "--league",
        type=str,
        default=None,
        help="Filter specific league (e.g., 'Premier League', 'Serie A')",
    )
    parser.add_argument(
        "--date-from",
        type=str,
        default=None,
        help="Start date filter YYYY-MM-DD",
    )
    parser.add_argument(
        "--date-to",
        type=str,
        default=None,
        help="End date filter YYYY-MM-DD",
    )
    parser.add_argument(
        "--headless",
        action="store_true",
        default=True,
        help="Run browser in headless mode (default: True)",
    )
    parser.add_argument(
        "--no-headless",
        dest="headless",
        action="store_false",
        help="Run browser in visible mode for debugging",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=50,
        help="Supabase batch upsert chunk size (default: 50)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Perform scraping and parsing without writing to database",
    )
    return parser.parse_args()


def audit_research_invariants(bundles: List[ScrapedMatchBundle]) -> None:
    """
    Asserts HandicapLab Research Invariants:
    1. No Future Leakage: Opening odds must strictly precede kickoff.
    2. Bookmaker Priority: Logs presence of Pinnacle as canonical CLV benchmark.
    """
    leakage_count = 0
    pinnacle_odds_count = 0

    for b in bundles:
        kickoff = b.match.kickoff
        for odd in b.odds:
            if odd.odds_stage == "opening" and odd.recorded_at > kickoff:
                leakage_count += 1
                logger.warning(
                    "[INVARIANT WARNING] Potential future leakage detected: "
                    "Fixture '%s' has opening odds timestamp %s > kickoff %s",
                    b.match.fixture_id,
                    odd.recorded_at,
                    kickoff,
                )
            if odd.bookmaker.lower() == "pinnacle":
                pinnacle_odds_count += 1

    if leakage_count > 0:
        logger.warning(
            "[GOVERNANCE AUDIT] %d odds records flagged for potential temporal leakage!",
            leakage_count,
        )
    else:
        logger.info("[GOVERNANCE AUDIT] Invariant Check Passed: Zero future leakage detected.")

    logger.info(
        "[GOVERNANCE AUDIT] Ground Truth Hierarchy: %d Pinnacle odds captured across %d matches.",
        pinnacle_odds_count,
        len(bundles),
    )


async def run_pipeline(args: argparse.Namespace) -> None:
    start_time = time.time()
    logger.info("=" * 70)
    logger.info("HANDICAPLAB DATA INGESTION: ScoreRoom Archive Sync")
    logger.info("Target URL: %s | League: %s | Headless: %s", args.url, args.league, args.headless)
    logger.info("=" * 70)

    parser = ScoreRoomDataParser()
    ingestor = ArchiveIngestor(batch_size=args.batch_size) if not args.dry_run else None

    scraped_bundles: List[ScrapedMatchBundle] = []

    async with SkoreroomScraperClient(headless=args.headless) as client:
        logger.info("Fetching target page and listening for API responses...")
        payload = await client.fetch_page(url=args.url)

        # STRATEGY 1: Inspect and parse intercepted Network JSON responses
        if payload.intercepted_api_responses:
            logger.info(
                "Intercepted %d JSON API responses from Network traffic.",
                len(payload.intercepted_api_responses),
            )
            for item in payload.intercepted_api_responses:
                api_url = item["url"]
                json_data = item["data"]
                if isinstance(json_data, dict):
                    extracted = parser.parse_api_json(json_data)
                    if extracted:
                        logger.info(
                            "Extracted %d match bundles from intercepted endpoint: %s",
                            len(extracted),
                            api_url,
                        )
                        scraped_bundles.extend(extracted)

        # STRATEGY 2: Fallback to DOM parsing if no bundles were yielded from API
        if not scraped_bundles:
            logger.info("No match data extracted from API interception. Activating DOM fallback...")
            if payload.html_content:
                dom_bundles = parser.parse_dom(payload.html_content, url=args.url)
                logger.info("Extracted %d match bundles via DOM parser.", len(dom_bundles))
                scraped_bundles.extend(dom_bundles)

    # Filter by league or date if specified
    if args.league:
        scraped_bundles = [
            b for b in scraped_bundles if args.league.lower() in b.match.league.lower()
        ]
    if args.date_from:
        scraped_bundles = [
            b for b in scraped_bundles if b.match.kickoff.strftime("%Y-%m-%d") >= args.date_from
        ]
    if args.date_to:
        scraped_bundles = [
            b for b in scraped_bundles if b.match.kickoff.strftime("%Y-%m-%d") <= args.date_to
        ]

    logger.info("Total parsed bundles ready for sync: %d", len(scraped_bundles))

    if not scraped_bundles:
        logger.warning("No matches found matching criteria. Exiting sync.")
        return

    # Statistical governance check
    audit_research_invariants(scraped_bundles)

    # Ingestion into Supabase
    if args.dry_run:
        logger.info("[DRY RUN] Skipping database upsert. Sample extracted payload:")
        sample = scraped_bundles[0]
        logger.info("Match: %s vs %s (%s)", sample.match.home_team, sample.match.away_team, sample.match.kickoff)
        logger.info("Odds count: %d | Stats count: %d", len(sample.odds), len(sample.stats))
        matches_synced, odds_synced, stats_synced = len(scraped_bundles), sum(len(b.odds) for b in scraped_bundles), sum(len(b.stats) for b in scraped_bundles)
    else:
        assert ingestor is not None
        matches_synced, odds_synced, stats_synced = await ingestor.ingest_bundles(scraped_bundles)

    elapsed = time.time() - start_time
    logger.info("=" * 70)
    logger.info("SYNC EXECUTION SUMMARY")
    logger.info("Matches Processed:    %d", matches_synced)
    logger.info("Odds Snapshots:       %d", odds_synced)
    logger.info("Team Stats Ingested:  %d", stats_synced)
    logger.info("Total Elapsed Time:   %.2f seconds", elapsed)
    logger.info("=" * 70)


def main():
    args = parse_arguments()
    try:
        asyncio.run(run_pipeline(args))
    except KeyboardInterrupt:
        logger.info("Pipeline stopped by user.")
    except Exception as e:
        logger.exception("Pipeline failed with unhandled exception: %s", e)
        sys.exit(1)


if __name__ == "__main__":
    main()
