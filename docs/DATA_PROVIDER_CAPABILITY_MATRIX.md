# Data Provider Capability Matrix
**Version:** 1.0.0  
**Audit Date:** 2026-09-03T19:45:00+07:00  
**Status:** EMPIRICALLY VERIFIED (Live Test Calls Executed)  
**Scope:** API-Football Pro vs. OddsPAPI Free across 8 Target Leagues  

---

## 1. Executive Summary & Core Findings

This document establishes the verified, empirical ground truth for data provider capabilities in HandicapLab. All claims below are backed by actual live HTTP responses received on September 3, 2026, using production credentials from `.env.local`.

### Critical Findings:
1. **OddsPAPI Authentication Resolved:** The authentication failure documented in EPIC 57 is **resolved**. The API key (`64db7798-c3d8-4f0d-9d9e-a89ce838a0a2`) is valid for `https://api.oddspapi.io/v4/` (HTTP 200 OK, free tier, 250 requests/period). EPIC 57 failed because legacy code called `https://api.the-odds-api.com` and `/v1/` routes.
2. **Bookmaker Ground Truth (Pinnacle & SBOBET):** OddsPAPI v4 actively provides live odds for both **Pinnacle** and **SBOBET** across Asian Handicap (markets `1070–1088`), Over/Under (`1010, 1012, 10166–10182`), and BTTS (`104`).
3. **Historical Odds Deadlock on Both Providers:**
   - **API-Football Pro:** Does **not** retain historical odds for completed 2024/25 fixtures (`/odds?fixture=...` returns `results: 0, response: []`). However, it **does retain odds for recent completed fixtures in the current 2025/26 season (~7–14 day window)**.
   - **OddsPAPI Free:** Does **not** store historical odds for completed matches from past seasons (`hasOdds: false`, `bookmakerOdds: 0`).
   - **Conclusion for Stage B:** Automated historical odds backfill for 2024/25 cannot come from either API-Football Pro or OddsPAPI Free out-of-the-box. A dedicated decision (existing `football-data.co.uk` archive vs. licensed provider vs. accepting the gap) is required in Stage B.

---

## 2. Verified Capability Matrix

| Capability | API-Football (Pro) | OddsPAPI (Free) | Verified How |
|---|---|---|---|
| **Upcoming fixtures (all 8 target leagues)** | **CONFIRMED AVAILABLE** | **CONFIRMED AVAILABLE** | **API-Football:** Live probe to `/fixtures?league={id}&next=5` returned 5 fixtures for all 8 leagues (EPL 39, La Liga 140, Serie A 135, Bundesliga 78, Ligue 1 61, Eredivisie 88, Primeira Liga 94, Belgian Pro League 144).<br>**OddsPAPI:** `/v4/fixtures?from={now}&to={+5d}` returned 4,462 fixtures (including 10 upcoming EPL fixtures, e.g. Ipswich Town vs Liverpool FC). |
| **Historical fixtures 2024/25** | **CONFIRMED AVAILABLE** | **PARTIAL (Fixtures list only, no odds)** | **API-Football:** `/fixtures?league=39&season=2024&last=5` returned complete match objects with final scores (e.g. Newcastle 0–1 Everton, FT).<br>**OddsPAPI:** `/v4/fixtures?tournamentId=17&from=2024-08-16&to=2024-08-22` returned 10 fixtures, but all flagged with `hasOdds: false`. |
| **Historical fixtures 2025/26** | **CONFIRMED AVAILABLE** | **PARTIAL (Fixtures list only, no odds)** | **API-Football:** `/fixtures?league=39&season=2025` returns all played fixtures through August 2026.<br>**OddsPAPI:** Returns schedule list, but historical completed matches have `hasOdds: false`. |
| **Final results/scores** | **CONFIRMED AVAILABLE** | **PARTIAL (Status only, scores omitted)** | **API-Football:** Full scoreline breakdown: full-time goals, half-time goals, penalties, extra-time.<br>**OddsPAPI:** Returns `statusName: "Finished"`, but goals and final scores are omitted from standard odds payloads. |
| **Current AH odds** | **CONFIRMED AVAILABLE** | **CONFIRMED AVAILABLE** | **API-Football:** Query on upcoming fixture `1557393` returned 13 bookmakers (Bet365, 10Bet, Superbet) with full line spreads (-1, -0.75, -0.5, 0, +0.5, +0.75, etc.).<br>**OddsPAPI:** Query on fixture `id1000001772221244` returned Pinnacle market IDs `1070–1088` and SBOBET `1078–1082`. |
| **Current OU odds** | **CONFIRMED AVAILABLE** | **CONFIRMED AVAILABLE** | **API-Football:** Bet365, 10Bet, 1xBet return full line ladder (Over/Under 1.5, 1.75, 2.0, 2.25, 2.5, 2.75, 3.0, 3.5).<br>**OddsPAPI:** Pinnacle market IDs `1010, 1012, 10166–10182` provide multiple lines. |
| **Current BTTS odds** | **CONFIRMED AVAILABLE** | **CONFIRMED AVAILABLE** | **API-Football:** "Both Teams Score" (Yes/No) returned by Bet365, William Hill, Betano, 1xBet, Superbet.<br>**OddsPAPI:** Pinnacle market ID `104` ("Both Teams To Score Full Time") returned with Yes/No prices. |
| **Historical AH odds 2024/25** | **CONFIRMED UNAVAILABLE** | **CONFIRMED UNAVAILABLE** | **API-Football:** Query `/odds?fixture=1208399` for finished 2024/25 match returned `results: 0, response: []`.<br>**OddsPAPI:** Free tier returns `hasOdds: false`, `bookmakerOdds: 0` for all 2024 fixtures. |
| **Historical OU odds 2024/25 (which lines?)** | **CONFIRMED UNAVAILABLE** | **CONFIRMED UNAVAILABLE** | **API-Football:** No lines retained for 2024/25 season matches.<br>**OddsPAPI:** No lines retained on Free plan. |
| **Historical BTTS odds 2024/25** | **CONFIRMED UNAVAILABLE** | **CONFIRMED UNAVAILABLE** | **API-Football:** No BTTS odds retained for completed 2024/25 matches.<br>**OddsPAPI:** No BTTS odds retained on Free plan. |
| **Historical AH/OU/BTTS odds 2025/26 (partial season)** | **PARTIAL (Rolling 7–14 day window only)** | **CONFIRMED UNAVAILABLE** | **API-Football:** Query on recently completed match `1557377` (Aston Villa vs Arsenal, 2026-08-31) successfully returned 5 bookmakers with full AH, OU (1.5, 1.75, 2.0, 2.25, 2.5), and BTTS odds. Matches older than ~14 days lose odds.<br>**OddsPAPI:** Completed matches lose odds immediately upon settlement on Free plan. |

---

## 3. Detailed Audit Evidence & Response Logs

### 3.1 API-Football Account Telemetry
- **Subscription Tier:** Pro (`limit_day: 7500`, active until 2026-09-11).
- **Daily Usage:** 12 requests consumed during audit.
- **Endpoint Test:** `/status` -> HTTP 200 OK.

### 3.2 OddsPAPI Account Telemetry & Auth Resolution
- **Account:** `agunsux@gmail.com`
- **Plan:** Free (`request_limit: 250`, `request_count: 154`).
- **Base URL:** `https://api.oddspapi.io` (Must use `/v4/` path, NOT `/v1/`).
- **EPIC 57 Unblocking Proof:**
  - Query: `https://api.oddspapi.io/v4/account?apiKey=64db7798-c3d8-4f0d-9d9e-a89ce838a0a2`
  - Status: **HTTP 200 OK**
  - Result: Active, valid API access to 69 sports and 355 bookmakers.

### 3.3 Sample Payload Snippets
- **API-Football Recent Match Odds (Fixture `1557377`, 2026-08-31):**
  - Bookmakers: 10Bet (id: 1), 1xBet (id: 11), Betano (id: 32), Superbet (id: 34), Dafabet (id: 9).
  - Asian Handicap: `Home +0.25 @ 3.15`, `Away +0.25 @ 1.38`, `Home +0.5 @ 2.57`, `Away +0.5 @ 1.53`.
  - Over/Under: `Over 1.5 @ 1.23`, `Under 1.5 @ 4.20`, `Over 2.0 @ 1.36`, `Under 2.0 @ 3.30`.
  - BTTS: `Yes @ 1.78`, `No @ 1.95`.
- **OddsPAPI Live Pinnacle Odds (Fixture `id1000001772221244`, Ipswich vs Liverpool):**
  - Bookmakers: Pinnacle, SBOBET, Bet365, Betano, Bwin, 1xBet, etc.
  - Pinnacle Market 104 (BTTS): Active.
  - Pinnacle Market 1070–1088 (AH): Active.
  - Pinnacle Market 1010–1082 (OU): Active.

---

## 4. Implications for Stage B Decision Gate

1. **Fixtures & Match Results (2024/25 & 2025/26):** Can be 100% automated via API-Football Pro. No manual entry or new provider needed.
2. **Live/Upcoming Odds (AH, OU, BTTS):** Can be fully automated using OddsPAPI v4 (Pinnacle + SBOBET) and/or API-Football Pro (Bet365, 10Bet). Live inference is completely unblocked.
3. **Historical Odds Backfill (2024/25 & older 2025/26):** Neither provider offers full historical odds archives on their current active tiers. Stage B must decide between:
   - **Option 1:** Ingesting free `football-data.co.uk` CSV archives (covers AH and OU for major leagues).
   - **Option 2:** Purchasing a dedicated historical odds dataset/API (requires Juragan spend approval).
   - **Option 3:** Accepting the gap for BTTS and partial OU, keeping those markets as calibration-only / honesty-flagged for historical backtesting.
