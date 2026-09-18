# FOOTYSTATS VS API-FOOTBALL VS ODDSPAPI: DATA SOURCE CAPABILITY MATRIX
### Multi-Provider Benchmark and FootyStats Field-by-Field Forensic Audit

**Document ID:** `MATRIX-FOOTYSTATS-EVAL-v1.0`  
**Date:** September 16, 2026  
**Auditor:** Quantitative Research & Architecture Lead  
**Scope:** FootyStats (Hobby £29.99/mo) vs API-Football (Standard/Pro) vs OddsPapi (v4 Native)

---

## 1. THIRTEEN-CAPABILITY COMPARISON MATRIX

The following matrix compares the three candidate data providers across all essential dimensions required by HandicapLab's research engine and Salmo's market decision engine:

| # | Capability Dimension | API-Football (`api-sports.io`) | OddsPapi (`oddspapi.io`) | FootyStats Hobby (`footystats.org`) | Evaluation & Synthesis |
|---|---|---|---|---|---|
| **1** | **Base Cost** | Free: €0 (100 req/day)<br>Starter: €19/mo (1k req/day)<br>Pro: €29/mo (7.5k req/day) | Free: Sandbox/Trial<br>PayG / Sub: \$19–\$99/mo | **Hobby: £29.99/mo** (~$38)<br>Serious: £69.99/mo<br>Everything: £389.99/mo | FootyStats Hobby is virtually identical in cost to API-Football Pro, but offers unlimited monthly requests at 1,800/hr. |
| **2** | **Request Quota & Rate Limits** | 10 req/min, hard daily ceiling (100 or 7,500). Overages rejected or billed. | Rate-limited by tier, granular per-market calls. | **1,800 req/hour** (30 req/min). No published daily/monthly hard cap. | **FootyStats wins on rate limit & volume**: 1,800/hr is 25× higher than API-Football's per-minute throughput. |
| **3** | **League Coverage** | 1,000+ leagues worldwide. Global coverage. | Global sharp books, focus on major and secondary leagues. | **Pick 50 Leagues** on Hobby.<br>(150 on Serious, 1,500+ on Everything). | **50 leagues is optimal**: HandicapLab whitelists only 10 leagues. Excess leagues create noise. |
| **4** | **Historical Depth** | 2010–Present (~14 seasons) across Top 5 European leagues. | Live & recent pre-match; historical odds require specific endpoints/packages. | **2006/07–Present** (18 seasons EPL, 14–16 seasons major Europe). | **FootyStats provides superior historical depth** for match outcomes and statistics. |
| **5** | **Match Statistics (In-Game)** | Comprehensive: Shots, On-Target, xG, Fouls, Possession, Corners, Passes. | None (Pure odds data provider). | Comprehensive: Shots, On-Target, xG, Possession, Corners, Cards, Fouls. | **Tie between API-Football and FootyStats**. Both supply deep in-match counts. |
| **6** | **Pre-Match Advanced Features** | Requires custom computation from historical fixtures. | None. | Native pre-match features: `team_a_xg_prematch`, `pre_match_home_ppg`, `btts_potential`. | **FootyStats provides ready-made pre-match indicators**, reducing feature store compute. |
| **7** | **1X2 (Moneyline) Odds** | Available via `/odds` endpoint (separated by bookmaker, snapshot at fetch). | Comprehensive 1X2 odds across sharp and soft bookmakers. | Available directly embedded in `/league-matches` (`odds_ft_1`, `odds_ft_x`, `odds_ft_2`). | FootyStats embeds 1X2 in match payload; OddsPapi provides multi-bookmaker spreads. |
| **8** | **Asian Handicap (AH) Odds** | Historical AH odds sparsely populated across low tiers. | **EXCELLENT (Canonical Benchmark)**: Pinnacle, SBOBET, full quarter-line coverage. | **POOR / MINIMAL**: Only single flat field `odds_asian_handicap: -0.25` documented; no dual-line juice. | **OddsPapi is the undisputed sovereign for Asian Handicap**. FootyStats CANNOT replace OddsPapi for AH. |
| **9** | **Over/Under (OU) Odds** | Available via `/odds` (totals market). | Comprehensive totals lines across bookmakers. | Embedded flat fields: `odds_ft_over05` to `odds_ft_over45`, `odds_ft_under05` to `45`. | FootyStats provides complete flat totals array without extra API calls. |
| **10** | **BTTS Odds** | Available via `/odds` (market 114), but requires extra calls per match. | Available live (`btts` market 114). Historical backfill is expensive. | **EMBEDDED**: `odds_btts_yes` and `odds_btts_no` included directly in bulk match payload. | **FootyStats is uniquely positioned for BTTS backfill** (380 matches with BTTS odds in 1 call). |
| **11** | **Bookmaker Identity Transparency** | **VERIFIED**: Bookmaker IDs explicitly declared (Bet365, Pinnacle, etc.). | **VERIFIED**: Bookmaker IDs explicitly declared (`pinnacle`, `circasports`, `sbobet`). | **UNKNOWN / NOT DOCUMENTED**: Flat odds fields omit bookmaker name. | **Critical deficiency in FootyStats**: Bookmaker identity is unstated. |
| **12** | **Timestamp Semantics** | Captured at fetch time; historical odds timestamped. | High-frequency snapshots; opening and closing lines identifiable. | **UNKNOWN / NOT DOCUMENTED**: No `odds_recorded_at` field. Likely pre-match snapshot. | **Critical deficiency in FootyStats**: Cannot distinguish opening from closing lines without audit. |
| **13** | **Suitability for Backtesting / CLV** | Moderate (Good for score models, moderate for odds). | **HIGHEST**: Ground truth for Closing Line Value (CLV) against Pinnacle. | **MODERATE FOR TARGETS / PROXY ONLY**: Excellent for statistical models; forbidden for CLV. | **Role clear**: FootyStats = Data & Features; OddsPapi = Market Truth & CLV. |

---

## 2. FOOTYSTATS FIELD-BY-FIELD FORENSIC AUDIT

This table classifies every key field identified in the FootyStats API public documentation (`/league-matches`, `/match`, and `/league-season`) according to rigorous quantitative data governance standards:

* **`DOCUMENTED`**: Explicitly defined with clear types and descriptions in official docs.
* **`NOT DOCUMENTED`**: Field appears in example responses or legacy code but lacks official documentation.
* **`UNCLEAR`**: Field is documented, but its calculation methodology, unit, or timing is ambiguous.
* **`REQUIRES API TEST`**: Field presence and validity cannot be confirmed without an authenticated query.

| Field Name | Endpoint(s) | Data Type | Classification | Quantitative Rigor & Governance Notes |
|---|---|---|---|---|
| `id` | `/league-matches`, `/match` | Integer | `DOCUMENTED` | FootyStats unique match identifier. Must map to canonical HandicapLab fixture ID. |
| `homeID`, `awayID` | `/league-matches`, `/match` | Integer | `DOCUMENTED` | FootyStats team identifiers. Requires team entity mapping table. |
| `home_name`, `away_name`| `/league-matches`, `/match` | String | `DOCUMENTED` | Human-readable team names. Clean, standard English spelling. |
| `competition_id` | `/league-matches`, `/match` | Integer | `DOCUMENTED` | Numeric competition code. Matches FootyStats league registry. |
| `season` | `/league-matches`, `/match` | String | `DOCUMENTED` | Format `"2019/2020"` or `"2023"`. Clean chronological separator. |
| `date_unix` | `/league-matches`, `/match` | Integer | `DOCUMENTED` | UTC unix timestamp of scheduled kickoff. Essential for point-in-time filtering. |
| `status` | `/league-matches`, `/match` | String | `DOCUMENTED` | `"complete"`, `"incomplete"`, `"suspended"`. Critical for filtering unplayed matches. |
| `homeGoalCount`, `awayGoalCount` | `/league-matches`, `/match` | Integer | `DOCUMENTED` | Full-time score. Ground truth target for goal difference, OU, and BTTS. |
| `totalGoalCount` | `/league-matches`, `/match` | Integer | `DOCUMENTED` | Sum of home and away goals. Redundant validation check against home + away. |
| `HTGoalCount` | `/league-matches`, `/match` | Integer | `DOCUMENTED` | Half-time total goals. Useful for half-time goal model calibration. |
| `ht_goals_team_a`, `ht_goals_team_b` | `/league-matches`, `/match` | Integer | `DOCUMENTED` | Individual team half-time scores. |
| `winningTeam` | `/league-matches`, `/match` | Integer | `DOCUMENTED` | ID of winning team, or `-1` for draw. Clean 1X2 target verification. |
| `btts` | `/league-matches`, `/match` | Boolean / Int | `DOCUMENTED` | Ground truth binary indicator ($H \ge 1 \land A \ge 1$). Direct model target. |
| `team_a_shots`, `team_b_shots` | `/league-matches`, `/match` | Integer | `DOCUMENTED` | Post-match total shot count. In-match feature only; DO NOT use pre-match. |
| `team_a_shotsOnTarget`, `team_b_shotsOnTarget` | `/league-matches`, `/match` | Integer | `DOCUMENTED` | Shots on target. Vital for calculating rolling attacking efficiency. |
| `team_a_possession`, `team_b_possession` | `/league-matches`, `/match` | Integer | `DOCUMENTED` | Ball possession percentage (sums to 100). |
| `team_a_corners`, `team_b_corners` | `/league-matches`, `/match` | Integer | `DOCUMENTED` | Corner kick totals. Useful for pressure metrics and corner models. |
| `team_a_fouls`, `team_b_fouls` | `/league-matches`, `/match` | Integer | `DOCUMENTED` | Fouls committed. |
| `team_a_xg`, `team_b_xg` | `/league-matches`, `/match` | Float | `UNCLEAR` | Post-match actual xG. Calculation methodology is proprietary to FootyStats/TheSports. |
| `team_a_xg_prematch`, `team_b_xg_prematch` | `/match` | Float | `UNCLEAR` | Pre-match expected xG. Point-in-time safe, but black-box formula. |
| `pre_match_home_ppg`, `pre_match_away_ppg` | `/match` | Float | `DOCUMENTED` | Pre-match points-per-game form. Verify whether it is home-specific or overall. |
| `btts_potential` | `/league-matches`, `/match` | Float / Int | `UNCLEAR` | FootyStats proprietary pre-match BTTS percentage. Black box; ignore for quantitative modeling. |
| `odds_ft_1`, `odds_ft_x`, `odds_ft_2` | `/league-matches`, `/match` | Float | `DOCUMENTED` | 1X2 Decimal Odds. Useful for baseline market margin checks. |
| `odds_btts_yes`, `odds_btts_no` | `/league-matches`, `/match` | Float | `DOCUMENTED` | **BTTS Decimal Odds**. Key research focus. Missingness observed in some docs (`0`). |
| `id_btts_yes`, `id_btts_no` | `/league-matches` | Integer | `NOT DOCUMENTED` | Appears in JSON response. Likely internal ID or legacy bookmaker mapping. |
| `id_bet365` | `/league-matches` | Integer | `NOT DOCUMENTED` | Appears in JSON response. Suggests Bet365 might be a primary odds source. |
| `odds_comparison` | `/match` | Object | `UNCLEAR` | Present only in single-match endpoint `/match`. Shows 5 soft bookmakers for 1X2. |
| `odds_asian_handicap` | `/league-matches` | Float | `UNCLEAR` | Appears as single handicap float (e.g. `-0.25`). No home/away odds attached. |
| `odds_over_under_25` | `/league-matches` | Float | `UNCLEAR` | Present in legacy schema. Modern `/match` uses explicit `odds_ft_over25` and `under25`. |
| `lineups` | `/match` | Object | `DOCUMENTED` | Starting XI and player IDs. Present in `/match`, absent in `/league-matches`. |
| `refereeID` | `/league-matches`, `/match` | Integer | `DOCUMENTED` | Referee identifier. Useful for referee card/penalty bias models. |
| `max_time` | `/league-season` | Integer | `DOCUMENTED` | Point-in-time snapshot timestamp parameter for standings and team stats. |

---

## 3. SUMMARY ASSESSMENT

1. **Match Results & Physical Stats**: FootyStats receives a **HIGH CONFIDENCE (PASS)** rating. Scores, dates, shots, corners, cards, and fouls are clean, well-documented, and bulk-accessible.
2. **Pre-Match Proprietary Features (`potential`)**: Receives a **USE WITH CAUTION (QUARANTINE)** rating. While they do not leak future information, they are black-box outputs of FootyStats' internal algorithms and should not be used as primary training features in HandicapLab's statistical models.
3. **BTTS Odds**: Receives a **PASS FOR EXPLORATION / FAIL FOR CLV GROUND TRUTH** rating. The presence of `odds_btts_yes` and `odds_btts_no` in bulk payloads makes large-scale preliminary BTTS calibration testing possible, but absence of bookmaker identity and exact timestamps requires that all market validation be confirmed against OddsPapi.

