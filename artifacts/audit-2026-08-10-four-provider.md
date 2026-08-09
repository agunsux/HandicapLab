# HANDICAPLAB — 4-PROVIDER PRODUCTION DATA & PREDICTION ACCURACY AUDIT
**Date:** 2026-08-10 | **Auditor:** automated audit (read-only) | **Git:** main @ be1e73c (clean tree)

Method: read-only PostgREST queries against production Supabase (`rgkrfzxipkrwqccfuqfq`), source-code
forensics, and minimal metadata/live probes (API-Football: 3 of 100 daily requests used; no other
provider quota consumed).

---

## PHASE 0 — GIT / DATABASE SAFETY
- Branch `main`, clean working tree (only untracked `.vscode/extensions.json`), no uncommitted destructive changes.
- No data modified: all DB access was SELECT-only. No migrations run.

## PHASE 1 — FOUR PROVIDER HEALTH AUDIT (verified by live probe 2026-08-10)

| Provider | Actual identity | Base URL | Auth | Free plan | Quota | Current key status | Code integration | Production status |
|---|---|---|---|---|---|---|---|---|
| API-Football | API-Sports (api-sports.io) | https://v3.football.api-sports.io | `x-apisports-key` header | Free, active to 2027-06-21 | 100 req/day, 10/min | **VALID** (32-char key, account `agun`) | apiFootball.ts ×2, fixtureDiscovery, leagueRegistry, quotaManager | **ACTIVE** — 481/481 logged calls HTTP 200 (Jul 28–Aug 9); discovery cron runs daily 00:50 UTC |
| "OddsPAPI" (code config) | **The Odds API** (the-odds-api.com) — config.ts `oddsPapi.baseUrl = https://api.the-odds-api.com/v4` | the-odds-api.com/v4 | `apiKey` query | 500 req/mo | n/a | **INVALID — HTTP 401 INVALID_KEY** (key `10db…bd17` rejected) | sharpOdds.ts → oddsApiClient; OddsPapiProvider | **INACTIVE** — 0 logged calls ever; budget counter untouched (0/250) |
| OddsPapi.io | OddsPapi (oddspapi.io) | api.oddspapi.io/v4, v5.oddspapi.io | `apiKey` query | docs: monthly allowance, `/v4/account` free | n/a | **INVALID — HTTP 401 INVALID_API_KEY** (same key, both hosts) | none (host not used in code) | **INACTIVE / INCOMPATIBLE** |
| TheStatsAPI | TheStatsAPI (thestatsapi.com) | api.thestatsapi.com/v1 | `apiKey` query | unknown | n/a | **PLACEHOLDER** — value is literal `your…here` (26 chars) | theStatsProvider.ts, ProviderOrchestrator stage 1-2 | **INACTIVE** — 14 logged calls, all 404/500 |
| Football-Data.org | football-data.org | api.football-data.org/v4 | `X-Auth-Token` | free tier (10/min) | n/a | **PLACEHOLDER** — `your…here` (27 chars); authed calls return 400 invalid token | FootballDataProvider (DATA_PROVIDER=football-data path) | **INACTIVE** — 0 production calls |
| football-data.co.uk (CSV, non-API) | Football-Data.co.uk | local CSVs `./data/EPL/*.csv` | n/a | n/a | n/a | n/a | raw importer (raw_import_jobs, provider=`Football-Data.co.uk`, E0.csv) | **HISTORICAL SOURCE ONLY** — 2,282 rows EPL 2020-21→2025-26 with real results + odds |

**Two names, one provider:** The project's "OddsPAPI" integration is configured against **The Odds
API** host, and its key is valid for neither The Odds API nor OddsPapi.io. Documented as INACTIVE.

## PHASE 2 — PROVIDER COVERAGE MATRIX (enumerated, not inferred)

**API-Football (live, verified):** 32 leagues registered via provider sync (Jul 28). Fixture fetches
logged for all 32 (13–15 calls each). Only 8 league labels actually present in `matches` (495 rows).
Top-whitelist leagues (EPL 39, La Liga 140, Serie A 135, Bundesliga 78, Ligue 1 61, Championship 218,
Eredivisie 88, J1 98, K League 83, Liga 1 Indonesia 262) all registered; **season_status = 'unknown'
for all 32; fixture_volume_7d = 0 for all**.

| Provider | Competitions available | Active | Upcoming fixtures | Historical results | Odds |
|---|---|---|---|---|---|
| API-Football | 32 registered (≈1,000s available) | 0 confirmed (all 'unknown') | yes (daily discovery; 3 genuinely future matches in DB) | **NO** (no historical fetch wired) | NO (no odds endpoint used) |
| TheStatsAPI | 0 (dead) | – | – | – | – |
| Football-Data.org | 189 listed unauthenticated; **0 usable** (invalid token) | – | – | – | – |
| OddsPapi / The Odds API | 0 (key invalid) | – | – | – | – |
| football-data.co.uk CSV | 1 (EPL) | 6 seasons complete | – | YES (2,282 matches) | YES (home/draw/away, O/U 2.5) |

## PHASE 3 — MASTER HANDICAPLAB COVERAGE

```
Countries:   ~20 (via league_efficiency countries; matches table: 8 league labels)
Competitions: 32 registered (API-Football), 8 with fixtures in DB, 1 with historical data (EPL CSV)
Active competitions: 0 (all season_status unknown)
Upcoming fixtures: 11 DB rows (8 stale/past kickoff, 3 future: Aug 12–14)
Historical results: 1 competition (EPL, 6 seasons, CSV)
Usable odds: 0 from providers; EPL CSV has historical odds (1X2 + O/U 2.5)
Modelable: 0
```

- **Tier A:** none (EPL CSV has results+odds but is not wired into `matches`/model — `matches` has 0 finished rows with goals).
- **Tier B:** none. **Tier C:** EPL, Ligue 1 (fixtures only). **Tier D:** 30 remaining registered leagues.

## PHASE 4 — HISTORICAL DATA AUDIT (production DB)

| Layer | Rows | Earliest | Latest | Competitions | Complete? |
|---|---|---|---|---|---|
| matches | 495 | 2026-06-29 | 2026-08-14 | 8 | **NO — 0 rows with goals; 112 'finished' have NULL scores** |
| raw_matches (staging) | 2,282 | 2020-21 | 2025-26 | EPL | YES (6 full seasons, results + odds) |
| odds_snapshots | 1,040 | 2026-08-04 22:19 | 22:51 (single 32-min run) | EPL/L1 labels | **NO — SYNTHETIC** (4 repeated odds tuples, 100% 'pinnacle') |
| predictions | 490 | 2026-08-04 22:20 | 2026-08-05 10:13 | EPL/L1 | **NO — SYNTHETIC** (5 distinct probability vectors) |
| prediction_ledger | 600 | 2026-08-04 | – | – | **NO — 600/600 SKIP (MISSING_ODDS), pending** |
| prediction_ledger_v3 | 4 | 2026-08-05 | 2026-08-06 | – | **NO — labelled "Real test run"** (EV +21.8%…+45.9%) |
| daily_picks | 1,224 | 2026-08-04 01:20 | 22:52 | – | NO — 100% PENDING, verdicts LEWATI/PANTAU only |
| paper_trades | 0 | – | – | – | NO |
| settlements / settlement_results / prediction_settlements_v3 | 0 / 0 / 0 | – | – | – | **NO — settlement never ran** |
| pre_match_snapshots / closing_odds / clv_results / signals / market_edges | 0 | – | – | – | NO |
| warehouse (wh_fixtures / wh_predictions / wh_closing_lines) | 1 / 0 / 0 | – | – | – | NO |
| provider_logs | 495 | 2026-07-28 | 2026-08-09 | – | OK (apifootball 481×200; thestatsapi 14×fail) |
| track_record | 1 | – | 2026-08-02 | – | NO — total_picks 0, all metrics zero |

Completeness: **result completeness = 0/495 = 0%** · odds completeness (real) = 0% · prediction coverage = 100% of matches got (synthetic) predictions; **0% settled**.

## PHASE 5–9 — PREDICTION ACCURACY / CALIBRATION / EV

- **Evaluation dataset cannot be constructed:** zero settled outcomes, zero paper trades, zero finished matches with scores. Brier, Log Loss, ECE, ROI, CLV, win rate: **NOT COMPUTABLE (N=0)**.
- **Calibration table (Phase 7):** impossible — and the raw material is degenerate: only 5 distinct probability values across 490 predictions (0.2874×116, 0.5561×116, 0.2911×6, 0.5304×6, NULL×246), identical for every fixture.
- **EV (Phase 8):** predictions EV range +0.1%…+1.9% (synthetic); all ledger entries SKIP.
- **Phase 9 — extreme EV forensic (4 rows, prediction_ledger_v3, EV +21.8%, +29.2%, +45.9%):**
  1. probability source: constant/synthetic vector (identical 0.60/0.6152/0.6945 across fixtures)
  2. feature source: defaults (see Phase 14)
  3. bookmaker: none real — odds 2.10 hardcoded
  4. odds timestamp: 2026-08-04 (synthetic)
  5-7. market ML/home, model `prematch-v1`/`prematch-v2-test`, explainability labelled **"Real test run"**
  8. calibration: registry empty, Platt defaults (1.02, -0.01) — never trained
  9. sample size: 1
  10. leakage: 308/490 predictions generated **after** kickoff
  11. actual result: never settled
  → **Verdict: model overconfidence + bad odds mapping + placeholder features; not genuine opportunities.**

## PHASE 10 — CURRENT MATCHES
| Window | Matches | With odds | With prediction | With EV |
|---|---|---|---|---|
| Live (DB / provider) | 0 / **45 live available via API-Football** | 0 | 0 | 0 |
| Next 24h | 0 real (8 stale rows, kickoff in past, mislabelled "Ligue 1") | 0 | 0 | 0 |
| Next 48h | 0 real | 0 | 0 | 0 |
| Next 7d | 3 (Aug 12–14; all mislabelled "Ligue 1" — EPL teams) | 0 (synthetic snapshots only) | 0 (all 490 predictions reference archived matches) | 0 |

## PHASE 11–12 — BOOKMAKER & MARKET COVERAGE
| Bookmaker | ML | AH | O/U | BTTS | Competitions | Reliability |
|---|---|---|---|---|---|---|
| Pinnacle | SYNT | SYNT | SYNT | SYNT | all snapshots (1,040) | **FAKE** — same 4 tuples repeated; no provider call ever logged |
| Circa | NO | NO | NO | NO | 0 | config flag `enabled:false`; absent from bookmakers table |
| SBO/SBOBET | NO | NO | NO | NO | 0 | name in bookmakers table; zero data |
| Bet365 | partial | – | – | – | raw_odds (12 rows, 2 fixtures) | one-off probe |

Market coverage: ML 260 / AH 260 / OU 260 / BTTS 260 synthetic snapshots (100% from a test script) — **real provider coverage 0%**. `raw_odds` (12) contains the only real-looking odds (Bet365 + Pinnacle 1X2).

## PHASE 13 — DATA FRESHNESS
- Odds snapshots captured 2026-08-04 22:19–22:51 for matches kicking off Jul 25–Aug 14 → **odds for Jul 25–31 matches captured after kickoff (post-match)**.
- 308/490 predictions generated after kickoff.
- `data_age_ms` null throughout; no provider→ingest→DB→prediction latency trail exists (synthetic source).
- Stale data rate: 8/11 "upcoming" matches have kickoff in the past.

## PHASE 14 — MODEL INPUT FORENSIC AUDIT (buildMatchInput + extractors)
**Every inspected input is DEFAULT/SYNTHETIC** (verified against 490 predictions + code):
- `buildMatchInput` (src/lib/data/prediction/engine.ts:41): strengths 0.5/0.5, forms 0.5/0.5, xG 1.35/1.15, shots 12/10, SoT 4/3.5, last-5 goals 1.5/1.2 — **hardcoded constants for every fixture**
- FormExtractor → no finished matches → [] → neutral default 1.5; XgExtractor → 1.0/1.0/2.5 defaults; StrengthExtractor → ELO 1500/1500, delta 0
- injuries / lineups / venue / weather / H2H: not present in the prediction path
- odds: synthetic snapshots; `pickSelection` always returns 'home'/'over'
- calibration: Platt defaults (1.02, -0.01); calibration_registry empty
- verdict: **probability/EV numbers are deterministic functions of constants — no match-specific information reaches the model**

## PHASE 15–16 — WALK-FORWARD & STATISTICAL SIGNIFICANCE
- **Walk-forward: NOT POSSIBLE** (no settled outcomes). The user-facing `/api/backtest/run` instead **injects 5 mock matches and computes winRate/ROI/Brier/CLV from mock probabilities and `closingOdds = homeOdds * 0.98` (mock CLV drift)** — fabricated statistics, not validation.
- Statistical significance: **UNKNOWN — N=0 settled** for every metric; no 95% CIs computable.

## PHASE 17 — FOUR-PROVIDER RECONCILIATION
- Only API-Football data exists in `matches`; CSV EPL data in `raw_matches` (different seasons, no overlap). No second provider data to reconcile.
- `matches` carries no provider fixture IDs (API-Football IDs not stored) → match identity mapping to any other provider is not possible today.
- Team-name agreement EPL CSV vs API-Football: matches on common names (spot-checked); result agreement: N/A (no API-Football results stored).

## PHASE 18 — PRODUCTION DATA FLOW
| Stage | Real data? | Production code? | Mock/fallback? | Last run | Rows |
|---|---|---|---|---|---|
| API (API-Football) | YES | YES | no | 2026-08-09 00:50 UTC (daily) | 2 calls/day |
| Provider adapter / normalizer | YES (fixtures) | YES | – | Aug 9 | – |
| Supabase matches | PARTIAL | YES | – | Aug 4-5 (bulk) | 495 |
| Odds (OddsPAPI/The Odds API) | **NO — key invalid; stage-2 cron also queries non-existent `fixtures` table** | YES | – | never | 0 |
| Feature builder | **NO — all defaults** | YES | – | Aug 4-5 | 490 preds |
| Prediction engine | NO (constant inputs) | YES | – | Aug 4-5 | 490 |
| Calibration | NO (defaults) | YES | – | never trained | 0 |
| EV | NO (synthetic odds) | YES | – | Aug 4-5 | – |
| Ledger | NO | YES | – | Aug 4-5 | 600 SKIP |
| API → frontend | **PARTIAL — serves v3 test rows (EV +45.9%) & synthetic daily_picks; backtest fabricates mock** | YES | YES | – | 4 / 1,224 / mock |
| Settlement | **NO — runStage5Settlement is an empty stub; update-results needs scores that never arrive** | YES (stub) | – | never | 0 |

## PHASE 19 — NO MOCK DATA GATE → **PRODUCTION DATA INTEGRITY = FAIL**
Mock/synthetic data can reach production surfaces:
1. `/api/backtest/run` → BacktestService silently substitutes 5 mock matches + mock probabilities + mock CLV (×0.98)
2. `/app/matches` → falls back to `mockMatchesAndPredictions` (shows "offline sandbox predictions" banner) — triggered by current DB state
3. `/api/predictions` → serves `prediction_ledger_v3` test rows ("Real test run", EV +21.8%…+45.9%) and hardcoded fallback odds 2.5/3.0/2.8
4. `/api/value-intelligence/bets` → serves 1,224 daily_picks built on synthetic odds, with fabricated `clvProjection = edge × 0.65`
5. `AccuracyStats` component hardcodes mock accuracy claims (68.55% 1X2) — not rendered in current app pages
6. Production `odds_snapshots` (1,040) were written by `src/scripts/validate-pipeline-2024.ts` (hardcoded odds) + `runPredictionCron`

---

## PHASE 20 — FINAL SCORECARD

| Area | Status | Evidence |
|---|---|---|
| API-Football | **PASS** | key valid; 481/481 HTTP 200; live probe 45 live fixtures; 3/100 quota today |
| OddsPAPI | **FAIL** | key 401 on both the-odds-api.com and oddspapi.io; 0 calls |
| TheStatsAPI | **FAIL** | placeholder key; 14/14 calls 404/500 |
| Football-Data.org | **FAIL** | placeholder key; authed requests 400 |
| Provider quota safety | **PASS*** | QuotaManager + provider_logs persistence work; *reservation rows double-counted; API-Football logged 108 INFO rows on Jul 29 vs 100/day limit |
| Historical data | **FAIL** | 0 settled results; canonical `matches` has 0 scores; only EPL CSV staging |
| Upcoming data | **FAIL** | 8/11 upcoming rows stale/past; wrong league labels; 3 real fixtures |
| Live ingestion | **FAIL** | 0 live in DB while provider offers 45; no live wiring |
| ML | **FAIL** | synthetic only |
| Asian Handicap | **FAIL** | synthetic only (2.1/1.8 fixed) |
| O/U | **FAIL** | synthetic only (1.9/1.9 fixed) |
| BTTS | **FAIL** | synthetic only (1.7/2.1 fixed) |
| Pinnacle | **FAIL** | name only; synthetic snapshots |
| Circa | **FAIL** | absent (config-disabled, not in bookmakers) |
| SBO | **FAIL** | name in table, zero data |
| Prediction calibration | **FAIL** | N=0; 5 distinct probability vectors; registry empty |
| EV validation | **FAIL** | EV from constant inputs + synthetic odds; test rows +45.9% |
| Leakage protection | **FAIL** | 308/490 predictions after kickoff; odds captured post-kickoff |
| Walk-forward validation | **FAIL** | impossible (N=0); backtest API fabricates mock results |
| Production data integrity | **FAIL** | mock fallback in UI + backtest; test data in ledger v3; synthetic odds in snapshots |

---

# FINAL EXECUTIVE REPORT

## 1. FOUR API STATUS
```
API-Football:   ACTIVE — real key, free plan (100/day), fixtures ingested daily, 100% success. Only working provider.
OddsPAPI:       INACTIVE — key invalid for BOTH api.the-odds-api.com (integration's actual host) and api.oddspapi.io.
                The project's "OddsPAPI" is configured against The Odds API. 0 calls ever made.
TheStatsAPI:    INACTIVE — placeholder key; every call 404/500.
Football-Data.org: INACTIVE — placeholder key; 0 production calls.
```
(Historical data note: the 2,282-row EPL dataset comes from football-data.co.uk CSVs, not any API.)

## 2. ACTUAL COVERAGE
```
Countries: ~20 registered · Competitions: 32 registered, 8 in DB · Active: 0 (all season_status unknown)
Upcoming matches: 3 real (Aug 12–14, one competition) · Historical matches: 2,282 (EPL only, CSV staging)
Matches with odds: 0 real (1,040 synthetic) · Modelable matches: 0
```

## 3. CURRENT MACHINE STATUS
```
Discovery: ON (daily 00:50 UTC, API-Football, works)
Odds ingestion: OFF (invalid key + stage-2 queries non-existent `fixtures` table)
Prediction engine: ON but OUTPUTS ARE SYNTHETIC (constant inputs → constant probabilities)
Settlement: OFF (empty stub; no scores ever stored)
Scheduler: OFF (worldwide-scheduler not in vercel.json; all adaptive_priority=1)
Frontend live data: YES but SYNTHETIC/MOCK (incl. mock backtest, "sandbox" fallback, test-ledger rows)
```

## 4. MODEL ACCURACY
```
N predictions (settled): 0 → Win rate: N/A · Brier: N/A · Log Loss: N/A · ECE: N/A · ROI: N/A · CLV: N/A · 95% CI: N/A
ML / AH / O/U / BTTS: no settled data for any market — accuracy is UNVERIFIED and currently UNVERIFIABLE.
```

## 5. EV QUALITY
> "When HandicapLab says EV +5%, +10%, +20%, does historical performance support that claim?"
**No.** EV is computed from (a) constant probability vectors identical across all fixtures, (b) synthetic
hardcoded odds, (c) never-settled selections. The only +20%+ EV records in the ledger are labelled
"Real test run". The EV buckets analysis (Phase 8) is not computable: every pick was skipped
(MISSING_ODDS) and zero trades were ever placed.

## 6. DATA QUALITY
```
Completeness: results 0%, real odds 0%, settlements 0%   Freshness: odds 32-min single burst; 8/11 upcoming stale
Provider agreement: not testable (single provider)        Duplicate rate: low (upserts) — but test rows repeat
Missing rate: 100% odds/CLV/closing lines                 Fallback rate: 100% (every model input is a default)
```

## 7. BIGGEST PROBLEMS (ranked)
1. **No real odds ingestion** — every odds key invalid; the only odds in DB are test-script synthetic values; `/api/cron/odds` also queries a non-existent `fixtures` table.
2. **Settlement never runs** — `runStage5Settlement` is a stub; `matches` contains 0 scores; 0 settled outcomes ⇒ accuracy cannot be measured.
3. **Synthetic predictions** — 5 distinct probability vectors for 490 predictions; every `buildMatchInput` feature hardcoded/default.
4. **Production DB polluted by test data** — 1,040 synthetic odds_snapshots + 600 SKIP ledger + 4 "Real test run" v3 rows written by validation scripts.
5. **Leakage** — 308/490 predictions generated after kickoff; odds captured after kickoff for earlier matches.
6. **Mock data reaches production UI** — backtest fabricates matches/probabilities/CLV; /app/matches falls back to mock; /api/predictions serves test rows.
7. **3 of 4 providers non-functional** (OddsPAPI×2 hosts, TheStatsAPI, Football-Data.org) — placeholder/invalid keys, no monitoring alerting.
8. **No historical bridge** — the only real historical dataset (EPL CSV 2,282 rows with results+odds) is not connected to `matches`/model; no historical import jobs (historical_imports empty).
9. **Adaptive scheduler inert** — all 32 leagues at `adaptive_priority=1`, `season_status=unknown`, `fixture_volume_7d=0`; worldwide-scheduler not scheduled.
10. **Quota accounting flaw** — QUOTA_RESERVATION rows counted as usage (double counting); in-memory rate limiters do not persist across serverless instances.

## 8. GO / NO-GO
### **NO-GO**
Prediction accuracy and data integrity are not yet trustworthy. API-Football ingestion works and the
pipeline code exists, but: no odds provider is authenticated, no settlement has ever occurred, the
prediction engine receives no real match data, and mock/synthetic data reaches the production frontend.
Nothing in this audit supports any claim of model accuracy, calibration, EV validity, or league
coverage. The single trustworthy asset is the EPL 2020–2026 CSV warehouse (2,282 matches, real
results + odds) — a viable foundation to rebuild validation on.
