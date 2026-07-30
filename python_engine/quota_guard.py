import os
import json
from datetime import datetime
from config import API_FOOTBALL_DAILY_LIMIT, ODDSPAPI_MONTHLY_LIMIT

CACHE_DIR = os.path.join(os.path.dirname(__file__), 'cache')
QUOTA_FILE = os.path.join(CACHE_DIR, 'quota_usage.json')

class QuotaExceededError(Exception):
    pass

def _load_quota():
    if not os.path.exists(QUOTA_FILE):
        return {
            "api_football": {"date": "", "count": 0},
            "oddspapi": {"month": "", "count": 0}
        }
    try:
        with open(QUOTA_FILE, 'r') as f:
            return json.load(f)
    except Exception:
        return {
            "api_football": {"date": "", "count": 0},
            "oddspapi": {"month": "", "count": 0}
        }

def _save_quota(data):
    os.makedirs(CACHE_DIR, exist_ok=True)
    with open(QUOTA_FILE, 'w') as f:
        json.dump(data, f)

def check(service: str):
    data = _load_quota()
    today = datetime.utcnow().strftime("%Y-%m-%d")
    current_month = datetime.utcnow().strftime("%Y-%m")

    if service == "api_football":
        if data["api_football"]["date"] != today:
            data["api_football"] = {"date": today, "count": 0}
            _save_quota(data)
        if data["api_football"]["count"] >= API_FOOTBALL_DAILY_LIMIT:
            raise QuotaExceededError(f"API-Football daily limit ({API_FOOTBALL_DAILY_LIMIT}) exceeded.")

    elif service == "oddspapi":
        if data["oddspapi"]["month"] != current_month:
            data["oddspapi"] = {"month": current_month, "count": 0}
            _save_quota(data)
        if data["oddspapi"]["count"] >= ODDSPAPI_MONTHLY_LIMIT:
            raise QuotaExceededError(f"OddsPAPI monthly limit ({ODDSPAPI_MONTHLY_LIMIT}) exceeded.")
    else:
        raise ValueError(f"Unknown service: {service}")

def increment(service: str):
    data = _load_quota()
    today = datetime.utcnow().strftime("%Y-%m-%d")
    current_month = datetime.utcnow().strftime("%Y-%m")

    if service == "api_football":
        if data["api_football"]["date"] != today:
            data["api_football"] = {"date": today, "count": 0}
        data["api_football"]["count"] += 1

    elif service == "oddspapi":
        if data["oddspapi"]["month"] != current_month:
            data["oddspapi"] = {"month": current_month, "count": 0}
        data["oddspapi"]["count"] += 1
        
        # Warn if > 80% usage
        if data["oddspapi"]["count"] == int(ODDSPAPI_MONTHLY_LIMIT * 0.8):
            _warn_at_80()

    _save_quota(data)

def log_budget():
    data = _load_quota()
    af_rem = max(0, API_FOOTBALL_DAILY_LIMIT - data["api_football"].get("count", 0))
    odds_rem = max(0, ODDSPAPI_MONTHLY_LIMIT - data["oddspapi"].get("count", 0))
    print(f"[QUOTA BUDGET] API-Football remaining today: {af_rem}/{API_FOOTBALL_DAILY_LIMIT}")
    print(f"[QUOTA BUDGET] OddsPAPI remaining this month: {odds_rem}/{ODDSPAPI_MONTHLY_LIMIT}")

def _warn_at_80():
    print("WARNING: OddsPAPI usage reached 80% of monthly limit! Consider reducing snapshots.")
    # Here, a Telegram alert would be sent.
