# Goals Over/Under (OU) Live Production Pipeline Status Report
**Run ID**: `RUN-OU-LIVE-1790704714153`  
**Pipeline Status**: **LIVE**  
**Execution Timestamp**: `2026-09-29T17:58:34.152Z` -> `2026-09-29T17:58:54.856Z`

## 1. Provider Connectivity & Quota Audit
| Provider | Auth | Live Status | Quota Before | Quota After | Quota Delta / Budget |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **API-Football** | PASS | LIVE | 800 | 800 | +0 / 7,500 daily |
| **Dribble360** | PASS | LIVE | N/A | N/A | Remaining: 4,901 / 5,000 |
| **OddsPAPI** | PASS | LIVE | 229 | 229 | +0 / 250 monthly |

## 2. Ingestion & Market Summary
- **Fixtures Discovered (API-Football 7-Day)**: `2799`
- **Canonical Matches Mapped**: `592`
- **Fixtures Probed with Live Sharp Odds**: `12`
- **Total Real OU Lines Ingested**: `106`
  - **Pinnacle OU**: `106`
  - **SBOBET OU**: `0`
- **Unique Lines Discovered**: `[1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5, 2.75, 3.0, 3.25, 3.5, 3.75, 4.0, 4.5, 5.5]`
- **Total Predictions Generated**: `118`
  - Today ($T+0$): `76`
  - Upcoming 7 Days ($T+1$ to $T+7$): `42`
  - Value Bets: `53`
  - High Confidence: `0`
  - Medium Confidence: `30`
  - Low Confidence: `23`
  - No Value: `53`
  - Data Unavailable: `12`

## 3. Salmo Synchronization
- **Salmo Sync Status**: **PASS**
- **Newly Synced Decisions**: `30` records
- **Total In Ledger (AH + BTTS + OU)**: `58` records
- **Data Contract**: High & Medium confidence OU lines only. Zero external credentials in Salmo.

## 4. Top Real Data Over/Under Predictions

### #1: Belgium U21 vs Wales U21
- **League**: UEFA U21 Championship - Qualification
- **Kickoff**: `2026-09-29T18:00:00+00:00`
- **Market**: OU UNDER 1.5 (HALF)
- **Bookmaker**: Pinnacle
- **Entry Odds**: `5.410`
- **Model Probability**: `29.3%`
- **Fair Odds**: `3.418`
- **Edge**: `11.8%`
- **Expected Value (EV)**: `58.3%`
- **Confidence**: **LOW**
- **CLV**: `PENDING`
- **Data Quality**: `PARTIAL`

### #2: Belgium U21 vs Wales U21
- **League**: UEFA U21 Championship - Qualification
- **Kickoff**: `2026-09-29T18:00:00+00:00`
- **Market**: OU UNDER 2.5 (HALF)
- **Bookmaker**: Pinnacle
- **Entry Odds**: `2.640`
- **Model Probability**: `55.7%`
- **Fair Odds**: `1.796`
- **Edge**: `20.0%`
- **Expected Value (EV)**: `47.0%`
- **Confidence**: **MEDIUM**
- **CLV**: `PENDING`
- **Data Quality**: `PARTIAL`

### #3: Belgium U21 vs Wales U21
- **League**: UEFA U21 Championship - Qualification
- **Kickoff**: `2026-09-29T18:00:00+00:00`
- **Market**: OU UNDER 2.75 (QUARTER)
- **Bookmaker**: Pinnacle
- **Entry Odds**: `2.380`
- **Model Probability**: `62.3%`
- **Fair Odds**: `1.606`
- **Edge**: `22.5%`
- **Expected Value (EV)**: `43.1%`
- **Confidence**: **MEDIUM**
- **CLV**: `PENDING`
- **Data Quality**: `PARTIAL`

### #4: Boreham Wood vs Kidderminster Harriers
- **League**: National League
- **Kickoff**: `2026-09-29T18:00:00+00:00`
- **Market**: OU UNDER 1.5 (HALF)
- **Bookmaker**: Pinnacle
- **Entry Odds**: `4.800`
- **Model Probability**: `29.3%`
- **Fair Odds**: `3.418`
- **Edge**: `9.5%`
- **Expected Value (EV)**: `40.4%`
- **Confidence**: **LOW**
- **CLV**: `PENDING`
- **Data Quality**: `PARTIAL`

### #5: Belgium U21 vs Wales U21
- **League**: UEFA U21 Championship - Qualification
- **Kickoff**: `2026-09-29T18:00:00+00:00`
- **Market**: OU UNDER 3 (FULL)
- **Bookmaker**: Pinnacle
- **Entry Odds**: `2.100`
- **Model Probability**: `70.6%`
- **Fair Odds**: `1.416`
- **Edge**: `25.5%`
- **Expected Value (EV)**: `38.1%`
- **Confidence**: **MEDIUM**
- **CLV**: `PENDING`
- **Data Quality**: `PARTIAL`
