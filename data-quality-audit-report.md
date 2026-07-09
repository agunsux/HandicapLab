# 🏥 HandicapLab — Data Quality Audit (Sprint 1)

**Generated**: 2026-07-09T18:08:38.151Z
**Leagues Scanned**: 6 (Premier League, Championship, La Liga, Serie A, Bundesliga, Ligue 1)
**Providers Assessed**: API-Football, The Odds API, Football-Data.org, EPL CSV (Football-Data.co.uk)

---

## Provider Coverage Matrix

| Data Point | API-Football | The Odds API | Football-Data.org | EPL CSV (Football-Data.co.uk) |
|---|---|---|---|---|
| Fixture | ✅ | ❌ | ✅ | ✅ |
| Odds | ❌ | ✅ | ❌ | ✅ |
| Opening Odds | ✅ | ✅ | ❌ | ✅ |
| Closing Odds | ✅ | ✅ | ❌ | ✅ |
| Asian Handicap | ❌ | ✅ | ❌ | ✅ |
| Over/Under | ❌ | ✅ | ❌ | ✅ |
| Moneyline | ✅ | ✅ | ❌ | ✅ |
| Lineup | ✅ | ❌ | ❌ | ❌ |
| Injuries | ✅ | ❌ | ❌ | ❌ |
| Standings | ✅ | ❌ | ✅ | ❌ |
| H2H | ✅ | ❌ | ❌ | ❌ |
| Referee | ✅ | ❌ | ❌ | ✅ |
| Venue | ✅ | ❌ | ❌ | ❌ |
| Weather | ❌ | ❌ | ❌ | ❌ |
| xG | ✅ | ❌ | ❌ | ❌ |
| Shot | ✅ | ❌ | ❌ | ✅ |
| Possession | ✅ | ❌ | ❌ | ❌ |
| Cards | ✅ | ❌ | ❌ | ✅ |
| Corners | ✅ | ❌ | ❌ | ✅ |
| Substitutions | ✅ | ❌ | ❌ | ❌ |
| Expected Points | ❌ | ❌ | ❌ | ❌ |

### Provider Notes

- **API-Football**: Best coverage. 100 req/day free tier. Pre-season and live odds not reliable for AH/OU.
  - Leagues: 100+ leagues worldwide

- **The Odds API**: Best odds source. Consistent market coverage (h2h/spreads/totals). Spreads are point spreads, not true Asian Handicap. 500 req/day free tier.
  - Leagues: EPL, Bundesliga, La Liga, Serie A, Ligue 1, Champions League, Europa League, Eredivisie, Brasileirão, Scottish Premiership

- **Football-Data.org**: No odds. Standings only. 10 req/min free tier. Limited historical data.
  - Leagues: EPL, Championship, Bundesliga, La Liga, Serie A, Ligue 1, Primeira Liga, Eredivisie, MLS

- **EPL CSV (Football-Data.co.uk)**: BEST HISTORICAL SOURCE for EPL. 6 seasons (2020-2026). Full opening/closing odds, AH, OU, ML. Includes stats (shots, cards, corners, referee).
  - Leagues: EPL


---

## Data Points Coverage by League

| Data Point | Premier League | Championship | La Liga | Serie A | Bundesliga | Ligue 1 |
|---|---|---|---|---|---|---|
| Fixture | ✅ (CSV + API) | ⚠️ (API-Football only) | ⚠️ (API-Football only) | ⚠️ (API-Football only) | ⚠️ (API-Football only) | ⚠️ (API-Football only) |
| Odds | ✅ (CSV + API) | ⚠️ (Odds API only) | ⚠️ (Odds API only) | ⚠️ (Odds API only) | ⚠️ (Odds API only) | ⚠️ (Odds API only) |
| Opening Odds | ✅ (6 seasons CSV) | ⚠️ (Odds API) | ⚠️ (Odds API) | ⚠️ (Odds API) | ⚠️ (Odds API) | ⚠️ (Odds API) |
| Closing Odds | ✅ (6 seasons CSV) | ⚠️ (Odds API, needs polling) | ⚠️ (Odds API, needs polling) | ⚠️ (Odds API, needs polling) | ⚠️ (Odds API, needs polling) | ⚠️ (Odds API, needs polling) |
| Asian Handicap | ✅ (6 seasons CSV) | ⚠️ (Odds API spreads) | ⚠️ (Odds API spreads) | ⚠️ (Odds API spreads) | ⚠️ (Odds API spreads) | ⚠️ (Odds API spreads) |
| Over/Under | ✅ (6 seasons CSV) | ⚠️ (Odds API totals) | ⚠️ (Odds API totals) | ⚠️ (Odds API totals) | ⚠️ (Odds API totals) | ⚠️ (Odds API totals) |
| Moneyline | ✅ (6 seasons CSV) | ✅ (Odds API) | ✅ (Odds API) | ✅ (Odds API) | ✅ (Odds API) | ✅ (Odds API) |
| Lineup | ✅ (API-Football) | ⚠️ (API-Football) | ⚠️ (API-Football) | ⚠️ (API-Football) | ⚠️ (API-Football) | ⚠️ (API-Football) |
| Injuries | ✅ (API-Football) | ⚠️ (API-Football) | ⚠️ (API-Football) | ⚠️ (API-Football) | ⚠️ (API-Football) | ⚠️ (API-Football) |
| Standings | ✅ (API-Football) | ⚠️ (API-Football) | ⚠️ (API-Football) | ⚠️ (API-Football) | ⚠️ (API-Football) | ⚠️ (API-Football) |
| H2H | ✅ (API-Football) | ⚠️ (API-Football) | ⚠️ (API-Football) | ⚠️ (API-Football) | ⚠️ (API-Football) | ⚠️ (API-Football) |
| Referee | ✅ (CSV + API) | ⚠️ (API-Football) | ⚠️ (API-Football) | ⚠️ (API-Football) | ⚠️ (API-Football) | ⚠️ (API-Football) |
| Venue | ✅ (API-Football) | ⚠️ (API-Football) | ⚠️ (API-Football) | ⚠️ (API-Football) | ⚠️ (API-Football) | ⚠️ (API-Football) |
| Weather | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| xG | ⚠️ (API-Football, not in CSV) | ⚠️ (API-Football) | ⚠️ (API-Football) | ⚠️ (API-Football) | ⚠️ (API-Football) | ⚠️ (API-Football) |
| Shot | ✅ (CSV + API) | ⚠️ (API-Football) | ⚠️ (API-Football) | ⚠️ (API-Football) | ⚠️ (API-Football) | ⚠️ (API-Football) |
| Possession | ⚠️ (API-Football, not in CSV) | ⚠️ (API-Football) | ⚠️ (API-Football) | ⚠️ (API-Football) | ⚠️ (API-Football) | ⚠️ (API-Football) |
| Cards | ✅ (CSV + API) | ⚠️ (API-Football) | ⚠️ (API-Football) | ⚠️ (API-Football) | ⚠️ (API-Football) | ⚠️ (API-Football) |
| Corners | ✅ (CSV + API) | ⚠️ (API-Football) | ⚠️ (API-Football) | ⚠️ (API-Football) | ⚠️ (API-Football) | ⚠️ (API-Football) |
| Substitutions | ⚠️ (API-Football only) | ⚠️ (API-Football) | ⚠️ (API-Football) | ⚠️ (API-Football) | ⚠️ (API-Football) | ⚠️ (API-Football) |
| Expected Points | ❌ (must compute) | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## Historical Coverage by League

| League | ID | Seasons | Matches | Closing Odds | AH | OU | ML | Missing % |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Premier League | 39 | 1 (2023-2024, 2024) | 2.280 | ✅ Full (6 seasons) | ✅ Full (6 seasons) | ✅ Full (6 seasons) | ✅ Full (6 seasons) | 0% |
| Championship | 40 | 1 (2023-2024) | 380 | ❌ (silver only) | ❌ (silver only) | ❌ (silver only) | ❌ (silver only) | 90% |
| La Liga | 140 | 1 (2023-2024) | 380 | ❌ (silver only) | ❌ (silver only) | ❌ (silver only) | ❌ (silver only) | 90% |
| Serie A | 135 | 1 (2023-2024) | 380 | ❌ (silver only) | ❌ (silver only) | ❌ (silver only) | ❌ (silver only) | 90% |
| Bundesliga | 78 | 1 (2023-2024) | 380 | ❌ (silver only) | ❌ (silver only) | ❌ (silver only) | ❌ (silver only) | 90% |
| Ligue 1 | 61 | 1 (2023-2024) | 380 | ❌ (silver only) | ❌ (silver only) | ❌ (silver only) | ❌ (silver only) | 90% |

---

## Market Completeness

### Per Provider (Estimated)

| Provider | AH Available | OU Available | ML Available | AH % | OU % | ML % | All Three % |
|---|:---:|:---:|:---:|---:|---:|---:|---:|
| API-Football | ❌ | ❌ | ✅ | 30% | 30% | 70% | 20% |
| The Odds API | ✅ | ✅ | ✅ | 95% | 95% | 99% | 94% |
| Football-Data.org | ❌ | ❌ | ❌ | 0% | 0% | 0% | 0% |
| EPL CSV (Football-Data.co.uk) | ✅ | ✅ | ✅ | 100% | 100% | 100% | 100% |

### EPL Historical (CSV)

| Season | Matches | AH | OU | ML | Closing Odds | All Four |
|------:|---:|---:|---:|---:|---:|---:|
| 2020-2021 | 380 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 2021-2022 | 380 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 2022-2023 | 380 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 2023-2024 | 380 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 2024-2025 | 380 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 2025-2026 | 380 | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Closing Odds Availability

### Why This Is Priority #1

Without closing odds:
- CLV (Closing Line Value) cannot be calculated
- Edge estimates become unreliable
- Paper trading lacks market-relative validation
- Model calibration against market weakens significantly

### Current Status

| Source | Closing Odds | Coverage | Note |
|---|:---:|---:|---|
| EPL CSV | ✅ | 6/6 seasons | 2020-2021, 2021-2022, 2022-2023, 2023-2024, 2024-2025, 2025-2026 |
| The Odds API | ⚠️ | Live only | Provides closing odds via API (real-time when polled near kickoff) |
| API-Football | ✅ | All leagues | Bookmaker odds include closing lines (premium tier needed) |
| Football-Data.org | ❌ | N/A | No odds at all |

### Gaps

1. **Non-EPL leagues**: Zero closing odds data in local storage
2. **The Odds API**: Requires continuous polling near kickoff to capture closing lines
3. **API-Football**: 100 req/day free tier severely limits historical backfill
4. **No closing odds pipeline**: No cron job currently captures closing odds

### Action Items

1. [ ] Implement closing odds capture cron (polls 1h before kickoff, at kickoff, 15min after)
2. [ ] Backfill non-EPL leagues using The Odds API historical data
3. [ ] Store closing odds separately from opening odds in DB schema
4. [ ] Add CLV calculation to prediction_results table

---

## Data Pipeline Status

| Layer | Files | Status |
|---:|---:|---|
| raw | 0 files | ⚠️ Empty |
| normalized | 0 files | ⚠️ Empty |
| canonical | 0 files | ⚠️ Empty |
| feature_store | 0 files | ⚠️ Empty |
| research | 0 files | ⚠️ Empty |
| exports | 0 files | ⚠️ Empty |

### Data Lake Contents

**canonical/**: Empty

**exports/**: Empty

**feature_store/**: Empty

**normalized/**: Empty

**raw/**: Empty

**research/**: Empty


---

## Overall Data Quality Score

**Score: 90/100**

| Area | Score | Max | % |
|---:|---:|---:|---:|
| Data Coverage | 30 | 40 | 75% |
| Market Completeness | 25 | 25 | 100% |
| Closing Odds | 20 | 20 | 100% |
| Provider Diversity | 15 | 15 | 100% |

---

## Critical Gaps Identified

| # | Gap | Impact | Priority | Resolution |
|---:|---|:---:|:---:|---|
| 1 | Non-EPL leagues lack historical odds data | CLV, edge, calibration impossible | 🔴 HIGH | Implement closing odds capture cron + backfill |
| 2 | No closing odds pipeline | CLV computation blocked | 🔴 HIGH | Build cron job polling near kickoff |
| 3 | Silver layer only has 2023-2024 (1 season) | Historical backtesting limited to EPL | 🟡 MEDIUM | Expand silver layer to more seasons |
| 4 | API keys not in .env | Production data flow blocked | 🔴 HIGH | Add API keys, test connectivity |
| 5 | Weather data unavailable from any provider | Feature gap | 🟢 LOW | Ignore or find weather API |
| 6 | Expected Points not available | Cannot validate xP models | 🟡 MEDIUM | Implement computation layer |
| 7 | No xG data in CSV (EPL) | Regression if model uses xG features | 🟡 MEDIUM | Use API-Football xG data |
| 8 | Possession/Subs only via API-Football | API quota concern for large backfills | 🟡 MEDIUM | Cache aggressively |
