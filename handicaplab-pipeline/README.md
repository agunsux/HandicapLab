# HandicapLab Daily Pipeline — FREE TIER Edition

A zero-cost daily data pipeline for HandicapLab (handicaplab.dev), a football
market intelligence platform. Detects Asian Handicap, Over/Under, and Moneyline
value using a Dixon-Coles probability model.

## Architecture

```
                    ┌──────────────────┐
                    │   API-Football   │  (FREE: 100/day)
                    │  1 call /day     │
                    └────────┬─────────┘
                             │ fixtures + team stats
                             ▼
                    ┌──────────────────┐
                    │   Local Cache    │  ← THE cost-saver
                    │  (JSON files)    │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
     ┌────────────┐ ┌────────────┐ ┌────────────┐
     │ Dixon-Coles│ │ Edge       │ │ Pick       │
     │ Model      │ │ Detector   │ │ Generator  │
     └────────────┘ └────────────┘ └────────────┘
              │              │              │
              └──────────────┼──────────────┘
                             ▼
                    ┌──────────────────┐
                    │    Supabase      │
                    │  daily_picks     │
                    │  odds_snapshots  │
                    │  track_record    │
                    └──────────────────┘
                             ▲
                    ┌────────┴────────┐
                    │   OddsPapi      │  (FREE: 500/month)
                    │  2 snapshots/day│
                    └─────────────────┘
```

## Quota Budget (FREE Tier)

| Script              | API-Football | OddsPapi |
|---------------------|--------------|----------|
| daily_fetch (06:00) | ~6           | 6        |
| closing (18:00)     | 0            | 6        |
| settle (23:55)      | 1            | 0        |
| **TOTAL/day**       | **~7**       | **12**   |
| **Limit**           | **100/day**  | **500/mo**|
| **Monthly**         | ~210 (reset) | **360**  |
| **Utilization**     | 7%           | 72%      |

## Setup

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Configure environment
cp .env.example .env
# Edit .env with your API keys

# 3. Train the model (one-time, then weekly)
python scripts/weekly_training.py

# 4. Run daily pipeline (CRON at 06:00 WIB)
python scripts/daily_fetch.py

# 5. Closing snapshot (CRON at 18:00 WIB)
python scripts/closing_snapshot.py

# 6. Nightly settlement (CRON at 23:55 WIB)
python scripts/nightly_settle.py
```

## CRON Schedule (WIB = UTC+7)

| Time (WIB) | Script              | Purpose                  |
|------------|---------------------|--------------------------|
| 06:00      | daily_fetch.py      | Opening odds + picks     |
| 18:00      | closing_snapshot.py | Closing odds for CLV     |
| 23:55      | nightly_settle.py   | Settle picks             |
| Sunday     | weekly_training.py  | Retrain Dixon-Coles model|

## Project Structure

```
handicaplab-pipeline/
├── .env                    # API keys (not committed)
├── config.py               # All tunable parameters
├── quota_guard.py          # Daily + monthly quota tracking
├── requirements.txt        # Python dependencies
├── cache/
│   ├── local_cache.py      # File-based JSON cache
│   └── quota_usage.json    # Auto-generated quota state
├── fetchers/
│   ├── api_football.py     # API-Football (1 call/day for fixtures)
│   └── oddspapi.py         # OddsPapi (1 call/league/snapshot)
├── models/
│   └── dixon_coles.py      # Dixon-Coles probability engine
├── engine/
│   ├── edge_detector.py    # Edge detection vs market odds
│   └── pick_generator.py   # Pick filtering and generation
├── services/
│   └── supabase_client.py  # Supabase CRUD operations
├── scripts/
│   ├── daily_fetch.py      # Main daily pipeline
│   ├── closing_snapshot.py # Closing odds snapshot
│   ├── nightly_settle.py   # Pick settlement
│   └── weekly_training.py  # Model training
└── data/
    └── historical/         # One-time CSV downloads
```

## Upgrade Path (Paid Tiers)

When upgrading to paid tiers, only `config.py` changes:

- **API-Football Pro**: Raise `API_FOOTBALL_DAILY_LIMIT` to 300
- **OddsPapi Pro**: Raise `ODDSPAPI_MONTHLY_LIMIT`, add 3rd snapshot (midday)
- Pipeline logic stays identical — only limits and snapshot count change.

## Key Design Decisions

1. **1 call for all fixtures**: `/fixtures?date=` returns ALL leagues in one response
2. **1 call per league for odds**: `/sports/{key}/odds` returns ALL matches in that league
3. **Aggressive caching**: Fixtures (12h), team stats (48h), model (7 days)
4. **CSV training**: football-data.co.uk = 0 API calls for model training
5. **QuotaGuard**: Hard enforcement with daily (API-Football) + monthly (OddsPapi) counters
6. **Bahasa Indonesia reasoning**: All pick explanations in Indonesian
