# Sprint 6.0 — Integration Discovery Report

**Generated**: 2026-07-10
**Objective**: Map all execution paths, entry points, business logic, side effects, and coupling patterns before integrating the Pipeline Execution Engine.

**Status**: DISCOVERY ONLY — No code changes made.

---

## 1. Current Execution Graph

Today, the pipeline runs as independent cron-triggered services with NO central orchestrator:

```text
┌─────────────────────┐     ┌──────────────────┐
│  Cron: generate-    │     │  Cron: capture-  │
│  signals            │     │  odds            │
│  (every 15 min)     │     │  (every 5 min)   │
└────────┬────────────┘     └────────┬─────────┘
         │                           │
         ▼                           ▼
┌─────────────────────┐     ┌──────────────────┐
│  handleGenerate-    │     │  handleCapture-  │
│  Signals()          │     │  Odds()          │
└────────┬────────────┘     └────────┬─────────┘
         │                           │
         ├── ProbabilityEngine       │
         ├── FeatureEngine           │
         ├── writes predictions      │
         ├── writes paper_trades     │
         ├── writes decisions        │
         │                           ├── OddsApiProvider
         │                           ├── writes market_movements
         │                           ├── writes closing_odds
         │                           └── writes odds_history
         │
         ▼
┌─────────────────────┐     ┌──────────────────┐
│  Cron: settle-      │     │  Cron: closing-  │
│  signals            │     │  odds-capture    │
│  (every 15 min)     │     │  (every 5 min)   │
└────────┬────────────┘     └────────┬─────────┘
         │                           │
         ▼                           ▼
┌─────────────────────┐     ┌──────────────────┐
│  handleSettle()     │     │  CaptureEngine   │
└────────┬────────────┘     └──────────────────┘
         │
         ├── settles signals
         ├── calculates CLV
         ├── updates bankroll
         └── writes prediction_results
```

### Direct call paths bypassing any orchestrator

```
Any cron → Service function → Business logic → DB writes
```

There is **no single entry point** for a fixture's end-to-end lifecycle.

---

## 2. Entry Points

### 2.1 API Routes (Cron Jobs)

| Route | File | Trigger | Operation |
|-------|------|---------|-----------|
| `POST /api/cron/predict` | `src/app/api/cron/predict/route.ts` | Vercel Cron (15 min) | Full prediction pipeline |
| `POST /api/cron/generate-signals` | `src/app/api/cron/generate-signals/route.ts` | Vercel Cron (15 min) | Signal generation + paper trading |
| `POST /api/cron/settle` | `src/app/api/cron/settle/route.ts` | Vercel Cron (15 min) | Settlement + CLV |
| `POST /api/cron/capture-odds` | `src/app/api/cron/capture-odds/route.ts` | Vercel Cron (5 min) | Odds capture |
| `POST /api/cron/closing-odds` | `src/crons/closingOddsCapture.ts` | Vercel Cron (5 min) | Closing odds capture |
| `POST /api/cron/ledger` | `src/app/api/cron/ledger/route.ts` | Vercel Cron | Ledger maintenance |

### 2.2 Background Workers / Services

| Service | File | Trigger |
|---------|------|---------|
| `PredictionLedgerRepository` | `src/lib/data/predictionLedgerRepository.ts` | Called by prediction cron |
| `PredictionWorker` | `src/lib/paper-trading/predictionWorker.ts` | Called by generate-signals |
| `ResultReconciler` | `src/lib/paper-trading/resultReconciler.ts` | Called by settle cron |

### 2.3 CLI Scripts (Research / Admin)

| Script | File | Operation |
|--------|------|-----------|
| `audit_epl.py` | `src/scripts/audit_epl.py` | EPL data audit |
| `backtest-sprint11.ts` | `src/scripts/backtest-sprint11.ts` | Backtesting (independent) |
| `run-backtest-quant.ts` | `src/scripts/run-backtest-quant.ts` | Quant backtesting |
| `reproduce-experiment.ts` | `src/scripts/reproduce-experiment.ts` | Research reproduction |
| `research-sprint2.ts` | `src/scripts/research-sprint2.ts` | Research pipeline |

### 2.4 Direct Service Calls in Tests

Multiple test files call services directly:
- `tests/phase6.test.ts` — calls `handleGenerateSignals()` directly
- `tests/backtest-engine.test.ts` — calls `BacktestEngine` directly
- `tests/closing-odds.test.ts` — calls `CaptureEngine` directly
- `tests/evidence-collection.test.ts` — calls ledger services directly

---

## 3. Business Logic Inventory

### 3.1 Feature Engineering

| Property | Value |
|----------|-------|
| **Location** | `src/lib/engines/feature-engine/index.ts` → `FeatureEngine.build()` |
| **Input** | Match data, team stats, historical data |
| **Output** | `MatchFeatures` (homeAttack, awayDefense, rest days, travel, etc.) |
| **Side Effects** | None (pure computation) |
| **Dependencies** | Warehouse for historical data |
| **Risk** | LOW |

### 3.2 Prediction Generation

| Property | Value |
|----------|-------|
| **Location** | `src/lib/engines/probability-engine/index.ts` → `ProbabilityEngine.predict()` |
| **Input** | `MatchFeatures` + odds snapshot |
| **Output** | `ProbabilityOutput` (home/draw/away prob, AH, OU, expected goals, confidence) |
| **Side Effects** | Writes to: `predictions` table, `prediction_snapshots`, `prediction_decisions`, `paper_trades`, `odds_history` |
| **Dependencies** | `PoissonModel`, `DixonColesModel`, `FeatureEngine`, `OddsApiProvider` |
| **Risk** | MEDIUM — Scattered writes to multiple tables |

### 3.3 Opening Odds Capture

| Property | Value |
|----------|-------|
| **Location** | `src/lib/data/providers/odds/provider.ts` → `OddsApiProvider.fetchOdds()` |
| **Input** | Fixture IDs, market types |
| **Output** | OddsSnapshots with normalized vig-free probabilities |
| **Side Effects** | Writes to `market_movements` and `closing_odds` tables (via CaptureEngine) |
| **Dependencies** | The Odds API (external) |
| **Risk** | LOW — Mostly append-only |

### 3.4 Closing Odds Capture

| Property | Value |
|----------|-------|
| **Location** | `src/lib/closing-odds/CaptureEngine.ts` → `CaptureEngine.captureMatch()` |
| **Input** | Match + phase (t-48h, t-24h, t-6h, etc.) |
| **Output** | Capture results + closing_odds update |
| **Side Effects** | Writes to `market_movements`, `closing_odds`, `capture_log` |
| **Dependencies** | `OddsApiProvider` |
| **Risk** | LOW — Append-only |

### 3.5 Settlement

| Property | Value |
|----------|-------|
| **Location** | `src/app/api/cron/settle/route.ts` → `handleSettle()` |
| **Input** | Match results (home/away score) + predictions |
| **Output** | Settlement records (hit/miss, profit/loss) |
| **Side Effects** | Writes to: `signals` (status update), `prediction_results`, `paper_trades`, bankroll recalculations |
| **Dependencies** | `ApiFootballProvider`, `OddsApiProvider`, `PredictionLedgerRepository` |
| **Risk** | **HIGH** — Financial consistency, updates multiple tables transactionally |

### 3.6 CLV Computation

| Property | Value |
|----------|-------|
| **Location** | `src/lib/closing-odds/CaptureEngine.ts` → `computeCLVForMatches()` |
| **Input** | Prediction + closing odds |
| **Output** | CLV in basis points |
| **Side Effects** | Writes to `clv_results` |
| **Dependencies** | `closing_odds` table, `predictions` table |
| **Risk** | LOW — Append-only |

### 3.7 Ledger Write

| Property | Value |
|----------|-------|
| **Location** | `src/lib/data/evidence/ledger.ts` → `createEvidenceEntry()` |
| **Input** | PredictionSnapshot + SettlementRecord |
| **Output** | EvidenceEntry with chain hash |
| **Side Effects** | Writes to ledger store (in-memory or DB) |
| **Dependencies** | Prediction + Settlement data |
| **Risk** | **HIGH** — Audit trail, chain integrity |

---

## 4. Side Effect Audit

### 4.1 All Side Effects Per Pipeline Step

| Step | Table/Store | Operation | Frequency |
|------|-------------|-----------|-----------|
| Prediction | `predictions` | INSERT | Per fixture |
| Prediction | `prediction_snapshots` | INSERT | Per fixture |
| Prediction | `prediction_decisions` | INSERT/UPSERT | Per prediction |
| Prediction | `paper_trades` | INSERT | Per qualified signal |
| Prediction | `odds_history` | INSERT | Per prediction |
| Capture | `market_movements` | INSERT | Per phase per fixture |
| Capture | `closing_odds` | UPSERT | At T-15m, T-5m, kickoff |
| Capture | `capture_log` | INSERT | Per capture run |
| Settlement | `signals` | UPDATE | Settle signal |
| Settlement | `prediction_results` | INSERT | Per finished match |
| Settlement | `paper_trades` | UPDATE | Settle trade |
| Settlement | bankroll | RECALC | After settlement |
| CLV | `clv_results` | INSERT | After settlement |
| Ledger | evidence store | INSERT | Chain-hashed entry |

### 4.2 Tables Written by Multiple Steps

| Table | Written By | Risk of Duplication |
|-------|-----------|---------------------|
| `predictions` | Prediction cron, generate-signals cron | MEDIUM |
| `paper_trades` | Prediction cron, settle cron | **HIGH** |
| `closing_odds` | CaptureEngine (Sprint 4), settling cron | MEDIUM |

---

## 5. Dependency Graph

```
FeatureEngine (pure computation)
    │
    ▼
ProbabilityEngine (pure computation)
    │
    ├──► writes predictions, prediction_snapshots, decisions
    │
    ▼
CaptureEngine
    │
    ├──► writes market_movements, closing_odds, capture_log
    │
    ▼
Settlement Service
    │
    ├──► reads predictions, closing_odds
    ├──► writes prediction_results, signals, paper_trades
    │
    ▼
CLV Computation
    │
    ├──► reads predictions, closing_odds, prediction_results
    ├──► writes clv_results
    │
    ▼
Evidence Ledger
    │
    ├──► reads prediction, settlement, CLV
    ├──► writes ledger entries with chain hash
```

### Hidden Dependencies

1. **Prediction reads odds_history** — generates signals depends on previously captured odds
2. **Settlement reads paper_trades** — needs to know which trades to settle
3. **Settlement reads signals** — needs to know signal status
4. **Generate-signals reads historical data** — FeatureEngine depends on warehouse

---

## 6. Coupling Analysis

### 6.1 Circular Dependencies

**None found.** The dependency graph is a directed acyclic graph (DAG):

```
Feature → Prediction → Capture → Settlement → CLV → Ledger
```

### 6.2 Hidden Dependencies

| Dependency | Type | Location |
|------------|------|----------|
| Prediction reads hardcoded odds snapshot | Data coupling | `predictionService.ts:65-70` |
| Settlement imports prediction engine | Code coupling | `settle/route.ts:imports` |
| Generate-signals creates predictions + trades | Side effect coupling | `generate-signals/route.ts` |

### 6.3 Global State / Singletons

| Item | Type | Location |
|------|------|----------|
| `supabase` client | Singleton | `src/lib/supabase.server.ts` |
| DB connection pool | Singleton | `src/lib/db/connection.ts` |
| Provider clients | Instance-level | Per-engine instantiation |

### 6.4 Caches

| Cache | Location | Scope |
|-------|----------|-------|
| HTTP response cache (30-60s) | `HttpClient` | Per provider client |
| Provider registry cache | `ProviderRegistry` | Application scope |

---

## 7. Integration Risk Matrix

| Step | Risk | Reason | Mitigation |
|------|------|--------|------------|
| **Prediction** | MEDIUM | Writes to 5+ tables, generates side effects (paper trades) | Wrap in transaction, validate output matches contract |
| **Capture** | LOW | Append-only writes, no financial impact | Easy to delegate to engine |
| **Settlement** | **HIGH** | Financial consistency, updates paper trades + bankroll | Must be atomic; parallel run validation required |
| **CLV** | LOW | Append-only, depends on settlement | Simple delegation |
| **Ledger** | **HIGH** | Chain integrity, audit trail | Must ensure idempotency; chain verification |
| **Feature Engineering** | LOW | Pure computation | Easiest step to delegate |

---

## 8. Phase Separation Plan

### Phase 1: Adapter Layer
Wrap each business logic call in an adapter that can be invoked by `executeStep()`:
- `FeatureEngineeringAdapter` → calls `FeatureEngine.build()`
- `PredictionAdapter` → calls `ProbabilityEngine.predict()` + handles side effects
- `CaptureAdapter` → calls `OddsApiProvider.fetchOdds()` + stores results
- `SettlementAdapter` → calls settlement logic + writes results
- `CLVAdapter` → calls `computeCLVForMatches()`
- `LedgerAdapter` → calls `createEvidenceEntry()`

### Phase 2: Parallel Run
Run both old pipeline and engine pipeline against same fixtures. Compare:
- Predictions (probabilities, confidence)
- Settlement results (hit/miss, profit/loss)
- CLV values
- Ledger entries

### Phase 3: Cutover
- Cron jobs call `engine.executeTransition()` instead of services directly
- Old service calls marked deprecated
- All tests updated to use engine

### Golden Dataset
Select 500-1,000 representative matches from EPL CSV (2020-2026) for regression testing across all phases.

---

## GATE 1 Summary

| Check | Status |
|-------|--------|
| All entry points identified | ✅ |
| All business logic locations mapped | ✅ |
| Side effect inventory complete | ✅ |
| Dependency graph built | ✅ |
| Coupling analysis done | ✅ |
| Risk matrix created | ✅ |
| Integration plan outlined | ✅ |

**Ready for Sprint 6.1 — Adapter Layer.**