"""
HandicapLab Pipeline Configuration — FREE TIER Edition
======================================================
All tunable knobs in one place. Change limits here when upgrading to paid tiers.
"""

import os
from dotenv import load_dotenv

load_dotenv()

# ─── QUOTA (FREE TIERS — SAFETY CAPS) ────────────────────────────────────────
# API-Football FREE: 100/day hard limit. We cap at 50 for safety buffer.
API_FOOTBALL_DAILY_LIMIT = 50

# OddsPapi FREE: 500/month hard limit. We cap at 400 for safety buffer.
ODDSPAPI_MONTHLY_LIMIT = 400

# ─── LEAGUE WHITELIST ────────────────────────────────────────────────────────
# Only these 6 leagues. No expansion until ROI stabilises.
LEAGUES = {
    39:  {"name": "EPL",         "odds_key": "soccer_epl"},
    140: {"name": "La Liga",     "odds_key": "soccer_spain_la_liga"},
    78:  {"name": "Bundesliga",  "odds_key": "soccer_germany_bundesliga"},
    135: {"name": "Serie A",     "odds_key": "soccer_italy_serie_a"},
    61:  {"name": "Ligue 1",     "odds_key": "soccer_france_ligue_one"},
    71:  {"name": "Brasileirão", "odds_key": "soccer_brazil_campeonato"},
}

# ─── BOOKMAKER WHITELIST ─────────────────────────────────────────────────────
# Pinnacle = ground truth for CLV. SBOBET = secondary comparator.
# If SBO is unavailable on free tier, the fetcher falls back to bet365.
BOOKMAKERS = ["pinnacle", "sbo"]
BOOKMAKER_FALLBACK = ["pinnacle", "bet365"]
REGIONS = "uk,eu"
MARKETS = "h2h,spreads,totals"

# ─── EDGE THRESHOLDS ─────────────────────────────────────────────────────────
MIN_EDGE_PCT = 3.0          # Minimum edge % to generate a pick
MIN_CONFIDENCE = 70          # Minimum confidence score (0-100)

# ─── CACHE TTL (seconds) ─────────────────────────────────────────────────────
# Aggressive caching is the #1 cost-saver on free tiers.
CACHE_TTL_FIXTURES = 43200      # 12h — fixtures rarely change intra-day
CACHE_TTL_TEAM_STATS = 172800   # 48h — stats update slowly
CACHE_TTL_MODEL = 604800        # 7 days — retrain weekly only
CACHE_TTL_ODDS = 21600          # 6h — we only snapshot 2x/day anyway

# ─── DIXON-COLES MODEL ───────────────────────────────────────────────────────
DC_RHO = -0.10          # Dixon-Coles low-score correction
DC_XI = 0.0018          # Time-decay factor
DC_HOME_ADV = 0.25      # Initial home advantage guess (refined by MLE)

# ─── API KEYS (from .env) ────────────────────────────────────────────────────
API_FOOTBALL_KEY = os.getenv("APIFOOTBALL_KEY", os.getenv("API_FOOTBALL_KEY", ""))
ODDSPAPI_KEY = os.getenv("ODDS_PAPI_KEY", os.getenv("ODDSPAPI_KEY", ""))
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

# ─── API BASE URLS ───────────────────────────────────────────────────────────
API_FOOTBALL_BASE = "https://v3.football.api-sports.io"
ODDSPAPI_BASE = "https://api.oddspapi.io/v4"

# ─── CACHE DIRECTORY ─────────────────────────────────────────────────────────
CACHE_DIR = os.path.join(os.path.dirname(__file__), "cache")
