# Asian Handicap Live Production Pipeline Status Report
**Run ID**: `RUN-AH-LIVE-1790700660935`  
**Pipeline Status**: **LIVE**  
**Execution Timestamp**: `2026-09-29T16:51:00.935Z` -> `2026-09-29T16:51:26.784Z`

## 1. Provider Connectivity & Quota Audit
| Provider | Auth | Live Status | Quota Before | Quota After | Quota Delta / Budget |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **API-Football** | PASS | LIVE | 682 | 682 | +0 / 7,500 daily |
| **Dribble360** | PASS | LIVE | N/A | N/A | Remaining: 4904 / 5,000 |
| **OddsPAPI** | PASS | LIVE | 202 | 215 | +13 / 250 monthly |

## 2. Ingestion & Market Summary
- **Fixtures Discovered (API-Football 7-Day)**: `2807`
- **Canonical Matches Mapped**: `598`
- **Fixtures Probed with Live Sharp Odds**: `12`
- **Total Real AH Lines Ingested**: `78`
  - **Pinnacle AH**: `70`
  - **SBOBET AH**: `8`
- **Total Predictions Generated**: `145`
  - **Value Bets**: `46` (High: `11`, Med: `27`, Low: `8`)
  - **No Value**: `94`
  - **Data Unavailable**: `5`
  - **Arithmetic Invariant**: `46 + 94 + 5 = 145` (RECONCILED: PASS)

### Sub-Window Breakdown:
- **Today ($T+0$)**: Total `124` (Value: `46`, No Value: `78`, Unavailable: `0`)
- **Upcoming 7 Days ($T+1$ to $T+7$)**: Total `21` (Value: `0`, No Value: `16`, Unavailable: `5`)

## 3. Salmo Synchronization
- **Salmo Sync Status**: **PASS**
- **Synced Decisions**: `11` records
- **Data Contract**: High confidence Asian Handicap lines only. Zero external credentials in Salmo.

## 4. Top Real Data Asian Handicap Predictions

### #1: Al-Markhiya vs Al Ahli Doha
- **League**: QSL Cup
- **Kickoff**: `2026-09-29T17:15:00+00:00`
- **Market**: Asian Handicap 0 (HOME)
- **Bookmaker**: Pinnacle
- **Entry Odds**: `2.940`
- **Model Probability**: `59.6%`
- **Fair Odds**: `1.677`
- **Edge**: `29.2%`
- **Expected Value (EV)**: `54.8%`
- **Confidence**: **MEDIUM**
- **CLV**: `PENDING`
- **Data Quality**: `PARTIAL`


### #2: Al-Markhiya vs Al Ahli Doha
- **League**: QSL Cup
- **Kickoff**: `2026-09-29T17:15:00+00:00`
- **Market**: Asian Handicap +0.25 (HOME)
- **Bookmaker**: Pinnacle
- **Entry Odds**: `2.430`
- **Model Probability**: `66.0%`
- **Fair Odds**: `1.515`
- **Edge**: `29.5%`
- **Expected Value (EV)**: `52.1%`
- **Confidence**: **HIGH**
- **CLV**: `PENDING`
- **Data Quality**: `PARTIAL`


### #3: Al-Markhiya vs Al Ahli Doha
- **League**: QSL Cup
- **Kickoff**: `2026-09-29T17:15:00+00:00`
- **Market**: Asian Handicap +0.5 (HOME)
- **Bookmaker**: Pinnacle
- **Entry Odds**: `2.120`
- **Model Probability**: `70.6%`
- **Fair Odds**: `1.416`
- **Edge**: `28.7%`
- **Expected Value (EV)**: `49.8%`
- **Confidence**: **HIGH**
- **CLV**: `PENDING`
- **Data Quality**: `PARTIAL`


### #4: Al-Markhiya vs Al Ahli Doha
- **League**: QSL Cup
- **Kickoff**: `2026-09-29T17:15:00+00:00`
- **Market**: Asian Handicap -0.25 (HOME)
- **Bookmaker**: Pinnacle
- **Entry Odds**: `3.070`
- **Model Probability**: `50.2%`
- **Fair Odds**: `1.992`
- **Edge**: `19.9%`
- **Expected Value (EV)**: `46.8%`
- **Confidence**: **MEDIUM**
- **CLV**: `PENDING`
- **Data Quality**: `PARTIAL`


### #5: Oman vs Kuwait
- **League**: Gulf Cup of Nations
- **Kickoff**: `2026-09-29T17:30:00+00:00`
- **Market**: Asian Handicap -0.25 (AWAY)
- **Bookmaker**: Pinnacle
- **Entry Odds**: `4.440`
- **Model Probability**: `34.0%`
- **Fair Odds**: `2.941`
- **Edge**: `12.7%`
- **Expected Value (EV)**: `44.0%`
- **Confidence**: **MEDIUM**
- **CLV**: `PENDING`
- **Data Quality**: `PARTIAL`


### #6: Al Waab vs Lusail City
- **League**: QSL Cup
- **Kickoff**: `2026-09-29T17:15:00+00:00`
- **Market**: Asian Handicap -0.25 (HOME)
- **Bookmaker**: Pinnacle
- **Entry Odds**: `2.990`
- **Model Probability**: `50.2%`
- **Fair Odds**: `1.992`
- **Edge**: `19.1%`
- **Expected Value (EV)**: `43.3%`
- **Confidence**: **MEDIUM**
- **CLV**: `PENDING`
- **Data Quality**: `PARTIAL`


### #7: Al-Markhiya vs Al Ahli Doha
- **League**: QSL Cup
- **Kickoff**: `2026-09-29T17:15:00+00:00`
- **Market**: Asian Handicap +0.75 (HOME)
- **Bookmaker**: Pinnacle
- **Entry Odds**: `1.900`
- **Model Probability**: `77.3%`
- **Fair Odds**: `1.293`
- **Edge**: `30.6%`
- **Expected Value (EV)**: `42.9%`
- **Confidence**: **HIGH**
- **CLV**: `PENDING`
- **Data Quality**: `PARTIAL`


### #8: Al Waab vs Lusail City
- **League**: QSL Cup
- **Kickoff**: `2026-09-29T17:15:00+00:00`
- **Market**: Asian Handicap 0 (HOME)
- **Bookmaker**: Pinnacle
- **Entry Odds**: `2.640`
- **Model Probability**: `59.6%`
- **Fair Odds**: `1.677`
- **Edge**: `24.4%`
- **Expected Value (EV)**: `41.8%`
- **Confidence**: **MEDIUM**
- **CLV**: `PENDING`
- **Data Quality**: `PARTIAL`


### #9: Oman vs Kuwait
- **League**: Gulf Cup of Nations
- **Kickoff**: `2026-09-29T17:30:00+00:00`
- **Market**: Asian Handicap 0 (AWAY)
- **Bookmaker**: Pinnacle
- **Entry Odds**: `3.840`
- **Model Probability**: `40.4%`
- **Fair Odds**: `2.477`
- **Edge**: `15.8%`
- **Expected Value (EV)**: `40.0%`
- **Confidence**: **MEDIUM**
- **CLV**: `PENDING`
- **Data Quality**: `PARTIAL`


### #10: Al-Markhiya vs Al Ahli Doha
- **League**: QSL Cup
- **Kickoff**: `2026-09-29T17:15:00+00:00`
- **Market**: Asian Handicap +1 (HOME)
- **Bookmaker**: Pinnacle
- **Entry Odds**: `1.704`
- **Model Probability**: `85.4%`
- **Fair Odds**: `1.170`
- **Edge**: `32.5%`
- **Expected Value (EV)**: `37.7%`
- **Confidence**: **HIGH**
- **CLV**: `PENDING`
- **Data Quality**: `PARTIAL`

