#!/usr/bin/env python3
"""
Weekly Model Training Script
=============================
Trains the Dixon-Coles model using historical data.
Runs ONCE per week (Sunday), not daily.

Strategy:
- Prefer CSV data from football-data.co.uk (0 API calls)
- Fallback to API-Football historical endpoints if CSVs unavailable
- Caches model params for 7 days

COST: 0 API calls (if using CSVs) or ~12 calls (if using API)
"""

import logging
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import API_FOOTBALL_DAILY_LIMIT, CACHE_DIR, LEAGUES
from cache.local_cache import LocalCache
from quota_guard import QuotaGuard
from fetchers.api_football import APIFootballFetcher
from models.dixon_coles import DixonColesModel

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("weekly_training")

# Mapping from league IDs to football-data.co.uk CSV URLs
# These are FREE and require 0 API calls
FOOTBALL_DATA_CSV = {
    39:  "https://www.football-data.co.uk/mmz4281/2425/E0.csv",   # EPL
    140: "https://www.football-data.co.uk/mmz4281/2425/SP1.csv",  # La Liga
    78:  "https://www.football-data.co.uk/mmz4281/2425/D1.csv",   # Bundesliga
    135: "https://www.football-data.co.uk/mmz4281/2425/I1.csv",   # Serie A
    61:  "https://www.football-data.co.uk/mmz4281/2425/F1.csv",   # Ligue 1
    71:  "https://www.football-data.co.uk/mmz4281/2425/B1.csv",   # Brasileirão
}


def load_csv_data() -> list:
    """
    Try to load historical data from football-data.co.uk CSVs.
    Returns list of match dicts or empty list if CSVs unavailable.
    """
    import pandas as pd

    matches = []
    for league_id, csv_url in FOOTBALL_DATA_CSV.items():
        try:
            logger.info(f"Downloading CSV for league {league_id} from {csv_url}")
            df = pd.read_csv(csv_url)

            # Map CSV columns to our format
            for _, row in df.iterrows():
                if pd.isna(row.get("FTHG")) or pd.isna(row.get("FTAG")):
                    continue

                matches.append({
                    "home_team": row.get("HomeTeam", ""),
                    "away_team": row.get("AwayTeam", ""),
                    "home_goals": int(row["FTHG"]),
                    "away_goals": int(row["FTAG"]),
                    "timestamp": 0,  # No timestamp in CSVs
                    "league_id": league_id,
                })

            logger.info(f"Loaded {len(df)} matches for league {league_id}")

        except Exception as e:
            logger.warning(f"Failed to load CSV for league {league_id}: {e}")
            continue

    return matches


def load_api_data(api_football: APIFootballFetcher) -> list:
    """
    Fallback: load historical data from API-Football.
    Cost: 1 call per league per season.
    """
    matches = []
    season = api_football._current_season()

    for league_id in LEAGUES:
        try:
            league_matches = api_football.get_historical_season(league_id, season)
            # Filter to completed matches only
            for m in league_matches:
                if m["status"] in ("FT", "AET", "PEN") and m["home_goals"] is not None:
                    matches.append(m)
            logger.info(f"Loaded {len(league_matches)} matches for league {league_id} from API")
        except Exception as e:
            logger.warning(f"Failed to fetch historical data for league {league_id}: {e}")
            continue

    return matches


def main():
    logger.info("=" * 60)
    logger.info("HANDICAPLAB WEEKLY TRAINING — STARTING")
    logger.info("=" * 60)

    cache = LocalCache(CACHE_DIR)
    quota_guard = QuotaGuard(CACHE_DIR)

    # Try CSV route first (0 API calls)
    matches = load_csv_data()

    # Fallback to API if CSV failed
    if not matches:
        logger.info("CSV data unavailable, falling back to API-Football")
        api_football = APIFootballFetcher(cache, quota_guard)
        matches = load_api_data(api_football)
        api_football.close()

    if not matches:
        logger.error("No training data available from any source. Cannot train model.")
        sys.exit(1)

    logger.info(f"Total training matches: {len(matches)}")

    # Train model
    model = DixonColesModel(cache)
    params = model.train(matches)

    # Log results
    logger.info("=" * 60)
    logger.info("TRAINING COMPLETE")
    logger.info(f"Teams: {len(params['teams'])}")
    logger.info(f"Home advantage: {params['home_advantage']:.4f}")
    logger.info(f"Log-likelihood: {params['log_likelihood']:.2f}")
    logger.info(f"Matches used: {params['n_matches']}")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
