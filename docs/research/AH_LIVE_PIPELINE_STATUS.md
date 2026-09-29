# Asian Handicap Live Production Pipeline Status Report
**Run ID**: `RUN-AH-LIVE-1790687929514`  
**Pipeline Status**: **LIVE**  
**Execution Timestamp**: `2026-09-29T13:18:49.513Z` -> `2026-09-29T13:19:15.112Z`

## 1. Provider Connectivity & Quota Audit
| Provider | Auth | Live Status | Quota Before | Quota After | Quota Delta / Budget |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **API-Football** | PASS | LIVE | 527 | 527 | +0 / 7,500 daily |
| **Dribble360** | PASS | LIVE | N/A | N/A | Remaining: 4905 / 5,000 |
| **OddsPAPI** | PASS | LIVE | 189 | 202 | +13 / 250 monthly |

## 2. Ingestion & Market Summary
- **Fixtures Discovered (API-Football 7-Day)**: `2838`
- **Canonical Matches Mapped**: `587`
- **Fixtures Probed with Live Sharp Odds**: `12`
- **Total Real AH Lines Ingested**: `87`
  - **Pinnacle AH**: `73`
  - **SBOBET AH**: `14`
- **Total Predictions Generated**: `148`
  - Today ($T+0$): `72`
  - Upcoming 7 Days ($T+1$ to $T+7$): `76`
  - Value Bets: `36`
  - High Confidence: `9`
  - Medium Confidence: `20`
  - Low Confidence: `7`
  - No Value: `112`
  - Data Unavailable: `2`

## 3. Salmo Synchronization
- **Salmo Sync Status**: **PASS**
- **Synced Decisions**: `9` records
- **Data Contract**: High confidence Asian Handicap lines only. Zero external credentials in Salmo.

## 4. Top Real Data Asian Handicap Predictions

### #1: Slovenia U21 vs Israel U21
- **League**: UEFA U21 Championship - Qualification
- **Kickoff**: `2026-09-29T14:00:00+00:00`
- **Market**: Asian Handicap -0.75 (AWAY)
- **Bookmaker**: Pinnacle
- **Entry Odds**: `4.770`
- **Model Probability**: `56.6%`
- **Fair Odds**: `1.766`
- **Edge**: `36.7%`
- **Expected Value (EV)**: `181.2%`
- **Confidence**: **MEDIUM**
- **CLV**: `PENDING`
- **Data Quality**: `PARTIAL`


### #2: Inter Bratislava vs Podbrezová
- **League**: Cup
- **Kickoff**: `2026-09-29T13:30:00+00:00`
- **Market**: Asian Handicap -2 (AWAY)
- **Bookmaker**: Pinnacle
- **Entry Odds**: `3.020`
- **Model Probability**: `78.6%`
- **Fair Odds**: `1.272`
- **Edge**: `48.2%`
- **Expected Value (EV)**: `150.7%`
- **Confidence**: **HIGH**
- **CLV**: `PENDING`
- **Data Quality**: `PARTIAL`


### #3: Independiente Medellin vs Millonarios
- **League**: Primera A
- **Kickoff**: `2026-09-30T01:05:00+00:00`
- **Market**: Asian Handicap -0.75 (AWAY)
- **Bookmaker**: Pinnacle
- **Entry Odds**: `4.110`
- **Model Probability**: `56.6%`
- **Fair Odds**: `1.766`
- **Edge**: `33.4%`
- **Expected Value (EV)**: `143.8%`
- **Confidence**: **MEDIUM**
- **CLV**: `PENDING`
- **Data Quality**: `PARTIAL`


### #4: Madagascar vs Tanzania
- **League**: Africa Cup of Nations - Qualification
- **Kickoff**: `2026-09-29T14:00:00+00:00`
- **Market**: Asian Handicap -0.75 (AWAY)
- **Bookmaker**: Pinnacle
- **Entry Odds**: `3.750`
- **Model Probability**: `56.6%`
- **Fair Odds**: `1.766`
- **Edge**: `31.6%`
- **Expected Value (EV)**: `123.4%`
- **Confidence**: **MEDIUM**
- **CLV**: `PENDING`
- **Data Quality**: `PARTIAL`


### #5: Slovenia U21 vs Israel U21
- **League**: UEFA U21 Championship - Qualification
- **Kickoff**: `2026-09-29T14:00:00+00:00`
- **Market**: Asian Handicap -0.5 (AWAY)
- **Bookmaker**: Pinnacle
- **Entry Odds**: `3.630`
- **Model Probability**: `56.6%`
- **Fair Odds**: `1.766`
- **Edge**: `30.4%`
- **Expected Value (EV)**: `105.6%`
- **Confidence**: **MEDIUM**
- **CLV**: `PENDING`
- **Data Quality**: `PARTIAL`


### #6: Inter Bratislava vs Podbrezová
- **League**: Cup
- **Kickoff**: `2026-09-29T13:30:00+00:00`
- **Market**: Asian Handicap -1.75 (AWAY)
- **Bookmaker**: Pinnacle
- **Entry Odds**: `2.430`
- **Model Probability**: `78.6%`
- **Fair Odds**: `1.272`
- **Edge**: `40.8%`
- **Expected Value (EV)**: `97.7%`
- **Confidence**: **HIGH**
- **CLV**: `PENDING`
- **Data Quality**: `PARTIAL`


### #7: Madagascar vs Tanzania
- **League**: Africa Cup of Nations - Qualification
- **Kickoff**: `2026-09-29T14:00:00+00:00`
- **Market**: Asian Handicap -0.5 (AWAY)
- **Bookmaker**: Pinnacle
- **Entry Odds**: `3.410`
- **Model Probability**: `56.6%`
- **Fair Odds**: `1.766`
- **Edge**: `28.9%`
- **Expected Value (EV)**: `93.1%`
- **Confidence**: **MEDIUM**
- **CLV**: `PENDING`
- **Data Quality**: `PARTIAL`


### #8: Inter Bratislava vs Podbrezová
- **League**: Cup
- **Kickoff**: `2026-09-29T13:30:00+00:00`
- **Market**: Asian Handicap +0.5 (HOME)
- **Bookmaker**: Pinnacle
- **Entry Odds**: `2.640`
- **Model Probability**: `70.6%`
- **Fair Odds**: `1.416`
- **Edge**: `35.8%`
- **Expected Value (EV)**: `86.5%`
- **Confidence**: **HIGH**
- **CLV**: `PENDING`
- **Data Quality**: `PARTIAL`


### #9: Inter Bratislava vs Podbrezová
- **League**: Cup
- **Kickoff**: `2026-09-29T13:30:00+00:00`
- **Market**: Asian Handicap +0.25 (HOME)
- **Bookmaker**: Pinnacle
- **Entry Odds**: `3.030`
- **Model Probability**: `57.0%`
- **Fair Odds**: `1.754`
- **Edge**: `26.8%`
- **Expected Value (EV)**: `86.4%`
- **Confidence**: **MEDIUM**
- **CLV**: `PENDING`
- **Data Quality**: `PARTIAL`


### #10: USA vs Chile
- **League**: Friendlies
- **Kickoff**: `2026-09-30T00:00:00+00:00`
- **Market**: Asian Handicap 0 (AWAY)
- **Bookmaker**: Pinnacle
- **Entry Odds**: `5.400`
- **Model Probability**: `29.4%`
- **Fair Odds**: `3.406`
- **Edge**: `11.7%`
- **Expected Value (EV)**: `85.8%`
- **Confidence**: **MEDIUM**
- **CLV**: `PENDING`
- **Data Quality**: `PARTIAL`

