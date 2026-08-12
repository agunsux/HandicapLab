import os
import httpx
from datetime import datetime, timedelta
from dotenv import load_dotenv
import quota_guard
from cache import local_cache
from config import LEAGUES, CACHE_TTL_FIXTURES, CACHE_TTL_TEAM_STATS

load_dotenv()
API_KEY = os.getenv("APIFOOTBALL_KEY", os.getenv("API_FOOTBALL_KEY"))
BASE_URL = "https://v3.football.api-sports.io"

headers = {
    "x-apisports-key": API_KEY,
    "x-apisports-host": "v3.football.api-sports.io"
}

def _make_request(endpoint: str, params: dict):
    if not API_KEY or API_KEY == "mock":
        return {"response": []} # Mock response for dry runs
        
    url = f"{BASE_URL}{endpoint}"
    try:
        quota_guard.check("api_football")
        
        response = httpx.get(url, headers=headers, params=params, timeout=10.0)
        
        if response.status_code == 429:
            print("429 Too Many Requests - skipping (should wait 60s)")
            return None
        elif response.status_code in [401, 403]:
            print("401/403 HALT")
            raise Exception("API-Football Unauthorized - HALTING")
            
        response.raise_for_status()
        quota_guard.increment("api_football")
        return response.json()
        
    except quota_guard.QuotaExceededError as e:
        print(f"QUOTA EXCEEDED: {e} - HALTING GRACEFULLY")
        return None
    except Exception as e:
        print(f"API Error: {e}")
        return None

def get_todays_fixtures():
    today = datetime.utcnow().strftime("%Y-%m-%d")
    cache_key = f"fixtures_{today}"
    
    cached = local_cache.get(cache_key, CACHE_TTL_FIXTURES)
    if cached:
        return cached

    data = _make_request("/fixtures", {"date": today})
    if not data or "response" not in data:
        return []
        
    # Filter to whitelist
    whitelist_ids = set(LEAGUES.keys())
    filtered = [f for f in data["response"] if f["league"]["id"] in whitelist_ids]
    
    local_cache.set(cache_key, filtered)
    return filtered

def get_team_stats(team_id: int, league_id: int, season: int = 2023):
    cache_key = f"team_{team_id}_{league_id}_{season}"
    
    cached = local_cache.get(cache_key, CACHE_TTL_TEAM_STATS)
    if cached:
        return cached
        
    data = _make_request("/teams/statistics", {"team": team_id, "league": league_id, "season": season})
    if not data or "response" not in data:
        return None
        
    stats = data["response"]
    local_cache.set(cache_key, stats)
    return stats

def get_yesterday_results():
    yesterday = (datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d")
    
    data = _make_request("/fixtures", {"date": yesterday})
    if not data or "response" not in data:
        return []
        
    whitelist_ids = set(LEAGUES.keys())
    filtered = [f for f in data["response"] if f["league"]["id"] in whitelist_ids and f["fixture"]["status"]["short"] in ["FT", "AET", "PEN"]]
    return filtered
