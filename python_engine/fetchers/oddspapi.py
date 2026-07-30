import os
import httpx
import difflib
from dotenv import load_dotenv
import quota_guard
from cache import local_cache
from config import LEAGUES, CACHE_TTL_ODDS

load_dotenv()
API_KEY = os.getenv("ODDSPAPI_KEY")
BASE_URL = "https://api.the-odds-api.com/v4/sports"

def _make_request(endpoint: str, params: dict):
    if not API_KEY or API_KEY == "mock":
        return []
        
    url = f"{BASE_URL}{endpoint}"
    params["apiKey"] = API_KEY
    
    try:
        quota_guard.check("oddspapi")
        
        response = httpx.get(url, params=params, timeout=10.0)
        
        if response.status_code == 429:
            print("429 Too Many Requests - skipping")
            return None
        elif response.status_code in [401, 403]:
            print("401/403 HALT")
            raise Exception("OddsPapi Unauthorized - HALTING")
            
        response.raise_for_status()
        quota_guard.increment("oddspapi")
        return response.json()
        
    except quota_guard.QuotaExceededError as e:
        print(f"QUOTA EXCEEDED: {e} - HALTING GRACEFULLY")
        return None
    except Exception as e:
        print(f"Odds API Error: {e}")
        return None

def get_league_odds(odds_key: str):
    cache_key = f"odds_{odds_key}"
    cached = local_cache.get(cache_key, CACHE_TTL_ODDS)
    if cached:
        return cached

    params = {
        "regions": "uk,eu",
        "markets": "h2h,spreads,totals",
        "oddsFormat": "decimal"
    }
    
    data = _make_request(f"/{odds_key}/odds", params)
    if data:
        local_cache.set(cache_key, data)
    return data or []

def get_all_odds(snapshot_label: str):
    # In a real scenario we'd skip leagues with 0 matches today.
    # We loop over LEAGUES and fetch odds, then fuzzy match.
    results = {}
    for lg_id, lg_info in LEAGUES.items():
        odds_key = lg_info["odds_key"]
        odds_data = get_league_odds(odds_key)
        
        # Here we would normally match via difflib against api_football fixtures
        # (Mock implementation of matching logic)
        results[odds_key] = odds_data
        
    return results

def fuzzy_match(team1: str, team2: str, threshold=0.85):
    seq = difflib.SequenceMatcher(None, team1.lower(), team2.lower())
    return seq.ratio() >= threshold
