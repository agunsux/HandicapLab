import os

# HARD CONSTRAINTS (FREE API TIERS)
API_FOOTBALL_DAILY_LIMIT = 50      # real limit 100/day, keep 50% buffer
ODDSPAPI_MONTHLY_LIMIT = 400       # real limit 500/MONTH, keep 20% buffer

LEAGUES = {
    39:  {"name": "EPL", "odds_key": "soccer_epl"},
    140: {"name": "La Liga", "odds_key": "soccer_spain_la_liga"},
    78:  {"name": "Bundesliga", "odds_key": "soccer_germany_bundesliga"},
    135: {"name": "Serie A", "odds_key": "soccer_italy_serie_a"},
    61:  {"name": "Ligue 1", "odds_key": "soccer_france_ligue_one"},
    71:  {"name": "Brasileirão", "odds_key": "soccer_brazil_campeonato"},
}

BOOKMAKERS = ["pinnacle", "sbo"]     # fallback ["pinnacle","bet365"] if sbo missing
REGIONS = "uk,eu"
MARKETS = "h2h,spreads,totals"
SNAPSHOT_LABELS = ["opening", "closing"]   # only 2 snapshots/day (quota!)

MIN_EDGE_PCT = 3.0
MIN_CONFIDENCE = 70

CACHE_TTL_FIXTURES = 43200     # 12h
CACHE_TTL_TEAM_STATS = 172800  # 48h
CACHE_TTL_MODEL = 604800       # 7d (retrain weekly only)
CACHE_TTL_ODDS = 21600         # 6h
