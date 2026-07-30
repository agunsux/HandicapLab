"""
Historical CSV Downloader
=========================
Downloads free match data CSVs from football-data.co.uk.

Caching: never re-downloads if file already exists on disk.
Rate limit: 1s between requests to be polite to the source.
"""

import logging
import os
import time
from pathlib import Path

import httpx

logger = logging.getLogger(__name__)

BASE_URL = "https://www.football-data.co.uk/mmz4281"
SEASONS = ["2324", "2425", "2526"]
CODES = {
    "EPL": "E0",
    "La Liga": "SP1",
    "Bundesliga": "D1",
    "Serie A": "I1",
    "Ligue 1": "F1",
    "Brasileirão": "B1",
}


def download_all(cache_dir: str = None) -> list:
    """
    Download all 18 CSVs (6 leagues × 3 seasons).

    Args:
        cache_dir: Directory to cache CSVs. Defaults to data/historical/csv/

    Returns:
        List of downloaded file paths
    """
    if cache_dir is None:
        cache_dir = os.path.join(
            os.path.dirname(__file__), "..", "historical", "csv"
        )

    cache_path = Path(cache_dir).resolve()
    cache_path.mkdir(parents=True, exist_ok=True)

    downloaded = []

    for season in SEASONS:
        for league_name, code in CODES.items():
            url = f"{BASE_URL}/{season}/{code}.csv"
            file_path = cache_path / f"{league_name}_{season}.csv"

            if file_path.exists():
                logger.info(f"[Downloader] Cache hit: {file_path.name}")
                downloaded.append(str(file_path))
                continue

            try:
                logger.info(f"[Downloader] Fetching {url}")
                response = httpx.get(url, follow_redirects=True, timeout=30)
                response.raise_for_status()

                file_path.write_bytes(response.content)
                downloaded.append(str(file_path))
                logger.info(f"[Downloader] Saved {file_path.name}")

                time.sleep(1.0)

            except Exception as e:
                logger.error(f"[Downloader] Failed {url}: {e}")

    logger.info(f"[Downloader] Downloaded {len(downloaded)}/{len(SEASONS) * len(CODES)} files")
    return downloaded
