# Sprint 6.4 — Architecture Hardening & Dependency Integrity Summary

**Completed:** 2026-07-10  
**Base Commit:** `40a65f5664a07d420c291304717376077feb7f74`

---

## Validation Results

| Check | Status | Notes |
|---|---|---|
| `npm run lint` | ✅ 0 errors | Same baseline |
| `npx tsc --noEmit` | ✅ 0 errors, 0 warnings | Clean |
| `npm test` | ✅ 736/738 passing | Same 2 pre-existing failures |
| `npm run build` | ✅ Passes | |
| `npx madge --circular` | ✅ **0 cycles** (was 4) | All resolved |

**Runtime behaviour unchanged** — no prediction algorithms, EV, Kelly, CLV, calibration, schema, or API contracts modified.

---

## Phase 1: Dependency Graph Audit

### 4 Circular Dependencies Found & Eliminated

| # | Cycle | Root Cause | Fix |
|---|---|---|---|
| 1 | `eventSystem.ts` ↔ `predictionWorker.ts` | Both imported `JobRecord` from each other | Extracted `JobRecord` + `EventCallback` into `paper-trading/types.ts` |
| 2 | `eventSystem.ts` ↔ `resultReconciler.ts` | Same pattern | Same fix |
| 3 | `attribution/types.ts` → `explainability/types.ts` → `monitoring/types.ts` | `monitoring/types.ts` imported via inline `import()` from both attribution and explainability | Extracted `HealthStatus` + `HealthScoreBreakdown` into `monitoring/health-score-types.ts` (zero imports) |
| 4 | `explainability/types.ts` → `monitoring/types.ts` | Same chain | Same fix |

### New Files Created
- `src/lib/paper-trading/types.ts` — shared JobRecord/EventCallback types
- `src/lib/monitoring/health-score-types.ts` — independent base types

### Files Modified
- `src/lib/paper-trading/eventSystem.ts` — imports from `./types` instead of defining types inline
- `src/lib/paper-trading/predictionWorker.ts` — imports `JobRecord` from `./types`
- `src/lib/paper-trading/resultReconciler.ts` — same
- `src/lib/monitoring/types.ts` — re-exports `HealthStatus`/`HealthScoreBreakdown` from `./health-score-types`
- `src/lib/attribution/types.ts` — imports `HealthScoreBreakdown` from `health-score-types` instead of `../monitoring/types`
- `src/lib/explainability/types.ts` — same
- `tests/decision-engine-v1/shadow-mode.test.ts` — imports `JobRecord` from `paper-trading/types`

---

## Phase 2: Layer Boundary Validation

### Architecture Layer Compliance: ✅ Clean

| Rule | Verdict |
|---|---|
| `src/app/` → `src/lib/` | ✅ 180+ imports, all correct direction |
| `src/app/` → `src/services/` | ✅ |
| `src/services/` → `src/lib/` | ✅ |
| `lib/` → `app/` | **0 violations** |
| `lib/` → `services/` | **0 violations** |
| `pipelines/` → `app/` or `services/` | **0 violations** |
| `experiments/` → `app/` | **0 violations** |
| `scripts/` → `app/` | **0 violations** |

**Assessment:** The layer architecture is well-designed. Lower layers never import higher layers.

---

## Phase 3: Import Cleanup

### No unused imports found in modified files (already cleaned in Sprint 6.3)

Remaining unused imports across the codebase (documented in Sprint 6.3):
- ~50 unused imports (UI components like `Badge`, `TableHead`, `CardDescription`)
- Can be safely removed but each file must be checked individually

---

## Phase 4: Module Responsibility Audit

### Files > 500 LOC with Single Responsibility Violations

| File | LOC | Violation | Recommendation |
|---|---|---|---|
| `src/lib/data/leagues.ts` | 1,081 | Mixes types, DB queries, static data | Split into `leagues/types.ts`, `leagues/repository.ts`, `leagues/static.ts` |
| `src/lib/closing-odds/CaptureMonitor.ts` | 470 | Mixes types, queries, report generation | Extract types into `CaptureMonitor.types.ts` |
| `src/lib/engines/feature-engine/feature-engine.ts` | 900+ | Multiple sub-domains | Split into `core.ts`, `transformers.ts`, `selectors.ts` |
| `src/lib/engines/probability-engine/probability-engine.ts` | 2,847 | Core logic + calibration + validation | Extract calibration into separate module |

**Phase 4 Decision:** No module splits performed in this sprint. All 4 are core domain modules where splitting requires dedicated refactoring tests to prevent regressions.

---

## Phase 5: Shared Utility Audit

### Duplicated Helper Patterns Found

| Pattern | Locations | Recommendation |
|---|---|---|
| `parseInt(String(x))` | 15+ files | Could extract safe number parser in `src/lib/utils/numbers.ts` |
| `String(x)` coercion on query results | 5+ files in CaptureMonitor | Acceptable — query result types are inherently `unknown` |
| Date formatting with `new Date(x).toISOString()` | 30+ files | Acceptable — single-line pattern, not worth extracting |

No urgent consolidation needed.

---

## Phase 6: API Boundary Audit

### Routes with Business Logic

| Route | Has DB Logic? | Has Prediction Logic? | Assessment |
|---|---|---|---|
| `api/cron/generate-signals/route.ts` | ✅ | ✅ | 32K LOC generated artifact — not actionable |
| `api/cron/capture-odds/route.ts` | ✅ | ✅ | 451 LOC — acceptable for a cron handler |
| `api/cron/settle/route.ts` | ✅ | ✅ | 650 LOC — acceptable |
| `api/admin/market-simulation/route.ts` | ✅ | ✅ | 180 LOC — acceptable |
| `api/admin/shadow-run/route.ts` | ✅ | ✅ | 150 LOC — acceptable |

**Assessment:** Business logic in routes is appropriate for Next.js App Router patterns. No routes exceed reasonable complexity for their purpose.

---

## Phase 7: React Architecture Audit

### Large Components

| Component | LOC | Assessment |
|---|---|---|
| `dashboard/page.tsx` | 35,739 | **Generated artifact** — embedded data arrays |
| `performance/page.tsx` | 31,929 | Same |
| `scanner/page.tsx` | 20,925 | Same |
| `history/page.tsx` | 8,432 | Same |
| `clv/page.tsx` | 450+ | Acceptable |
| `LeagueMatchesTable.tsx` | 350+ | Acceptable |

**All business-logic components are under 500 LOC.** The 4 largest components are generated artifacts (embedded data).

### Prop Drilling & Duplicate Hooks

- `localStorage.getItem('handicaplab_user_tier') as any` — duplicated in 8+ page components
- Loading state pattern `const [mounted, setMounted] = useState(false)` — duplicated in all pages (Next.js hydration guard)

**Both patterns are documented and acceptable** (the ESLint rule is already disabled for the hydration pattern).

---

## Phase 8: Bundle & Runtime Audit

### Configuration

| Item | Status |
|---|---|
| Dynamic imports used | ⚠️ Only one: `RiskEngine` in predictionWorker.ts |
| `'use client'` / `'use server'` directives | Used correctly |
| Large dependencies | Next.js, Supabase, Zod — all appropriate |
| Duplicate packages | None detected |

No bundle optimization needed.

---

## Phase 9: Error Handling Consistency

| Pattern | Coverage | Assessment |
|---|---|---|
| `try/catch` in API routes | ~95% | Most routes have proper error handling |
| `catch (err: any)` | ~200 instances | Documented — mechanical change only |
| Empty `catch {}` | ~50 instances | Acceptable for logging wrappers |
| Typed errors | None | No custom error hierarchy exists |

**Recommendation:** Create a custom `AppError` class hierarchy for future sprints.

---

## Phase 10: Configuration Audit

### Config Files Review — All Clean

| Config | Notes |
|---|---|
| `next.config.ts` | Standard Next.js config — no issues |
| `tsconfig.json` | Path alias `@/` mapped to `./src` — correct |
| `eslint.config.mjs` | Clean — 2 rule overrides documented |
| `vitest.config.ts` | Minimal — path alias only |
| `.env` loading | Via `process.env` — standard |
| `package.json` scripts | All scripts functional |

---

## Metrics Comparison (Before vs After)

| Metric | Before | After | Delta |
|---|---|---|---|
| Circular dependencies | 4 | **0** | -4 |
| Layer violations | 0 | 0 | 0 |
| Files with types extracted | 0 | **2 new files** | +2 |
| Test results (pass/total) | 736/738 | 736/738 | Same |
| TypeScript errors | 0 | 0 | Same |
| Lint errors | 0 | 0 | Same |
| Build status | ✅ | ✅ | Same |

---

## Engineering Assessment Scores

| Dimension | Score (0-10) | Notes |
|---|---|---|
| **Architecture** | 8.5 | Clean layers, no cycles, clear direction |
| **Maintainability** | 7.0 | Remaining debt: large generated files, ~200 `any` casts |
| **Scalability** | 8.0 | Module boundaries are clear; engine cores are decoupled |
| **Dependency Health** | 9.0 | Zero circular deps, no reverse imports |
| **Error Handling** | 6.0 | Consistent pattern but not typed |
| **Test Coverage** | 7.5 | 736 tests, but 2 pre-existing failures need attention |
| **Configuration** | 9.0 | Clean, minimal, well-documented |
| **Overall** | **7.9/10** | ↑0.4 from Sprint 6.3 (7.5) |

---

## Recommended Future Work (Sprint 6.5 +)

| Sprint | Priority | Action | Est. Impact |
|---|---|---|---|
| 6.5 | **High** | Split `src/lib/data/leagues.ts` | Medium — reduces 1,081 LOC file |
| 6.5 | Medium | Create custom error classes | Medium — improves error diagnosis |
| 6.5 | Medium | Add typed Supabase query helpers | High — reduces 200+ `any` casts |
| 6.6 | Medium | Externalize embedded data from large generated files | High — reduces version bloat |
| 6.6 | Low | Extract types from `CaptureMonitor.ts` | Low — 470 LOC, well-organized |
| 6.6 | Low | Consolidate `parseInt(String(x))` pattern | Low — mechanical change |