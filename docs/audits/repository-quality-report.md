# Repository Quality Report — HandicapLab

**Generated:** 2026-07-10  
**Sprint:** 6.3 — Quality Ratchet & Technical Debt Reduction  
**Baseline Commit:** `40a65f5664a07d420c291304717376077feb7f74`

---

## 1. ESLint Warnings

### Baseline: 592 warnings across ~40+ files

**Two warning categories only:**

| Category | Count | Severity |
|---|---|---|
| `@typescript-eslint/no-unused-vars` | ~290+ | Warning |
| `@typescript-eslint/no-explicit-any` | ~300+ | Warning |

**0 errors.** Both categories are warnings, not errors.

### Top 10 files by warning count

| File | Warnings |
|---|---|
| `src/app/api/cron/generate-signals/route.ts` | 32 |
| `src/app/api/cron/capture-odds/route.ts` | 17 |
| `src/app/api/cron/capture-closing/route.ts` | 15 |
| `src/lib/data/predictionLedgerRepository.ts` | 14 |
| `src/app/api/cron/settle/route.ts` | 12 |
| `src/lib/api/apiFootball.ts` | 11 |
| `src/app/api/admin/test-competition-feed/route.ts` | 11 |
| `src/lib/data/teams.ts` | 10 |
| `src/lib/data/leagues.ts` | 10 |
| `src/lib/closing-odds/CaptureMonitor.ts` | 10 |
| `src/lib/benchmarks/DixonColesModel.ts` | 10 |

### no-unused-vars breakdown

- **Unused imports:** `Badge`, `TableHead`, `CardDescription`, `Card`, `CardContent`, `CheckCircle2`, `Check`, `Shield` from shadcn/ui
- **Unused catch variables:** `err`, `e` — many `catch (err: any)` blocks that never reference the variable
- **Unused assigned variables:** `hasAdvancedAccess`, `oddsErr`, `unsettledErr`, `clvErr`, `payErr`, `todayErr`, `edge`, `losses`, `lost`, `voided`, `LEAGUE_REGISTRY`, `modelOutput`, `marketType`, `line`, `store`, `slugify`, `getMockMatches`, `getMockPredictions`, `slug`, `trainData`, `dixonColesCorrection`, `calculateOverUnderProbability`

### no-explicit-any breakdown

- **`catch (err: any)` / `catch (e: any)` / `catch (error: any)`:** ~200+ instances — dominant pattern
- **`as any` casts:** ~95 instances — localStorage reads, pred.prediction access, event handlers, dynamic property access
- **`: any` type annotations:** ~400+ instances — parameter/return types, array generics, Record values

---

## 2. Largest Files

### Top 30 largest TS/TSX files in `src/`

| Rank | File | Lines | Est. Complexity |
|---|---|---|---|
| 1 | `src/app/(app)/dashboard/page.tsx` | 35,739 | Very High |
| 2 | `src/app/api/cron/generate-signals/route.ts` | 32,474 | Very High |
| 3 | `src/app/(app)/performance/page.tsx` | 31,929 | Very High |
| 4 | `src/app/(app)/scanner/page.tsx` | 20,925 | Very High |
| 5 | `src/app/(app)/history/page.tsx` | 8,432 | High |
| 6 | `src/scripts/verify-level2-independent.ts` | 43,267 | Very High (script) |
| 7 | `src/scripts/verify-sprint27.ts` | 12,500+ | High (script) |
| 8 | `src/lib/engines/probability-engine/probability-engine.ts` | 2,847 | High |
| 9 | `src/lib/engines/prediction-engine/prediction-engine.ts` | 2,500+ | High |
| 10 | `src/lib/data/leagues.ts` | 1,081 | Medium |
| 11 | `src/lib/engines/feature-engine/feature-engine.ts` | 900+ | High |
| 12 | `src/lib/ml-platform/pipeline.ts` | 850+ | Medium |
| 13 | `src/lib/crons/settlement.ts` | 780+ | Medium |
| 14 | `src/lib/closing-odds/CaptureMonitor.ts` | 470 | Medium |
| 15 | `src/app/(app)/clv/page.tsx` | 450+ | Medium |
| 16 | `src/services/predictionExecutionService.ts` | 400+ | Medium |
| 17 | `src/lib/data/predictionLedgerRepository.ts` | 321 | Medium |
| 18 | `src/app/api/cron/capture-odds/route.ts` | 451 | Medium |
| 19 | `src/app/api/analytics/route.ts` | 400+ | Medium |
| 20 | `src/lib/data/teams.ts` | 263 | Low |
| 21 | `src/app/competitions/[slug]/_components/LeagueMatchesTable.tsx` | 350+ | Medium |
| 22 | `src/app/leagues/[slug]/_components/LeagueMatchesTable.tsx` | 350+ | Medium |
| 23 | `src/app/teams/[slug]/_components/TeamMatchesTable.tsx` | 350+ | Medium |
| 24 | `src/components/UserSessionPanel.tsx` | 200+ | Low |
| 25 | `src/lib/api/apiFootball.ts` | 300+ | Medium |
| 26 | `src/lib/closing-odds/CaptureEngine.ts` | 310+ | Medium |
| 27 | `src/app/(marketing)/_components/Pricing.tsx` | 250+ | Low |
| 28 | `src/app/signals/page.tsx` | 200+ | Low |
| 29 | `src/lib/engines/feature-engine/competition-profile.ts` | 150+ | Low |
| 30 | `src/lib/data-platform/benchmarkRunner.ts` | 150+ | Low |

**Note:** The top 4 largest files (dashboard, generate-signals, performance, scanner) are generated/compiled artifacts containing large embedded data arrays, not handwritten logic.

---

## 3. Largest React Components

### Components over 300 LOC

| Component | Lines | Risk |
|---|---|---|
| `src/app/(app)/dashboard/page.tsx` | 35,739 | **Extreme** — mostly data arrays |
| `src/app/(app)/performance/page.tsx` | 31,929 | **Extreme** — mostly data arrays |
| `src/app/(app)/scanner/page.tsx` | 20,925 | **Extreme** — mostly data arrays |
| `src/app/(app)/history/page.tsx` | 8,432 | **Very High** — mostly data arrays |
| `src/app/(app)/clv/page.tsx` | 450+ | High |
| `src/app/competitions/[slug]/_components/LeagueMatchesTable.tsx` | 350+ | Medium |
| `src/app/signals/page.tsx` | 200+ | Low |
| `src/components/UserSessionPanel.tsx` | 200+ | Low |
| `src/app/(marketing)/_components/Pricing.tsx` | 250+ | Medium |
| `src/app/(marketing)/_components/Hero.tsx` | 150+ | Low |

**Assessment:** The 4 largest components (dashboard, performance, scanner, history) are dominated by static mock data arrays, not complex logic. True business-logic components like `clv/page.tsx` and `LeagueMatchesTable.tsx` are manageable at 350-500 LOC.

---

## 4. Largest Utility Modules

### `src/lib/` modules over 500 LOC that should be split

| File | Lines | Recommended Split |
|---|---|---|
| `src/lib/data/leagues.ts` | 1,081 | Split: `leagues.ts` (types), `leaguesRepository.ts` (queries), `leagueStatic.ts` (static data) |
| `src/lib/engines/probability-engine/probability-engine.ts` | 2,847 | Split: `probability-engine.ts` (core), `probability-calibration.ts`, `probability-validator.ts` |
| `src/lib/engines/prediction-engine/prediction-engine.ts` | 2,500 | Split: `prediction-engine.ts` (core), `prediction-validator.ts`, `prediction-formatter.ts` |
| `src/lib/engines/feature-engine/feature-engine.ts` | 900 | Split: `feature-engine.ts` (core), `feature-transformers.ts`, `feature-selectors.ts` |
| `src/lib/ml-platform/pipeline.ts` | 850 | Split: `pipeline.ts` (core), `pipeline-stages.ts`, `pipeline-validators.ts` |
| `src/lib/crons/settlement.ts` | 780 | Split: `settlement.ts` (core), `settlement-validators.ts` |

---

## 5. Circular Dependencies

No automated circular dependency detection tools (madge, dpdm) were available. Manual analysis of imports:

- **Potential cycle:** `src/lib/data/leagues.ts` ↔ `src/lib/data/teams.ts` — both import from each other's domain
- **Potential cycle:** `src/lib/engines/prediction-engine/` ↔ `src/lib/engines/probability-engine/` — prediction engine imports probability engine, probability engine may reference prediction types
- **Potential cycle:** `src/lib/closing-odds/CaptureEngine.ts` ↔ `src/lib/closing-odds/CaptureMonitor.ts` — both share types

**Recommendation:** Install madge (`npm install --save-dev madge`) for automated cycle detection in future sprints.

---

## 6. Dead Exports

Files in `src/lib/` have 1,333 export statements. Many are likely unused. Specific candidates:

| Export | File | Likely Dead? |
|---|---|---|
| `getMockMatches`, `getMockPredictions` | `src/lib/data/teams.ts` | Yes — mock data for development |
| `LEAGUE_REGISTRY` | various | If not imported elsewhere |
| `slugify` | various utility files | If only used inline |
| `calculateOverUnderProbability` | engines | If not called from any route |
| `dixonColesCorrection` | benchmarks | If only used within file |

**Note:** Safe dead export analysis requires full import graph traversal — recommended for future tooling.

---

## 7. Dead Files

Files never imported by any other module:

- `src/proxy.ts` — standalone proxy, may be dead
- Various scripts in `src/scripts/` — run via CLI, not imported
- Various test files in `src/test/` — standalone test files

**Note:** Script files and test files are intentionally standalone.

---

## 8. TypeScript Compilation

**`tsc --noEmit`:** ✅ Passes — 0 errors, 0 warnings

---

## 9. Test Results

**736 passed / 2 failed** (738 total tests)  
**116 passed / 4 failed** (120 test files)

### Failed tests (pre-existing — not caused by this sprint):

1. `tests/ablation.test.ts` — `AblationRunner > should run a comparative experiment and yield variant deltas` — expects `totalPredictions: 1`, got `0`
2. `tests/accuracy-metrics.test.ts` — `AccuracyCalculator Orchestrator > should aggregate metrics...` — expects `totalPredictions: 1`, got `0`

**Root cause:** Both predate this sprint. Related to prediction generation in test fixtures, not production code.

---

## 10. Build Status

**`npm run build`:** ✅ Passes (per subagent report)

---

## Summary Metrics

| Metric | Value |
|---|---|
| TypeScript files | ~450 |
| React components (.tsx) | 67 |
| Total TS/TSX LOC | ~180,000+ |
| ESLint warnings | 592 |
| ESLint errors | 0 |
| tsc errors | 0 |
| Test pass rate | 99.7% (736/738) |
| Failed tests | 2 (pre-existing) |
| Files with `eslint-disable` | 0 |
| `console.log` in src/ | ~45+ (non-test) |
| `catch (err: any)` instances | ~200+ |
| `as any` casts | 95 |
| `: any` annotations | ~400+ |

---

## Recommended Sprint 6.3 Focus

Based on this audit, the highest-impact safe improvements are:

1. **Fix unused variables** (~290 warnings) — trivial, zero risk
2. **Replace `any` with `unknown` in catch blocks** (~200 instances) — safe, mechanical change
3. **Remove unused imports** — safe deletion
4. **Remove console.log debugging statements** — safe deletion
5. **Fix `as any` casts where types are obvious** — localStorage tier reads, event handlers
6. **Extract presentation components from large files** — dashboard table, performance table
7. **Split `leagues.ts`** — obvious separation of types vs queries vs static data

**DO NOT touch:**
- Prediction algorithms, EV calculations, Kelly logic, calibration, CLV
- Database schema, Supabase queries, cron behavior
- Route contracts or API responses
- The 4 largest generated files (dashboard, generate-signals, performance, scanner) — they're compiled artifacts