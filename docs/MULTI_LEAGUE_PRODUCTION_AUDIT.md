# HANDICAPLAB / SALMO.DEV — MULTI-LEAGUE PRODUCTION EXPANSION v1
## Canonical Audit, Quota Protection & Multi-League Operations Report

**Audit Date:** 2026-09-20  
**Audit Author:** Antigravity AI Assistant & SALMO.DEV System Architecture  
**Release Tag:** `v1.0.0-multi-league-gated`  
**Status:** **APPROVED — IMPLEMENTATION COMPLETE WITH HARD SAFETY GATES**

---

## 1. Executive Summary & Production State

HandicapLab has expanded from an EPL-only production pipeline into an audited, quota-protected multi-league architecture spanning **15 candidate football leagues** across Europe, the Americas, and Asia.

### Core Release Invariants Enforced:
1. **Single Production Prediction Engine**: Zero second model or divergent mathematical codebase. All leagues execute through the canonical Dixon-Coles Poisson grid (`buildScoreGrid`), with parameter isolation ($\lambda_{home}$, $\lambda_{away}$, $\rho$).
2. **Sharp Reference Ground Truth**: Pinnacle via OddsPapi is the sole benchmark for line comparison, two-way multiplicative de-vigging, and Closing Line Value (CLV).
3. **Strict Market Whitelist**: Only **Asian Handicap (AH)**, **Over/Under (OU)**, and **Both Teams to Score (BTTS)** are eligible for production prediction. **Moneyline / 1X2 recommendations are strictly prohibited** by policy.
4. **OddsPapi Quota Protection**: Hard cap of 250 requests/month (128 remaining). Tiered allocation reserves 60% for Tier A, 25% for Tier B, 10% for Tier C, and 5% emergency buffer. Single league consumption is hard-capped at 25% of total budget.
5. **Fail-Closed Lifecycle Gates**: All 14 non-EPL candidate leagues operate in **`SHADOW`** mode until real market liquidity, line stability, and $N \ge 100$ settled match sample criteria are verified.
6. **Zero Mock / Synthetic Fallback**: Production reads reject mock/synthetic fixtures (`SYNTHETIC_DATA_PROHIBITED`). If external data is unavailable, the pipeline records `SHADOW` / `LEWATI` with an explicit reason code rather than fabricating odds.
7. **Indonesia Liga 1 Gating**: API-Football PRO fixture statistics are unavailable (`statistics_fixtures = false`). Indonesia Liga 1 is fail-closed to `SHADOW` with deterministic reason code `NOT_ACTIVE: DATA_COMPLETENESS_FAIL`.

---

## 2. Candidate Leagues & Canonical Mappings Matrix

All 15 leagues have been reconciled against live provider catalogs (**API-Football PRO** and **OddsPapi v4**).

| League Key | Country | League Name | Tier | API-Football ID | OddsPapi ID | Current Status | Non-Active Reason Code | Priority Score |
|:---|:---|:---|:---:|:---:|:---:|:---:|:---|:---:|
| `ENG-PL` | England | Premier League | **A** | 39 | 17 | **`ACTIVE`** | `ACTIVE_PRODUCTION` | 100.0 |
| `ESP-LALIGA` | Spain | La Liga | **A** | 140 | 8 | `SHADOW` | `SHADOW_MARKET_LIQUIDITY_AUDIT` | 95.0 |
| `ITA-SERIEA` | Italy | Serie A | **A** | 135 | 23 | `SHADOW` | `SHADOW_MARKET_LIQUIDITY_AUDIT` | 94.0 |
| `DEU-BUNDESLIGA`| Germany | Bundesliga | **A** | 78 | 35 | `SHADOW` | `SHADOW_MARKET_LIQUIDITY_AUDIT` | 93.0 |
| `FRA-LIGUE1` | France | Ligue 1 | **A** | 61 | 34 | `SHADOW` | `SHADOW_MARKET_LIQUIDITY_AUDIT` | 90.0 |
| `NED-ERE` | Netherlands | Eredivisie | **B** | 88 | 37 | `SHADOW` | `SHADOW_SAMPLE_SIZE_GATE` | 82.0 |
| `POR-PRIMEIRA`| Portugal | Primeira Liga | **B** | 94 | 238 | `SHADOW` | `SHADOW_SAMPLE_SIZE_GATE` | 81.0 |
| `BEL-PRO` | Belgium | Pro League | **B** | 144 | 38 | `SHADOW` | `SHADOW_SAMPLE_SIZE_GATE` | 78.0 |
| `SCO-PREM` | Scotland | Premiership | **B** | 179 | 36 | `SHADOW` | `SHADOW_SAMPLE_SIZE_GATE` | 75.0 |
| `ENG-CHAMP` | England | Championship | **B** | 40 | 18 | `SHADOW` | `SHADOW_SAMPLE_SIZE_GATE` | 76.0 |
| `USA-MLS` | USA | Major League Soccer | **C** | 253 | 242 | `SHADOW` | `SHADOW_SAMPLE_SIZE_GATE` | 65.0 |
| `SAU-PRO` | Saudi Arabia | Saudi Pro League | **C** | 307 | 955 | `SHADOW` | `SHADOW_SAMPLE_SIZE_GATE` | 60.0 |
| `JPN-J1` | Japan | J1 League | **C** | 98 | 196 | `SHADOW` | `SHADOW_SAMPLE_SIZE_GATE` | 62.0 |
| `KOR-K1` | South Korea | K League 1 | **C** | 292 | 410 | `SHADOW` | `SHADOW_SAMPLE_SIZE_GATE` | 58.0 |
| `IDN-L1` | Indonesia | Liga 1 | **C** | 274 | 1015 | `SHADOW` | `NOT_ACTIVE: DATA_COMPLETENESS_FAIL` | 45.0 |

*Current Distribution: 1 ACTIVE, 14 SHADOW, 0 DISABLED, 0 MOCK.*

---

## 3. Provider Quota Architecture & Consumption Controls

### 3.1 API-Football PRO
- **Daily Quota**: 7,500 requests/day.
- **Probe Telemetry**: Account active, 7,466 calls remaining on probe date.
- **Egress Strategy**: Discovery batches cached in memory & filesystem (`data/cache/canonical_fixtures.json`) with a 30-minute TTL.

### 3.2 OddsPapi Free Tier (Strict Governance)
- **Monthly Limit**: 250 requests/month.
- **Consumed (Historical Baseline)**: 122 requests.
- **Remaining Balance**: 128 requests.
- **Unmetered Endpoint**: `/v4/account` is used exclusively for quota synchronization with a 2-minute client cache.
- **Tier Allocations (`OddsPapiQuotaAllocator`)**:
  - **Tier A (Big 5 European)**: 60% (150 requests/month max).
  - **Tier B (Secondary European)**: 25% (62 requests/month max).
  - **Tier C (Global Expansion)**: 10% (25 requests/month max).
  - **Buffer / Safety Reserve**: 5% (13 requests/month reserved for critical reconciliation).
- **Single-League Maximum Cap**: No single league may consume more than **25%** (62 requests) of the total monthly allowance.
- **Adaptive Throttling Modes**:
  - `NORMAL` ($> 50$ remaining): All standard priorities processed.
  - `ECONOMY` ($15 \le \text{remaining} < 50$): `LOW` priority requests automatically rejected.
  - `CRITICAL` ($5 \le \text{remaining} < 15$): Only `CRITICAL` priority requests permitted.
  - `EXHAUSTED` ($\text{remaining} = 0$): Complete fail-closed shutdown of new requests; system uses stale cached odds or flags `LEWATI`.

---

## 4. Gating Architecture & Research Invariants

### 4.1 Gate 0 Pre-Flight Verifier (`ImplementationGate0`)
Ensures all runtime dependencies are strictly satisfied prior to execution:
- API-Football PRO credential present and sanitized.
- OddsPapi credential present and sanitized.
- All 15 candidate leagues mapped to valid provider IDs.
- Indonesia Liga 1 blocked from `ACTIVE`.
- Quota headroom asserted ($\ge 5$ requests).
- **Audit Result**: `11/11 Checks Passed, Critical Failed: false`.

### 4.2 Point-in-Time Temporal Anti-Leakage Invariant
For every prediction $P$, the following temporal relationship is verified:
$$\tau_{\text{odds}} \le \tau_{\text{prediction}} < \tau_{\text{kickoff}}$$
Any fixture where $\tau_{\text{prediction}} \ge \tau_{\text{kickoff}}$ or $\tau_{\text{odds}} > \tau_{\text{prediction}}$ triggers immediate failure with `LOOK_AHEAD_LEAKAGE` and is rejected.

### 4.3 Minimum Sample Size & Statistical Viability
- Team fixture history gate requires a minimum of **3 settled matches per team** before a fixture is deemed `MODEL_VALID`. If either team has $<3$ matches, the prediction status is set to `INSUFFICIENT_MODEL` and verdict is `LEWATI`.
- Performance tracking requires a minimum cohort of **$N \ge 100$ settled bets** before declaring a league statistically viable. Any cohort with $N < 100$ is permanently labeled with the `LIMITED SAMPLE` badge.

### 4.4 Multi-Horizon Lifecycle Pipeline
Upcoming fixtures are bucketed by kickoff distance:
- `TODAY`: Kickoff within 24 hours.
- `TOMORROW`: Kickoff between 24 and 48 hours.
- `+2D` through `+7D`: Upcoming matchdays up to 168 hours.

Predictions evolve through three deterministic lifecycle stages:
1. `EARLY` ($> 72$ hours prior to kickoff): Initial feature ingestion and baseline Poisson calibration.
2. `PRE-MATCH` ($6 - 72$ hours prior to kickoff): Liquidity entry; sharp Pinnacle odds captured and de-vigged.
3. `FINAL` ($< 6$ hours prior to kickoff): Final lineup adjustments, closing line validation, and ledger sealing.

---

## 5. Verification & Test Evidence

Vitest execution across 4 dedicated test suites passed with 100% success rate:

```
 RUN  v2.1.9 C:/Users/RYZEN/.antigravity-ide/HandicapLab

 ✓ tests/multi-league-registry.test.ts (8 tests)
 ✓ tests/multi-league-gates.test.ts (13 tests)
 ✓ tests/oddspapi-quota-allocator.test.ts (8 tests)
 ✓ tests/multi-league-pipeline-integration.test.ts (11 tests)

 Test Files  4 passed (4)
      Tests  40 passed (40)
```

Data Contamination Audit:
```
=== DATA CONTAMINATION AUDIT RESULT ===
Files Checked: 8
Critical Violations: 0
Audit Passed: true
Zero contamination detected in production pathways.
```

---

## 6. Admin Observability & Operator Controls

An operator UI has been established at `/admin/leagues`:
- Visual matrix of all 15 candidate leagues with country flags, tier badges, and lifecycle state pills.
- Priority score breakdown ($0.0 - 100.0$) factoring tier weight, history depth, statistics availability, and Pinnacle support.
- Interactive popover explaining: *"Why is this league not ACTIVE?"* displaying deterministic reason codes (`SHADOW_MARKET_LIQUIDITY_AUDIT`, `NOT_ACTIVE: DATA_COMPLETENESS_FAIL`, etc.).
- Real-time OddsPapi quota gauge displaying monthly budget, remaining credits, and tier breakdown.

---

## 7. Definition of Done Checklist

- [x] **Audit provider capability & real catalogs** (API-Football PRO & OddsPapi Free).
- [x] **Canonical identity mapping** across all 15 candidate leagues.
- [x] **Strict quota allocation** (60/25/10/5% budget model, 25% single-league ceiling).
- [x] **Fail-closed Indonesia Liga 1 gate** (`NOT_ACTIVE: DATA_COMPLETENESS_FAIL`).
- [x] **Sharp reference market** (Pinnacle primary, multiplicative de-vigging, CLV ground truth).
- [x] **Market support whitelist** (AH, OU, BTTS only; Moneyline strictly prohibited).
- [x] **Zero mock / synthetic data in production reads** (Verified via automated audit).
- [x] **Point-in-time anti-leakage verification** ($\tau_{\text{odds}} \le \tau_{\text{prediction}} < \tau_{\text{kickoff}}$).
- [x] **Prediction horizon bucketing** (`TODAY` through `+7D`) & lifecycle stages (`EARLY`, `PRE-MATCH`, `FINAL`).
- [x] **100% unit and integration test pass rate** (40/40 tests passed).
- [x] **Admin visibility dashboard** at `/admin/leagues`.
- [x] **Final multi-league production audit report** published to `docs/MULTI_LEAGUE_PRODUCTION_AUDIT.md`.

