# FOOTYSTATS PRE-SUBSCRIPTION DATA SOURCE FORENSIC AUDIT
### Pre-Subscription Evaluation of FootyStats API (Hobby Tier £29.99/mo) for HandicapLab Data & Research Layer

**Document ID:** `AUDIT-FOOTYSTATS-PRE-SUB-v1.0`  
**Date:** September 16, 2026  
**Auditor:** Quantitative Research & Architecture Lead  
**Target Tier:** FootyStats API Hobby (£29.99/month)  
**Evaluation Mode:** STRICT PRE-SUBSCRIPTION — ZERO PAID CALLS — PUBLIC DOCUMENTATION & CODEBASE FORENSIC AUDIT  
**Status:** COMPLETE — GATE 0 PASS (Sufficient Documentation for Controlled Decision)

---

## 1. EXECUTIVE SUMMARY & VERDICT

### 1.1 Context & Objective
HandicapLab is the quantitative football research and data normalization backbone for the Salmo consumer Decision OS. While HandicapLab currently maintains a strong historical Asian Handicap (AH) dataset (8,898 matches, 23,864 odds rows across Top 5 leagues from 2015–2026), its historical Both Teams To Score (BTTS) odds inventory is **strictly zero rows** (`wh_closing_lines` / `data/golden/europe/` has no historical BTTS market prices). 

To expand research into BTTS and enrich pre-match feature engineering without excessive API spending, this audit evaluates whether subscribing to the **FootyStats API Hobby Tier (£29.99/month)** is technically viable, economically justified, and methodologically sound.

### 1.2 The Core Verdict: SUBSCRIBE ONLY FOR CONTROLLED VERIFICATION
```text
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ FOOTYSTATS API HOBBY TIER (£29.99/mo) EVALUATION VERDICT:                                    │
│                                                                                             │
│  VERDICT: CONDITIONAL PASS — AUTHORIZE CONTROLLED 1-MONTH SUBSCRIPTION                      │
│                                                                                             │
│  PURPOSE:                                                                                   │
│  1. Ingest multi-season match results & deep team statistics (shots, xG, form, corners).    │
│  2. Run forensic verification on `odds_btts_yes` / `odds_btts_no` against OddsPapi.         │
│                                                                                             │
│  HARD RESTRICTION (GOVERNANCE CEILING):                                                     │
│  ❌ FootyStats odds CANNOT be treated as Market Ground Truth or Closing Line Value (CLV).   │
│  ❌ FootyStats odds CANNOT be used as production execution prices without audit.            │
│  ✅ FootyStats IS APPROVED as a secondary feature store and preliminary BTTS calibration    │
│     evaluation source, subject to post-subscription verification (Gates FS-1 to FS-4).      │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. FOOTYSTATS PRICING & TIER ARCHITECTURE

Based on official public pricing documentation (`https://footystats.org/api/`):

| Plan | Monthly Price | Annual Price | Rate Limits | League Quota | Endpoints Included |
|---|---|---|---|---|---|
| **Hobby** | **£29.99/mo** | £19.99/mo (£239.88/yr) | **1,800 req/hour** (30 req/min) | **Pick 50 Leagues** | **All API Endpoints** |
| **Serious** | **£69.99/mo** | £49.99/mo (£599.88/yr) | 3,600 req/hour (60 req/min) | Pick 150 Leagues | All API Endpoints |
| **Enterprise / Everything**| **£389.99/mo** | £279.99/mo (£3,359.88/yr)| 4,500 req/hour (75 req/min) | 1,500+ Leagues (Global) | All API Endpoints |

### Key Tier Findings:
1. **Endpoint Parity**: FootyStats does **not** lock endpoints behind higher tiers. The Hobby plan (£29.99) includes all core endpoints (`/league-matches`, `/match`, `/league-season`, `/btts-stats`, etc.).
2. **League Selection Mechanism**: The Hobby plan allows selecting **50 specific leagues**. This is more than 5× the 10 leagues currently whitelisted in HandicapLab's research scope (EPL, Championship, Serie A, Bundesliga, La Liga, Ligue 1, Eredivisie, J1, K-League, Liga 1 Indonesia).
3. **Hourly Rate vs Monthly Quota**: The Hobby limit is **1,800 requests/hour**. Unlike API-Football which enforces a strict daily hard cap (e.g. 100 req/day on Free, 7,500 req/day on Pro at €29), FootyStats rate-limits by the hour without a published monthly ceiling.

---

## 3. REQUEST BUDGET & EFFICIENCY MODELING

### 3.1 The Bulk Endpoint Architecture
The single most decisive architectural feature discovered in FootyStats documentation is the `/league-matches` endpoint:
```http
GET https://api.football-data-api.com/league-matches?key=YOURKEY&season_id=X&max_per_page=500
```
- A standard top-flight European league season (e.g., Premier League, La Liga, Serie A) contains **380 matches**.
- `/league-matches` accepts `max_per_page=500` (up to 1,000 max).
- **Result:** An **entire season of 380 matches**, complete with match scores, dates, team IDs, half-time goals, basic match statistics, and embedded odds (`odds_ft_1`, `odds_ft_x`, `odds_ft_2`, `odds_btts_yes`, `odds_btts_no`), can be fetched in **a single (1) HTTP request**.

### 3.2 Ingestion Request Volume Calculation

| Operation | Target Scope | Endpoint Used | FootyStats Calls | API-Football Equivalent Calls |
|---|---|---|---|---|
| **Season Backfill (5 Leagues × 3 Seasons)** | 15 league-seasons (~5,700 matches) | `/league-matches` | **15 requests** | ~15 requests (fixtures) + 5,700 calls (if stats/odds separated) |
| **Season Metadata & Tables** | 15 league-seasons | `/league-season`, `/league-table` | **30 requests** | ~30 requests |
| **Total Initial Historical Sync** | **5,700 matches + odds** | | **45 requests** | **~5,730 requests** |
| **Hourly Quota Consumption** | Hobby: 1,800/hour | | **2.5% of 1 hour** | Exceeds free/low tiers |
| **Daily Incremental Sync** | 5 leagues, upcoming & yesterday | `/todays-matches` or `/league-matches` | **2–5 requests/day** | 10–20 requests/day |

**Audit Finding:** The Hobby tier rate limit (1,800 requests/hour) provides a **40× safety margin** over HandicapLab's entire multi-season ingestion requirements. A single worker could backfill 5 years of historical data across all 10 target leagues in under 15 minutes without approaching rate-limit thresholds.

---

## 4. MATCH & BETTING METRICS DATA INVENTORY

Based on public endpoint schema inspection (`/league-matches` and `/match`):

### 4.1 Documented Ground Truth Fields (`VERIFIED / DOCUMENTED`)
- **Match Identity & Metadata**:
  - `id`: Unique integer match ID
  - `homeID`, `awayID`: Integer team identifiers
  - `home_name`, `away_name`: Team strings
  - `competition_id`, `season`: Competition code and season label (`2019/2020`)
  - `roundID`, `game_week`: Gameweek sequence
  - `date_unix`: UTC kickoff timestamp
  - `status`: `"complete"` | `"incomplete"` | `"suspended"`
- **Scoring & Match Results**:
  - `homeGoalCount`, `awayGoalCount`: Full-time goals
  - `totalGoalCount`: Match total sum
  - `HTGoalCount`, `ht_goals_team_a`, `ht_goals_team_b`: Half-time score
  - `goals_2hg_team_a`, `goals_2hg_team_b`: Second-half goals
  - `homeGoals_timings`, `awayGoals_timings`: Minute-by-minute goal arrays
- **Derived Market Binary Indicators**:
  - `btts`: Boolean (true if both scored, false otherwise)
  - `over05`, `over15`, `over25`, `over35`, `over45`, `over55`: Boolean indicators
- **In-Match Fundamental Statistics**:
  - `team_a_shots`, `team_b_shots`: Total attempts
  - `team_a_shotsOnTarget`, `team_b_shotsOnTarget`: On-target attempts
  - `team_a_possession`, `team_b_possession`: Possession percentages
  - `team_a_corners`, `team_b_corners`: Corner counts
  - `team_a_fouls`, `team_b_fouls`: Fouls committed
  - `team_a_yellow_cards`, `team_b_yellow_cards`, red cards
  - `team_a_xg`, `team_b_xg`: Post-match expected goals (xG)
- **Pre-Match Quantitative Features** (Point-in-time friendly):
  - `team_a_xg_prematch`, `team_b_xg_prematch`: Pre-match model xG expectation
  - `pre_match_home_ppg`, `pre_match_away_ppg`: Points per game prior to kickoff
  - `btts_potential`, `o25_potential`: Pre-match rate projections

---

## 5. THE CRITICAL FORENSIC AUDIT: BTTS ODDS PROVENANCE

### 5.1 What Public Documentation Proves (`DOCUMENTED`)
1. The fields `odds_btts_yes` and `odds_btts_no` exist in both `/league-matches` and `/match` JSON responses.
2. In the `/match` endpoint example for match `579101` (Sheffield United vs Burnley, 2019-11-02):
   ```json
   "odds_btts_yes": 2,
   "odds_btts_no": 1.69
   ```
   Expressed as European decimal odds ($2.00$ and $1.69$).
   - Implied probabilities: $1 / 2.00 = 50.0\%$, $1 / 1.69 = 59.17\%$.
   - Implied total overround: $50.0\% + 59.17\% = 109.17\%$ (market margin $\approx 9.17\%$).

### 5.2 What Public Documentation Does NOT Prove (`UNKNOWN / UNVERIFIED`)
1. **Bookmaker Identity**: **UNKNOWN**.
   - FootyStats documentation nowhere declares which bookmaker supplies `odds_btts_yes` or `odds_btts_no`.
   - Is it Bet365? Pinnacle? A soft retail consensus? An internal FootyStats composite average?
   - In `/match`, an `odds_comparison` object exists for "FT Result" listing soft bookmakers (BetFred, 10Bet, BetVictor, TitanBet, Planetwin365). However, no breakdown is given for BTTS.
2. **Timestamp Semantics**: **UNKNOWN**.
   - Are these odds Opening lines (released days before)?
   - Are they Closing lines (at kickoff)?
   - Are they captured at an arbitrary snapshot (e.g. 1 hour before kickoff)?
   - There is no `odds_recorded_at` or `odds_timestamp` field documented on the match object.
3. **Missingness in Bulk Responses**:
   - In the official documentation example for `/league-matches` (page 1, match ID `101684`):
     ```json
     "odds_btts_yes": 0,
     "odds_btts_no": 0
     ```
     Values of `0` indicate missing or unrecorded odds for that particular fixture or league tier.

### 5.3 Forensic Impact on HandicapLab Invariants
HandicapLab's core governance rules mandate:
> **Single Source of Truth**: Wajib menggunakan `API-Football` untuk data fixture/statistik dan `OddsPAPI` untuk odds.  
> **Bookmaker Hierarchy**: Wajib menggunakan **Pinnacle** sebagai acuan utama dan ground truth untuk perhitungan Closing Line Value (CLV).  
> **CLV over ROI**: Evaluasi keberhasilan model diprioritaskan pada kemampuannya mengalahkan Closing Line Value, bukan sekadar hit rate hari ini.

**Conclusion:** FootyStats BTTS odds **CANNOT** be classified as Closing Line Value (CLV) benchmark odds. They must be treated strictly as **secondary market references** or **exploratory proxy odds** until post-subscription cross-referencing against OddsPapi/Pinnacle determines their exact margin, identity, and timestamp offset.

---

## 6. HISTORICAL DEPTH & LEAGUE COVERAGE

| Region / Competition | FootyStats Historical Depth | League Selection Tier (Hobby) | HandicapLab Status |
|---|---|---|---|
| **English Premier League** | 2006/07 – Present (~18 seasons) | Tier 1 (Included in 50) | Top Priority |
| **English Championship** | 2010/11 – Present (~14 seasons) | Tier 1 (Included in 50) | Top Priority |
| **Spanish La Liga** | 2008/09 – Present (~16 seasons) | Tier 1 (Included in 50) | Top Priority |
| **Italian Serie A** | 2009/10 – Present (~15 seasons) | Tier 1 (Included in 50) | Top Priority |
| **German Bundesliga** | 2009/10 – Present (~15 seasons) | Tier 1 (Included in 50) | Top Priority |
| **French Ligue 1** | 2010/11 – Present (~14 seasons) | Tier 1 (Included in 50) | Top Priority |
| **Dutch Eredivisie** | 2012/13 – Present (~12 seasons) | Tier 1 (Included in 50) | Tier 2 Whitelist |
| **Japanese J1 League** | 2014 – Present (~10 seasons) | Tier 1 (Included in 50) | Asian Whitelist |
| **Korean K-League 1** | 2015 – Present (~9 seasons) | Tier 1 (Included in 50) | Asian Whitelist |
| **Indonesian Liga 1** | 2017 – Present (~7 seasons) | Tier 1 (Included in 50) | Special Whitelist |

**Audit Finding:** 50 leagues on the Hobby plan easily covers all 10 HandicapLab whitelisted leagues with 40 slots remaining for expansion (e.g. Scottish Premiership, Portuguese Primeira Liga, Belgian Pro League, 2. Bundesliga, Segunda Division).

---

## 7. DATA INTEGRITY & FUTURE LEAKAGE ASSESSMENT

Under HandicapLab's strict research governance:
> **No Future Leakage**: Tidak boleh ada feature yang berasal dari data dengan timestamp $\ge$ kickoff pertandingan yang diprediksi.

### Leakage Audit of FootyStats Match Payload:
1. **SAFE (Pre-match features)**:
   - `date_unix` (Kickoff)
   - `team_a_xg_prematch`, `team_b_xg_prematch` (Point-in-time pre-match ratings)
   - `pre_match_home_ppg`, `pre_match_away_ppg` (Rolling form prior to match)
   - `btts_potential`, `o25_potential` (Pre-match mathematical potentials)
2. **POTENTIAL LEAKAGE HAZARD (Post-match features)**:
   - `team_a_xg`, `team_b_xg` (Post-match actual xG)
   - `team_a_shots`, `team_b_shots`, `team_a_possession` (In-game metrics)
   - `HTGoalCount`, `ht_goals_team_a` (Half-time metrics)
   - `winningTeam`, `homeGoalCount`, `awayGoalCount` (Full-time results)
   - `btts` (Settlement target)

**Ingestion Rule for Feature Store:**
Any pipeline ingesting FootyStats must enforce a strict schema bifurcation:
- **`raw_match_results`**: Stores actual scores and in-game statistics for model evaluation and target generation ($Y_{\text{btts}}$).
- **`prematch_features`**: Stores ONLY fields with explicit pre-match provenance or features computed strictly from $T < T_{\text{kickoff}}$ historical matches.

---

## 8. TRI-PROVIDER COMPARATIVE ARCHITECTURE

HandicapLab's data provider architecture with FootyStats positioned in its proper role:

```text
                               ┌──────────────────────────────────────────────┐
                               │           SALMO DECISION OS (UI)             │
                               │  Consumer-Facing Market Opportunity Engine   │
                               └──────────────────────┬───────────────────────┘
                                                      │
                                                      │ Consume Verified Models & Signals
                                                      ▼
 ┌─────────────────────────────────────────────────────────────────────────────────────────────┐
 │                                HANDICAPLAB RESEARCH ENGINE                                  │
 │                                                                                             │
 │   ┌──────────────────────┐      ┌──────────────────────┐      ┌──────────────────────┐      │
 │   │     AH Engine        │      │     BTTS Engine      │      │      OU Engine       │      │
 │   │ (Dixon-Coles Model A)│      │(SPEC-MODEL-BTTS-v1.0)│      │(Bivariate / Poisson) │      │
 │   └──────────┬───────────┘      └──────────┬───────────┘      └──────────┬───────────┘      │
 │              │                             │                             │                  │
 │              └─────────────────────────────┼─────────────────────────────┘                  │
 │                                            │                                                │
 │                                            ▼                                                │
 │                       ┌──────────────────────────────────────────┐                          │
 │                       │   UNIFIED CANONICAL DATA REPOSITORY      │                          │
 │                       │  (Normalized Entities, Dates, Match IDs) │                          │
 │                       └────────────────────┬─────────────────────┘                          │
 └────────────────────────────────────────────┼────────────────────────────────────────────────┘
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    ▼                         ▼                         ▼
        ┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────────┐
        │     API-FOOTBALL      │ │       ODDSPAPI        │ │      FOOTYSTATS       │
        │  (Primary Fixtures)   │ │  (Market Truth/CLV)   │ │ (Stats & BTTS Proxy)  │
        ├───────────────────────┤ ├───────────────────────┤ ├───────────────────────┤
        │ • Official Fixture ID │ │ • Sharp Bookmaker Odds│ │ • Bulk Season Sync    │
        │ • Lineups & Rosters   │ │   (Pinnacle, SBOBET)  │   (380 matches/req)     │
        │ • Live Event Tracking │ │ • Closing Line Value  │ │ • Detailed Match Stats│
        │ • Real-Time Webhooks  │ │   (CLV Ground Truth)  │   (Corners, Shots, Cards)│
        │ • Quota: Conservative │ │ • Multiple AH Lines   │ │ • Historical BTTS Odds│
        │   (100–7,500 req/day) │ │ • Timestamp Audit     │   (Proxy / Evaluation)  │
        │                       │ │ • High Unit Cost      │ │ • Hobby: £29.99/mo    │
        └───────────────────────┘ └───────────────────────┘ └───────────────────────┘
```

---

## 9. ECONOMIC FEASIBILITY & ROI ANALYSIS

### 9.1 Cost Comparison Across Strategy Options

| Option | Architecture | Monthly Cost | Historical BTTS Odds? | Historical AH CLV? | Bulk Efficiency |
|---|---|---|---|---|---|
| **Option A (Current)** | API-Football Free + OddsPapi Sandbox | £0 / $0 | ❌ No (0 rows) | ⚠️ Partial (25% CLV) | Low |
| **Option B (All-in OddsPapi)**| API-Football + OddsPapi Enterprise Historical | ~$300–$500/mo | ✅ Yes (Pinnacle) | ✅ Yes (Pinnacle) | High |
| **Option C (FootyStats Heavy)**| FootyStats Serious (£69.99) | £69.99/mo | ⚠️ Yes (Unverified bookie)| ❌ No AH lines | High |
| **Option D (Pragmatic Tri-Provider)**| **FootyStats Hobby (£29.99) + API-Football Free/Starter + OddsPapi PayG** | **~£30–£50/mo** | **✅ Yes (Proxy)** | **✅ Yes (Pinnacle live)**| **Optimal** |

### 9.2 Financial Assessment
At **£29.99/month (approx. \$38 USD)**, FootyStats Hobby costs less than 1 hour of quantitative engineering time. It immediately solves the historical data starvation problem for Both Teams To Score (BTTS) and provides deep match statistics for 50 leagues.

However, committing to an annual plan (£239.88) **prior to running live forensic tests on odds provenance is strictly prohibited**. A single monthly subscription is sufficient to backfill and audit all target leagues.

---

## 10. RISKS & UNKNOWNS AUDIT

| Risk ID | Description | Severity | Probability | Mitigation Strategy |
|---|---|---|---|---|
| **R-FS-1** | `odds_btts_yes`/`no` are from an obscure retail soft book with high vig ($>8\%$). | Medium | High | De-vig odds using power or Shin method; compare against Pinnacle in Gate FS-3. |
| **R-FS-2** | Historical odds missing for older seasons ($<2019$). | High | Medium | Check coverage across 2015–2025 in Gate FS-2 before model backtest. |
| **R-FS-3** | Team naming discrepancies prevent deterministic linkage to API-Football fixture IDs. | Medium | High | Extend `normalizeTeam` dictionary in `src/lib/warehouse/normalizer.ts`. |
| **R-FS-4** | FootyStats disables bulk pagination or alters JSON schema without deprecation window. | Low | Low | Wrap responses in strict Zod schemas with fail-closed behavior. |
| **R-FS-5** | Asian Handicap odds absent or single-line only (`odds_asian_handicap: -0.25` without over/under split). | Low | Certain | Accept that FootyStats is NOT an AH odds provider. AH remains on OddsPapi. |

---

## 11. GATE 0 RESULT & RECOMMENDATION

### Gate 0 Verification Outcome:
- **Documentation Completeness**: **PASS** (Endpoints, parameters, rate limits, and JSON schemas verified).
- **Economic Viability**: **PASS** (£29.99/mo Hobby tier provides 1,800 req/hr and 50 leagues).
- **Request Efficiency**: **PASS** (1 request per 380-match season).
- **BTTS Data Feasibility**: **PASS** (`odds_btts_yes` and `odds_btts_no` are documented fields).
- **CLV Ground Truth Claim**: **REJECTED** (Bookmaker identity and timestamps are undocumented; prohibited from CLV status).

### Final Recommendation:
1. **Proceed with 1-Month Hobby Subscription (£29.99)** strictly as a controlled research experiment.
2. **Execute Controlled Verification Plan (Gates FS-1 to FS-4)** immediately upon receiving API credentials.
3. **Do not modify production pipelines or Salmo consumer interfaces** until Gate FS-3 (Odds Provenance Audit) passes.

