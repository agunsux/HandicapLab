# Goals Over/Under (OU) Live Production Pipeline Status Report
**Run ID**: `RUN-OU-LIVE-1790705451927`  
**Pipeline Status**: **LIVE**  
**Execution Timestamp**: `2026-09-29T18:10:51.926Z` -> `2026-09-29T18:11:18.020Z`

## 1. Provider Connectivity & Quota Audit
| Provider | Auth | Live Status | Quota Before | Quota After | Quota Delta / Budget |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **API-Football** | PASS | LIVE | 847 | 847 | +0 / 7,500 daily |
| **Dribble360** | PASS | LIVE | N/A | N/A | Remaining: 4900 / 5,000 |
| **OddsPAPI** | PASS | LIVE | 242 | 250 | +8 / 250 monthly |

## 2. Ingestion & Market Summary
- **Fixtures Discovered (API-Football 7-Day)**: `2789`
- **Canonical Matches Mapped**: `606`
- **Fixtures Probed with Live Sharp Odds**: `12`
- **Total Real OU Lines Ingested**: `66`
  - **Pinnacle OU**: `66`
  - **SBOBET OU**: `0`
- **Unique Lines Discovered**: `[1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75, 4, 4.25, 4.5, 5.5]`
- **Total Predictions Generated**: `142`
  - Today ($T+0$): `116`
  - Upcoming 7 Days ($T+1$ to $T+7$): `26`
  - Value Bets: `57`
  - High Confidence: `0`
  - Medium Confidence: `27`
  - Low Confidence: `30`
  - No Value: `75`
  - Data Unavailable: `10`

## 3. Salmo Synchronization
- **Salmo Sync Status**: **PASS**
- **Synced Decisions**: `27` records
- **Data Contract**: High & Medium confidence OU lines only. Zero external credentials in Salmo.

## 4. Top Real Data Over/Under Predictions

### #1: San Marino vs Albania
- **League**: UEFA Nations League
- **Kickoff**: `2026-09-29T18:45:00+00:00`
- **Market**: OU UNDER 2.5 (HALF)
- **Bookmaker**: Pinnacle
- **Entry Odds**: `3.190`
- **Model Probability**: `51.8%`
- **Fair Odds**: `1.929`
- **Edge**: `22.3%`
- **Expected Value (EV)**: `65.4%`
- **Confidence**: **LOW**
- **CLV**: `PENDING`
- **Data Quality**: `PARTIAL`


### #2: San Marino vs Albania
- **League**: UEFA Nations League
- **Kickoff**: `2026-09-29T18:45:00+00:00`
- **Market**: OU UNDER 3 (FULL)
- **Bookmaker**: Pinnacle
- **Entry Odds**: `2.770`
- **Model Probability**: `66.3%`
- **Fair Odds**: `1.509`
- **Edge**: `32.4%`
- **Expected Value (EV)**: `65.4%`
- **Confidence**: **LOW**
- **CLV**: `PENDING`
- **Data Quality**: `PARTIAL`


### #3: San Marino vs Albania
- **League**: UEFA Nations League
- **Kickoff**: `2026-09-29T18:45:00+00:00`
- **Market**: OU UNDER 1.5 (HALF)
- **Bookmaker**: Pinnacle
- **Entry Odds**: `6.270`
- **Model Probability**: `26.2%`
- **Fair Odds**: `3.811`
- **Edge**: `11.2%`
- **Expected Value (EV)**: `64.5%`
- **Confidence**: **LOW**
- **CLV**: `PENDING`
- **Data Quality**: `PARTIAL`


### #4: Spain vs Croatia
- **League**: UEFA Nations League
- **Kickoff**: `2026-09-29T18:45:00+00:00`
- **Market**: OU UNDER 2.25 (QUARTER)
- **Bookmaker**: Pinnacle
- **Entry Odds**: `3.830`
- **Model Probability**: `44.8%`
- **Fair Odds**: `2.233`
- **Edge**: `19.9%`
- **Expected Value (EV)**: `62.3%`
- **Confidence**: **LOW**
- **CLV**: `PENDING`
- **Data Quality**: `PARTIAL`


### #5: Spain vs Croatia
- **League**: UEFA Nations League
- **Kickoff**: `2026-09-29T18:45:00+00:00`
- **Market**: OU UNDER 2.5 (HALF)
- **Bookmaker**: Pinnacle
- **Entry Odds**: `3.060`
- **Model Probability**: `51.8%`
- **Fair Odds**: `1.929`
- **Edge**: `20.7%`
- **Expected Value (EV)**: `58.6%`
- **Confidence**: **LOW**
- **CLV**: `PENDING`
- **Data Quality**: `PARTIAL`


### #6: San Marino vs Albania
- **League**: UEFA Nations League
- **Kickoff**: `2026-09-29T18:45:00+00:00`
- **Market**: OU UNDER 3.25 (QUARTER)
- **Bookmaker**: Pinnacle
- **Entry Odds**: `2.310`
- **Model Probability**: `70.4%`
- **Fair Odds**: `1.421`
- **Edge**: `29.7%`
- **Expected Value (EV)**: `55.8%`
- **Confidence**: **MEDIUM**
- **CLV**: `PENDING`
- **Data Quality**: `PARTIAL`


### #7: Spain vs Croatia
- **League**: UEFA Nations League
- **Kickoff**: `2026-09-29T18:45:00+00:00`
- **Market**: OU UNDER 2.75 (QUARTER)
- **Bookmaker**: Pinnacle
- **Entry Odds**: `2.740`
- **Model Probability**: `58.2%`
- **Fair Odds**: `1.719`
- **Edge**: `23.4%`
- **Expected Value (EV)**: `52.9%`
- **Confidence**: **LOW**
- **CLV**: `PENDING`
- **Data Quality**: `PARTIAL`


### #8: San Marino vs Albania
- **League**: UEFA Nations League
- **Kickoff**: `2026-09-29T18:45:00+00:00`
- **Market**: OU UNDER 2.75 (QUARTER)
- **Bookmaker**: Pinnacle
- **Entry Odds**: `2.680`
- **Model Probability**: `58.2%`
- **Fair Odds**: `1.719`
- **Edge**: `23.0%`
- **Expected Value (EV)**: `49.8%`
- **Confidence**: **MEDIUM**
- **CLV**: `PENDING`
- **Data Quality**: `PARTIAL`


### #9: San Marino vs Albania
- **League**: UEFA Nations League
- **Kickoff**: `2026-09-29T18:45:00+00:00`
- **Market**: OU UNDER 3.5 (HALF)
- **Bookmaker**: Pinnacle
- **Entry Odds**: `2.030`
- **Model Probability**: `73.6%`
- **Fair Odds**: `1.359`
- **Edge**: `27.0%`
- **Expected Value (EV)**: `49.4%`
- **Confidence**: **MEDIUM**
- **CLV**: `PENDING`
- **Data Quality**: `PARTIAL`


### #10: Spain vs Croatia
- **League**: UEFA Nations League
- **Kickoff**: `2026-09-29T18:45:00+00:00`
- **Market**: OU UNDER 3 (FULL)
- **Bookmaker**: Pinnacle
- **Entry Odds**: `2.450`
- **Model Probability**: `66.3%`
- **Fair Odds**: `1.509`
- **Edge**: `27.0%`
- **Expected Value (EV)**: `48.8%`
- **Confidence**: **MEDIUM**
- **CLV**: `PENDING`
- **Data Quality**: `PARTIAL`


### #11: Benin vs Mauritania
- **League**: Africa Cup of Nations - Qualification
- **Kickoff**: `2026-09-29T17:00:00+00:00`
- **Market**: OU OVER 2.5 (HALF)
- **Bookmaker**: Pinnacle
- **Entry Odds**: `3.000`
- **Model Probability**: `48.2%`
- **Fair Odds**: `2.076`
- **Edge**: `16.8%`
- **Expected Value (EV)**: `44.5%`
- **Confidence**: **LOW**
- **CLV**: `PENDING`
- **Data Quality**: `PARTIAL`


### #12: Spain vs Croatia
- **League**: UEFA Nations League
- **Kickoff**: `2026-09-29T18:45:00+00:00`
- **Market**: OU UNDER 2 (FULL)
- **Bookmaker**: Pinnacle
- **Entry Odds**: `4.490`
- **Model Probability**: `35.3%`
- **Fair Odds**: `2.835`
- **Edge**: `14.0%`
- **Expected Value (EV)**: `43.4%`
- **Confidence**: **LOW**
- **CLV**: `PENDING`
- **Data Quality**: `PARTIAL`


### #13: San Marino vs Albania
- **League**: UEFA Nations League
- **Kickoff**: `2026-09-29T18:45:00+00:00`
- **Market**: OU UNDER 3.75 (QUARTER)
- **Bookmaker**: Pinnacle
- **Entry Odds**: `1.833`
- **Model Probability**: `79.2%`
- **Fair Odds**: `1.263`
- **Edge**: `27.1%`
- **Expected Value (EV)**: `42.0%`
- **Confidence**: **MEDIUM**
- **CLV**: `PENDING`
- **Data Quality**: `PARTIAL`


### #14: Spain vs Croatia
- **League**: UEFA Nations League
- **Kickoff**: `2026-09-29T18:45:00+00:00`
- **Market**: OU UNDER 3.25 (QUARTER)
- **Bookmaker**: Pinnacle
- **Entry Odds**: `2.090`
- **Model Probability**: `70.4%`
- **Fair Odds**: `1.421`
- **Edge**: `23.8%`
- **Expected Value (EV)**: `42.0%`
- **Confidence**: **MEDIUM**
- **CLV**: `PENDING`
- **Data Quality**: `PARTIAL`


### #15: Benin vs Mauritania
- **League**: Africa Cup of Nations - Qualification
- **Kickoff**: `2026-09-29T17:00:00+00:00`
- **Market**: OU OVER 2.25 (QUARTER)
- **Bookmaker**: Pinnacle
- **Entry Odds**: `2.600`
- **Model Probability**: `55.2%`
- **Fair Odds**: `1.811`
- **Edge**: `19.0%`
- **Expected Value (EV)**: `38.0%`
- **Confidence**: **MEDIUM**
- **CLV**: `PENDING`
- **Data Quality**: `PARTIAL`

