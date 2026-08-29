# EPIC 57 — DAILY AUTOMATED PIPELINE SPECIFICATION (SHADOW MODE)

**Execution Timestamp:** 2026-08-29T11:52:22.000Z  
**Mode:** SHADOW UNATTENDED / HONEST STATUS / NO PUBLIC VALUE CLAIMS  
**Market:** Asian Handicap ONLY  
**Monetization Status:** `MONETIZATION_ENABLED = false`  
**Model Version:** `AH-dixoncoles-v1.0.0` (frozen champion from EPIC 56)  
**Live Data Status:** `ACTIVE — REAL FIXTURE INGESTION & SETTLEMENT OPERATIONAL (EPIC 57.1)`

---

## 1. Fixture Ingestion Scope Audit (Phase 1)

### A. Europe
- **Active & In-Season (Top 5 & 2nd Tier)**:
  - English Premier League (`39`), Championship (`40`)
  - Spanish La Liga (`140`), Segunda Division (`141`)
  - Italian Serie A (`135`), Serie B (`136`)
  - German Bundesliga (`78`), 2. Bundesliga (`79`)
  - French Ligue 1 (`61`), Ligue 2 (`62`)
  - Dutch Eredivisie (`88`), Portuguese Primeira Liga (`94`), Belgian Pro League (`144`), Scottish Premiership (`179`)
  - Nordic Summer Leagues: Norwegian Eliteserien (`103`), Swedish Allsvenskan (`113`), Danish Superliga (`119`), Finnish Veikkausliiga (`244`)
- **Feed Coverage Status**: **CONFIRMED**. Full fixture schedules and Pinnacle/Bet365 Asian Handicap odds feeds are available via API-Football + OddsPAPI.

### B. Asia
- **Leagues in Universe**:
  - Japanese J1 League (`98`) — In-season (Spring–Autumn)
  - South Korean K League 1 (`292`) — In-season (Spring–Autumn)
  - Indonesian Liga 1 (`279`) — In-season
  - Saudi Pro League (`307`) — Active
  - Australian A-League (`188`) — Active
  - Chinese Super League (`169`) — Active
- **Feed Coverage Status**: **LIMITED / VERIFIED ONLY WHERE PINNACLE/SBOBET QUOTES EXIST**. API-Football schedules exist for all; OddsPAPI AH coverage is active on J1 League, K League 1, and Saudi Pro League, but thin on Liga 1 Indonesia.

### C. Americas
- **Leagues in Universe**:
  - USA Major League Soccer (`253`) — In-season
  - Brazilian Serie A (`71`) — In-season
  - Mexican Liga MX (`262`) — Active (Apertura/Clausura)
  - Argentine Liga Profesional (`128`) — Active
  - Colombian Primera A (`239`) — Active
- **Feed Coverage Status**: **CONFIRMED FOR MLS & BRAZIL SERIE A**. Pinnacle lines are reliably available. Other South American competitions are ingested only when liquid two-way AH lines are present.

---

## 2. Scheduling & Unattended Execution (Phase 2)

- **Daily Inference Execution**: Runs daily via scheduled endpoint (`/api/cron/ah-shadow-pipeline` scheduled at `04:00 UTC` in `vercel.json`).
  - Pulls upcoming fixtures for the next 24–48 hours across active leagues.
  - Takes opening/T-60 odds snapshot.
  - Computes point-in-time state ($T_{\text{feature}} < T_{\text{matchDate}}$) and executes `AH-dixoncoles-v1.0.0`.
  - Writes **EVERY** prediction to the persistent ledger.
- **Automated Settlement Execution**:
  - Evaluates past fixtures from the prior 24–48 hours.
  - Ingests verified final scores and matches closing odds.
  - Computes exact quarter-line settlement payoffs via `AhSettlementEngine`.
  - Updates ledger records with outcome, net profit/loss, and Closing Line Value (CLV).
- **Rate-Limit & Quota Guard**: Rationed pre-match snapshot calls; no continuous polling.

---

## 3. Persistent Ledger Schema (Phase 3)

Location: `data/ledger/ah_predictions_ledger.jsonl`

Every record carries complete provenance:
- `fixtureId`, `leagueId`, `leagueName`, `kickoffAt`
- `homeTeam`, `awayTeam`
- `modelVersion`: `AH-dixoncoles-v1.0.0`
- `featureVersion`: `pit-football-v1`
- `dataCutoffTimestamp`, `oddsSnapshotTimestamp`
- `line`, `side`
- `fairProbability`, `fairOdds`, `devigMarketProbability`
- `takenOdds`, `closingOdds`
- `edge`, `ev`, `clv`
- `valueQualificationState`: `NOT_VALIDATED` (strictly enforced, no `QUALIFIED_VALUE`)
- `sampleStatus`: `ADEQUATE`, `LIMITED`, `INSUFFICIENT`
- `settlementStatus`: `PENDING`, `SETTLED`, `VOID`
- `actualOutcome`, `profitLoss`, `settledAt`
- `researchStatusLabel`:
  > **"RESEARCH STATUS: NOT YET VALIDATED. Historical backtest on 2015-2026 data shows no statistically significant edge (CLV Z=0.523, p=0.601; realized ROI -2.30% to -2.40% across tested configurations). This prediction is logged for track-record building, not as a recommendation."**

---

## 4. Internal Research Dashboard & Gate Progress (Phase 4)

- **Internal View Route**: `/api/admin/shadow-performance`
- **Track-Record Gate Counter**: Tracks live progress toward the **150–200 settled-signal gate**.
- **CLV Monitoring**: Real-time mean CLV and $Z$-score computation on live closing lines.
- **Hard Constraint Enforcement**:
  - `MONETIZATION_ENABLED = false`
  - Zero public-facing "value bet" or "EV%" recommendations.

---

## 5. Failure Handling & Alerting (Phase 5)

- Explicit error logging per fixture and stage (`ODDS_FETCH`, `INFERENCE_GENERATION`, `SETTLEMENT`).
- Alerting threshold: Triggers error alerts if failure rate exceeds 10% in any pipeline execution run.

---

## 6. EPIC 57.1 Real-Data Verification Report

- **Activation Timestamp**: `2026-08-29T11:52:22.000Z`
- **Fixture Ingestion**: Real fixture schedules ingested across confirmed European leagues (Premier League, Serie A, La Liga).
- **Automated Settlement Trace**: Successfully completed real settlement trace (Score 2-0 $\to$ `FULL_WIN` and `FULL_LOSS` with exact profit and CLV tracking).
- **Hard Override Compliance**: Exactly 0 records with `QUALIFIED_VALUE` (100% compliant with `NOT_VALIDATED` override).
- **Honesty Banner Compliance**: Active on 100% of generated records.
- **Monetization & Public UI**: `MONETIZATION_ENABLED = false`, public value bet recommendation screens disabled.
