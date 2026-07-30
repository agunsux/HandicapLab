"""
data/historical/downloader.py — Download & cache free CSVs from football-data.co.uk.
ZERO API-Football / OddsPapi calls. All data from free CSVs only.
"""
import os
import time
import urllib.request
import urllib.error
from typing import List, Tuple

BASE_URL = "https://www.football-data.co.uk/mmz4281/{season}/{code}.csv"

SEASONS = ["2324", "2425", "2526"]

LEAGUE_CODES = {
    "EPL": "E0",
    "La Liga": "SP1",
    "Bundesliga": "D1",
    "Serie A": "I1",
    "Ligue 1": "F1",
    "Brasileirao": "B1",
}

# Resolve cache directory relative to python_engine root
_ENGINE_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CACHE_DIR = os.path.join(_ENGINE_ROOT, "data", "historical", "csv")


def _ensure_cache_dir():
    os.makedirs(CACHE_DIR, exist_ok=True)


def download_all(delay: float = 1.0) -> Tuple[List[str], List[dict]]:
    """
    Download all 18 CSVs. Cache — never re-download if file exists.
    
    Returns:
        (downloaded_paths, skipped_list)
        skipped_list = [{'league': ..., 'season': ..., 'url': ..., 'reason': ...}, ...]
    """
    _ensure_cache_dir()
    downloaded = []
    skipped = []
    total = len(SEASONS) * len(LEAGUE_CODES)

    for league_name, code in LEAGUE_CODES.items():
        for season in SEASONS:
            url = BASE_URL.format(season=season, code=code)
            filename = f"{code}_{season}.csv"
            filepath = os.path.join(CACHE_DIR, filename)

            # Already cached
            if os.path.exists(filepath) and os.path.getsize(filepath) > 100:
                print(f"  [CACHED] {filename}")
                downloaded.append(filepath)
                continue

            # Attempt download
            success = False
            for attempt in range(2):  # 1 retry for transient errors
                try:
                    print(f"  [GET] {url} -> {filename} (attempt {attempt + 1})")
                    req = urllib.request.Request(url, headers={
                        'User-Agent': 'HandicapLab-Backtest/1.0'
                    })
                    with urllib.request.urlopen(req, timeout=30) as response:
                        data = response.read()
                        if len(data) < 100:
                            raise ValueError("Response too small, likely empty")
                        with open(filepath, 'wb') as f:
                            f.write(data)
                    downloaded.append(filepath)
                    success = True
                    break
                except urllib.error.HTTPError as e:
                    if e.code == 404:
                        # Permanent — skip
                        print(f"  [404] {filename} — not available, skipping")
                        skipped.append({
                            'league': league_name,
                            'season': season,
                            'url': url,
                            'reason': f'HTTP 404',
                        })
                        success = True  # don't retry 404
                        break
                    elif attempt == 0:
                        print(f"  [RETRY] HTTP {e.code} for {filename}, waiting 2s...")
                        time.sleep(2)
                    else:
                        skipped.append({
                            'league': league_name,
                            'season': season,
                            'url': url,
                            'reason': f'HTTP {e.code} after retry',
                        })
                except Exception as e:
                    if attempt == 0:
                        print(f"  [RETRY] {type(e).__name__}: {e}, waiting 2s...")
                        time.sleep(2)
                    else:
                        skipped.append({
                            'league': league_name,
                            'season': season,
                            'url': url,
                            'reason': str(e),
                        })

            if not success:
                continue

            # Polite delay between requests
            time.sleep(delay)

    print(f"\n  Coverage: {len(downloaded)}/{total} files downloaded, {len(skipped)} skipped.")
    if skipped:
        for s in skipped:
            print(f"    SKIPPED: {s['league']} {s['season']} — {s['reason']}")

    return downloaded, skipped


if __name__ == "__main__":
    paths, missed = download_all()
    print(f"\nDownloaded {len(paths)} files.")
