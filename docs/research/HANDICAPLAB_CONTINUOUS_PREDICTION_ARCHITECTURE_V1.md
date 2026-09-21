# HandicapLab Continuous Prediction Archive, Daily Picks & SALMO Sync Architecture (v1.0)

**Version:** 1.0.0-PROD  
**Status:** Canonical Production Core  
**Consumer System:** SALMO.DEV  
**Primary Markets:** Asian Handicap (AH), Both Teams To Score (BTTS), Over/Under (O/U)

---

## 1. Architectural Philosophy & Mission

HandicapLab functions as the **authoritative continuous prediction evidence engine** for football betting markets, designed with the rigor and discipline of a Bloomberg Terminal for quantitative sports finance.

SALMO (`salmo.dev`) serves strictly as the **always-current public presentation and consumer layer**. SALMO does not compute models, fabricate lines, or maintain separate ledger truths. It queries HandicapLab's canonical change feed via deterministic API contracts (`/api/v1/salmo/sync`) or local filesystem bridges.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        HANDICAPLAB CORE                                │
│                                                                        │
│   REAL FIXTURES (API-Football PRO) + REAL ODDS (OddsPapi / Pinnacle)  │
│                                  ↓                                     │
│   DIXON-COLES BIVARIATE POISSON MODEL (dixon-coles-v1.0)               │
│                                  ↓                                     │
│   MATHEMATICAL STATE SNAPSHOT (xG Grid, Prob, Fair Odds, Edge, EV)    │
│                                  ↓                                     │
│   IMMUTABLE PREDICTION ARCHIVE (prediction_archive.json / .jsonl)      │
│       │                                                                │
│       ├── (Dynamic Projection) ──→ DAILY PICKS (Today, Tomorrow, 7D)  │
│       │                                                                │
│       ├── (Kickoff Lock) ────────→ FROZEN ODDS & MODEL STATE           │
│       │                                                                │
│       ├── (Verified Result) ─────→ DETERMINISTIC QUARTER-LINE SETTLER  │
│       │                                                                │
│       └── (Pinnacle Closing Line) → CLOSING LINE VALUE (CLV) & YIELD   │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                     /api/v1/salmo/sync
                                   │
                                   ↓
┌────────────────────────────────────────────────────────────────────────┐
│                        SALMO.DEV CONSUMER                              │
│                                                                        │
│   HttpHandicapLabAdapter / LocalHandicapLabAdapter                     │
│   → Public Presentation Layer (Interactive Markets, Calibration View)  │
│   → Cross-System Reconciliation Engine                                 │
│   → Zero-Data Contradiction Guards                                     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Invariants & Governance

1. **Immutable Archive $\neq$ Dynamic Daily Picks**:
   - The **Prediction Archive** is append-only, immutable, and permanent. Once written, records are never deleted or rewritten.
   - **Daily Picks** is strictly a dynamic calendar projection derived on-the-fly from active, unplayed predictions within the current horizon (Today, Tomorrow, Next 7 Days). As UTC calendar dates advance, picks roll forward automatically without manual interventions.

2. **Forensic State & Provenance**:
   - Every prediction includes a complete mathematical snapshot: Home xG, Away xG, low-score correlation $\rho$, exact line, model probability, fair odds, market entry odds, edge, EV, model version ID, parameters version, and SHA-256 provenance hash.

3. **Fail-Closed & Zero Synthetic Fallback**:
   - If fixtures or real odds are unavailable from primary sources (API-Football and OddsPapi/Pinnacle), the system reports `DATA_UNAVAILABLE` or `NO_QUALIFIED_PICKS`.
   - Synthetic fixtures, fake odds, or mock fallbacks are strictly prohibited.

4. **Bookmaker Hierarchy & CLV Ground Truth**:
   - **Pinnacle** is the mandatory ground truth for all entry odds, closing line captures, and Closing Line Value (CLV) calculations.
   - SBOBET serves solely as a secondary benchmark.

5. **Deterministic Quarter-Line Settlement**:
   - Asian Handicap and Totals split quarter lines ($\pm 0.25, \pm 0.75$) into their constituent half and whole lines:
     - `WIN`: Stake $\times (Odds - 1)$
     - `HALF_WIN`: $(Stake / 2) \times (Odds - 1)$
     - `PUSH`: $0.00$
     - `HALF_LOSS`: $-(Stake / 2)$
     - `LOSS`: $-Stake$
     - `VOID`: $0.00$
   - Realized Yield is strictly computed as $\text{Yield} = \frac{\text{Total Net Profit Units}}{\text{Total Staked Units}} \times 100\%$.

6. **Multi-Window Performance Tracking**:
   - Segregated windows: `Today`, `Yesterday`, `Last 7 Days`, `Last 30 Days`, `Season`, and `All Time`.
   - Dimension breakdowns across: Market Type (`AH`, `OU`, `BTTS`), Competition, and Model Version.

---

## 3. Implemented Modules

| File Path | Description |
|:---|:---|
| `src/lib/archive/types.ts` | Complete TypeScript domain definitions for Archive, Projections, Sync, and Reconciliation. |
| `src/lib/archive/modelVersionRegistry.ts` | Model registry with frozen parameter configs, scope definitions, and cryptographic fingerprints. |
| `src/lib/archive/predictionArchiveService.ts` | Atomic disk persistence (`.json` and append-only `.jsonl`), dynamic calendar rollover, kickoff locking, and incremental queries. |
| `src/lib/archive/forensicAuditService.ts` | Formula lineage reconstruction auditing every mathematical transformation step. |
| `src/lib/archive/reconciliationService.ts` | Cross-system consistency validator detecting missing records, duplicate IDs, sync lag, and settlement mismatches. |
| `src/lib/ledger/productionSettlementService.ts` | Automated bet settler verifying final results and stamping Pinnacle closing lines & CLV. |
| `src/lib/ledger/dailyPerformanceService.ts` | Multi-window performance and yield aggregator. |
| `src/app/api/v1/salmo/sync/route.ts` | Canonical REST synchronization endpoint supporting `since`, `view`, `horizon`, and `market` query parameters. |
| `src/app/api/v1/health/production/route.ts` | Production health telemetry and zero-data contradiction detection endpoint. |
| `src/app/api/cron/pipeline/route.ts` | Consolidated cron pipeline supporting `mode=sync`, `mode=contradiction-check`, `mode=settle`, `mode=reconcile`, and `mode=full`. |
| `../SALMO/src/contracts/handicapLabAdapter.ts` | SALMO consumer adapter consuming `/api/v1/salmo/sync` and local archive ledgers. |

---

## 4. Zero-Data Contradiction Guards

The health monitoring system (`/api/v1/health/production` and cron pipeline) enforces four non-negotiable contradiction invariants:

1. **0 upcoming fixtures + active signals > 0** $\to$ `FAIL (CRITICAL)`
2. **0 settled predictions + positive production yield** $\to$ `FAIL (CRITICAL)`
3. **0 closing odds + verified CLV** $\to$ `FAIL (CRITICAL)`
4. **0 production predictions + public daily picks** $\to$ `FAIL (CRITICAL)`

If any invariant is breached, the endpoint immediately returns `CONTRADICTION_DETECTED` with explicit diagnostic payloads.

