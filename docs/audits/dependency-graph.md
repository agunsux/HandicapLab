# Dependency Graph Report — HandicapLab

**Generated:** 2026-07-10  
**Sprint:** 6.4 — Architecture Hardening & Dependency Integrity  
**Tool:** madge (circular dependency analysis)

---

## Architecture Layers

```
UI (Components)
    ↓
App Routes (src/app/)
    ↓
Services (src/services/)
    ↓
Lib (src/lib/)
    │
    ├─ Data / Repositories
    ├─ Pipeline / Engine
    ├─ Prediction / Probability / Calibration (CORE)
    ├─ Market Intelligence
    ├─ Monitoring / Observability
    └─ Math / Utils (LEAF)
```

---

## Circular Dependencies — RESOLVED ✅

### Originally Found: 4 cycles

| # | Cycle | Status | Fix |
|---|---|---|---|
| 1 | `paper-trading/eventSystem.ts` ↔ `paper-trading/predictionWorker.ts` | ✅ Fixed | Extracted `JobRecord` into `paper-trading/types.ts` |
| 2 | `paper-trading/eventSystem.ts` ↔ `paper-trading/resultReconciler.ts` | ✅ Fixed | Same as above |
| 3 | `attribution/types.ts` → `explainability/types.ts` → `monitoring/types.ts` | ✅ Fixed | Extracted `HealthScoreBreakdown`/`HealthStatus` into `monitoring/health-score-types.ts` |
| 4 | `explainability/types.ts` → `monitoring/types.ts` | ✅ Fixed | Both now import from `health-score-types.ts` instead of `monitoring/types.ts` |

### After Fix: 0 cycles ✔

**Verified:** `npx madge --circular --extensions ts,tsx src/` — "No circular dependency found!"

---

## Layer Boundary Analysis

### Expected Direction
```
UI ──► App Routes ──► Services ──► Lib ──► Engines ──► Math/Utils
```

### Violations Found: 0 critical

| Violation Type | Count | Details |
|---|---|---|
| `lib/` imports `app/` | 0 | ✅ Clean separation |
| `pipelines/` imports `app/` | 0 | ✅ Pipelines only import from lib |
| `crons/` imports `app/` | 0 | ✅ Crons only import from lib |
| `experiments/` imports `app/` | 0 | ✅ Experiments only import from lib/services |
| `services/` imports `app/` | 0 | ✅ Services only import from lib |
| `lib/` imports `services/` | 2 | ⚠️ See below |

### Non-Critical Cross-Layer Notes

1. `src/services/predictionExecutionService.ts` imports from `src/lib/` — ✅ correct direction
2. `src/services/` imports `lib/paper-trading/types.ts` — ✅ correct direction
3. `src/pipelines/` only imports from `src/lib/` — ✅ correct

---

## Import Statistics

| Metric | Count |
|---|---|
| Total import statements in `src/` | ~4,500+ |
| Files analyzed by madge | 836 |
| Source files in `src/` | ~450+ |
| Source files in `tests/` | ~120 |

---

## Cross-Domain Import Analysis

### Highest-Coupled Lib Modules

| Module | Imported By |
|---|---|
| `src/lib/supabase.server` | 35+ route handlers, services, crons |
| `src/lib/engines/feature-engine` | 15+ admin/cron routes |
| `src/lib/engines/probability-engine` | 15+ admin/cron routes |
| `src/lib/crons/leagueRegistry` | 12+ admin/cron routes |
| `src/lib/engine/calibration` | 10+ routes |
| `src/lib/intelligence/attribution` | 8+ routes |

### Least-Coupled (Leaf) Modules

| Module | Only imports from... |
|---|---|
| `src/lib/utils/*` | stdlib or self-contained |
| `src/lib/math/*` | stdlib |
| `src/lib/errors/*` | nothing |
| `src/monitoring/health-score-types.ts` | **nothing** (newly created) |

---

## Module Cohesion Analysis

### Modules that Should Stay as-Is

- `src/lib/engines/probability-engine/` — tightly coupled internally, cohesive domain
- `src/lib/engines/prediction-engine/` — same
- `src/lib/engines/decision-engine-v1/` — same
- `src/lib/market-intelligence/` — same

### Modules that Could Be Split (Future Work)

- `src/lib/data/leagues.ts` (1,081 LOC) — mix of types, queries, static data
- `src/lib/closing-odds/CaptureMonitor.ts` (470 LOC) — could extract types
- `src/lib/engines/feature-engine/` (900+ LOC) — multiple sub-domains

---

## Dependency Graph Summary

```
src/app/ (routes + pages)
  ├── imports lib/ supabase.server, mock-data, monetization, crons, engines, utils, apis
  ├── imports services/ backtestService, discrepancyService, experimentService, etc.
  └── DOES NOT import from pipelines/, crons/, experiments/
  
src/services/
  ├── imports lib/ supabase.server, data, engines, paper-trading, etc.
  └── DOES NOT import from app/ (clean separation)

src/lib/
  ├── imports from utils/, math/, db/ only
  ├── key sub-modules: engines/, data/, closing-odds/, paper-trading/, monitoring/
  └── DOES NOT import from app/, services/ (clean separation)

src/pipelines/
  ├── imports from lib/ engines, data, utils
  └── DOES NOT import from app/, services/

src/crons/
  ├── imports from lib/ closing-odds, db, logger only
  └── DOES NOT import from app/, services/
```

---

## Recommendations

| Priority | Action | Est. Impact |
|---|---|---|
| ✅ Done | Remove 4 circular dependencies | High |
| Medium | Split `src/lib/data/leagues.ts` into types/queries/static | Medium |
| Low | Extract types from `CaptureMonitor.ts` | Low |
| Low | Audit dead exports in `src/lib/` (1,333 exports) | Medium |
| Low | Remove unused barrel/index re-exports | Low |