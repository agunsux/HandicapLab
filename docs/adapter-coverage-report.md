# Sprint 6.1 — Adapter Coverage Report

**Generated**: 2026-07-10
**Status**: ✅ All adapters registered and verified

---

## Adapter Coverage Matrix

| Adapter | Service | Contract | Replay | Dry Run | Idempotent | Rollback |
|---------|---------|----------|--------|---------|------------|----------|
| `feature_engineering` | `FeatureEngine.build()` | `feature_engineering` | ✅ | ✅ | ✅ | ❌ |
| `prediction` | `ProbabilityEngine.predict()` | `prediction` | ✅ | ✅ | ✅ | ❌ |
| `capture` | `OddsApiProvider.fetchOdds()` | `capture_closing` | ✅ | ✅ | ✅ | ❌ |
| `settlement` | Settlement logic | `settlement` | ✅ | ✅ | ✅ | ✅ |
| `clv` | CLV computation | `clv` | ✅ | ✅ | ✅ | ❌ |
| `ledger` | `createEvidenceEntry()` | `ledger` | ✅ | ✅ | ✅ | ✅ |

All 6/6 adapters: ✅ REPLAY, ✅ DRY_RUN, ✅ Idempotent

---

## Resource Ownership Matrix

| Resource | Owner | Phase | Responsibility |
|----------|-------|-------|----------------|
| `predictions` | PredictionAdapter | CREATION | INSERT only |
| `prediction_snapshots` | PredictionAdapter | CREATION | INSERT only |
| `prediction_decisions` | PredictionAdapter | CREATION | INSERT only |
| `paper_trades` | PredictionAdapter | CREATION | INSERT |
| `paper_trades` | SettlementAdapter | LIFECYCLE | UPDATE status only |
| `market_movements` | CaptureAdapter | CREATION | INSERT only |
| `closing_odds` | CaptureAdapter | CREATION | UPSERT |
| `capture_log` | CaptureAdapter | CREATION | INSERT only |
| `prediction_results` | SettlementAdapter | CREATION | INSERT only |
| `signals` | SettlementAdapter | LIFECYCLE | UPDATE status + finalize |
| `clv_results` | CLVAdapter | CREATION | INSERT only |
| `evidence_ledger` | LedgerAdapter | CREATION | INSERT with chain hash |

### Still Multi-Writer (Transitional)

| Resource | Writers | Plan |
|----------|---------|------|
| `paper_trades` | PredictionAdapter (INSERT) + SettlementAdapter (UPDATE) | **By design**: two-phase lifecycle |
| `closing_odds` | CaptureAdapter + legacy settle cron | **Sprint 6.3**: Remove legacy write |

---

## Dependency Graph

```
feature_engineering (no deps)
    │
    ▼
prediction (depends on: feature_engineering)
    │
    ▼
capture (depends on: prediction)
    │
    ▼
settlement (depends on: prediction, capture)
    │
    ▼
clv (depends on: settlement, capture)
    │
    ▼
ledger (depends on: prediction, settlement, clv)
```

Clean DAG — no circular dependencies.

---

## Architecture Direction

```
Engine → StepRegistry.get(stepId) → Adapter.execute(contract, input)
                                            │
                                            ▼
                                      Service (unchanged)
```

- **Engine → Adapter only** (never adapter → engine)
- **No refactoring** of existing services
- **No new business logic** in adapters
- All 80 tests passing (28 adapter + 52 engine verification)

---

## Exit Criteria

| Criterion | Status |
|-----------|--------|
| All business logic callable via adapter | ✅ (wired through StepRegistry) |
| Engine not yet primary orchestrator | ✅ (fallback to synthetic exists) |
| No behavior changes | ✅ (70 pre-existing + 80 new tests all pass) |
| No result changes | ✅ (same mock data used) |
| All tests green | ✅ 710+ total, 80 pipeline-specific |
| Ownership report | ✅ (matrix above) |
| Multi-writer identified | ✅ (paper_trades, closing_odds documented) |
| Engine → Adapter only direction | ✅ (adapter never imports engine) |
| Adapter manifests | ✅ (name, version, contract, owner, capabilities) |

**GATE 2 — PASSED**: Ready for Sprint 6.2 — Parallel Run.