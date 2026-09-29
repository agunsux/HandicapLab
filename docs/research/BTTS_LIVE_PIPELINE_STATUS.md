# Both Teams To Score (BTTS) Live Production Pipeline Status Report
**Run ID**: `RUN-BTTS-LIVE-1790702952513`  
**Pipeline Status**: **LIVE**  
**Execution Timestamp**: `2026-09-29T17:29:12.512Z` -> `2026-09-29T17:29:36.871Z`

## 1. Provider Connectivity & Quota Audit
| Provider | Auth | Live Status | Quota Before | Quota After | Quota Delta / Budget |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **API-Football** | PASS | LIVE | 736 | 736 | +0 / 7,500 daily |
| **Dribble360** | PASS | LIVE | N/A | N/A | Remaining: 4903 / 5,000 |
| **OddsPAPI** | PASS | LIVE | 215 | 228 | +13 / 250 monthly |

## 2. Ingestion & Market Summary
- **Fixtures Discovered (API-Football 7-Day)**: `2801`
- **Canonical Matches Mapped**: `608`
- **Fixtures Probed with Live Sharp Odds**: `12`
- **Total Real BTTS Lines Ingested**: `8`
  - **Pinnacle BTTS**: `8`
  - **SBOBET BTTS**: `0`
- **Total Predictions Generated**: `24`
  - Today ($T+0$): `12`
  - Upcoming 7 Days ($T+1$ to $T+7$): `12`
  - Value Bets: `6`
  - High Confidence: `0`
  - Medium Confidence: `6`
  - Low Confidence: `1`
  - No Value: `10`
  - Data Unavailable: `8`

## 3. Salmo Synchronization
- **Salmo Sync Status**: **PASS**
- **Synced Decisions**: `6` records
- **Data Contract**: High & Medium confidence BTTS lines only. Zero external credentials in Salmo.

## 4. Top Real Data BTTS Predictions

### #1: Mexico vs Peru
- **League**: Friendlies
- **Kickoff**: `2026-09-30T01:00:00+00:00`
- **Market**: Both Teams To Score (YES)
- **Bookmaker**: Pinnacle
- **Entry Odds**: `2.420`
- **Model Probability**: `52.8%`
- **Fair Odds**: `1.894`
- **Edge**: `13.6%`
- **Expected Value (EV)**: `27.8%`
- **Confidence**: **MEDIUM**
- **CLV**: `PENDING`
- **Data Quality**: `PARTIAL`


### #2: Belgium U21 vs Wales U21
- **League**: UEFA U21 Championship - Qualification
- **Kickoff**: `2026-09-29T18:00:00+00:00`
- **Market**: Both Teams To Score (YES)
- **Bookmaker**: Pinnacle
- **Entry Odds**: `2.280`
- **Model Probability**: `52.8%`
- **Fair Odds**: `1.894`
- **Edge**: `11.3%`
- **Expected Value (EV)**: `20.4%`
- **Confidence**: **MEDIUM**
- **CLV**: `PENDING`
- **Data Quality**: `PARTIAL`


### #3: Benin vs Mauritania
- **League**: Africa Cup of Nations - Qualification
- **Kickoff**: `2026-09-29T17:00:00+00:00`
- **Market**: Both Teams To Score (YES)
- **Bookmaker**: Pinnacle
- **Entry Odds**: `2.170`
- **Model Probability**: `52.8%`
- **Fair Odds**: `1.894`
- **Edge**: `9.0%`
- **Expected Value (EV)**: `14.6%`
- **Confidence**: **MEDIUM**
- **CLV**: `PENDING`
- **Data Quality**: `PARTIAL`


### #4: Republic of Ireland U21 vs Kazakhstan U21
- **League**: UEFA U21 Championship - Qualification
- **Kickoff**: `2026-09-29T18:00:00+00:00`
- **Market**: Both Teams To Score (YES)
- **Bookmaker**: Pinnacle
- **Entry Odds**: `2.170`
- **Model Probability**: `52.8%`
- **Fair Odds**: `1.894`
- **Edge**: `9.2%`
- **Expected Value (EV)**: `14.6%`
- **Confidence**: **MEDIUM**
- **CLV**: `PENDING`
- **Data Quality**: `PARTIAL`


### #5: Saudi Arabia vs Iraq
- **League**: Gulf Cup of Nations
- **Kickoff**: `2026-09-29T17:30:00+00:00`
- **Market**: Both Teams To Score (YES)
- **Bookmaker**: Pinnacle
- **Entry Odds**: `2.120`
- **Model Probability**: `52.8%`
- **Fair Odds**: `1.894`
- **Edge**: `8.0%`
- **Expected Value (EV)**: `11.9%`
- **Confidence**: **MEDIUM**
- **CLV**: `PENDING`
- **Data Quality**: `PARTIAL`


### #6: Oman vs Kuwait
- **League**: Gulf Cup of Nations
- **Kickoff**: `2026-09-29T17:30:00+00:00`
- **Market**: Both Teams To Score (YES)
- **Bookmaker**: Pinnacle
- **Entry Odds**: `1.990`
- **Model Probability**: `52.8%`
- **Fair Odds**: `1.894`
- **Edge**: `5.5%`
- **Expected Value (EV)**: `5.1%`
- **Confidence**: **MEDIUM**
- **CLV**: `PENDING`
- **Data Quality**: `PARTIAL`

