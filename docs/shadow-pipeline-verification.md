# Shadow Pipeline — Verification Report

## Status: ✅ Architecture Complete, Gaps Identified

---

## 1. Frozen Research Modules — ALL INTACT

| Module | Path | Status |
|--------|------|--------|
| Probability Engine | `services/probability.engine.ts` | ✅ Immutable |
| Loader | `lib/research/loader.ts` | ✅ Immutable |
| Pipeline | `lib/research/pipeline.ts` | ✅ Immutable |
| Analytics | `lib/research/analytics.ts` | ✅ Immutable |
| Ratings | `lib/research/ratings.ts` | ✅ Immutable |
| Math/Metrics | `lib/math/metrics.ts` | ✅ Immutable |

## 2. Shadow Pipeline Present

| Component | Path | Status |
|-----------|------|--------|
| Provider Types | `lib/data/providers/types.ts` | ✅ Present |
| Provider Index | `lib/data/providers/index.ts` | ✅ Present |
| OddsProvider | `lib/data/providers/oddsProvider.ts` | ✅ Present |
| FixturesProvider | `lib/data/providers/fixturesProvider.ts` | ✅ Present |
| ResultsProvider | `lib/data/providers/resultsProvider.ts` | ✅ Present |
| Snapshot Types | `lib/data/snapshots/types.ts` | ✅ Present |
| Snapshot Engine | `lib/data/snapshots/engine.ts` | ✅ Present |

## 4. API Routes Present

| Route | Methods | Status |
|-------|---------|--------|
| `/api/shadow/predict` | POST, GET | ✅ Present |
| `/api/shadow/settle` | POST | ✅ Present |
| `/api/shadow/evidence` | GET | ✅ Present |
| `/api/shadow/evaluate` | GET | ✅ Present |

## 5. Dashboard & CLI Worker

| Component | Path | Status |
|-----------|------|--------|
| Dashboard | `app/dashboard/shadow/page.tsx` | ✅ Present |
| CLI Worker | `scripts/start-shadow-pipeline.ts` | ✅ Present |

## 6. Documentation

| Document | Status |
|----------|--------|
| `docs/architecture.md` | ✅ Present |
| `docs/operations.md` | ✅ Present |
| `docs/evidence.md` | ✅ Present |
| `operational-readme.md` | ✅ Present |
| `docs/shadow-pipeline-verification.md` | ✅ This file |
| `docs/SHADOW_OPERATIONS.md` | ❌ Missing |

## 7. Gaps Identified

| # | Gap | Phase | Severity |
|---|-----|-------|----------|
| G1 | Missing `model_versions` table/migration | P2 | Medium |
| G2 | Missing `model_hash` in prediction types | P2 | High |
| G3 | Missing `feature_version`/`dataset_version` in prediction types | P2 | Medium |
| G4 | Missing `selection` field (home/away/draw) | P2 | High |
| G5 | Missing `provider_name` and `raw_response_hash` in OddsSnapshot | P3 | Medium |
| G6 | Missing `normalizeMarket()` on IOddsProvider | P3 | Medium |
| G7 | Missing event types in evidence ledger | P5 | Medium |
| G8 | Settlement lacks proper AH/OU/ML resolution | P6 | High |
| G9 | Missing market breakdown in evaluation | P7 | Medium |
| G10 | CLI worker lacks retry handling | P8 | Medium |
| G11 | CLI worker lacks graceful shutdown | P8 | Medium |
| G12 | Missing structured logging | P8 | Low |
| G13 | Missing test files | P11 | High |
| G14 | GET /api/shadow/predict overlap | P9 | Low |
| G15 | Missing model_hash computation | P4 | High |
| G16 | Dashboard missing calibration chart | P10 | Medium |
| G17 | Missing docs/SHADOW_OPERATIONS.md | P12 | Medium |

## 8. Determinism Check

`generatePrediction()` in `services/probability.engine.ts`:
- Poisson calculations: ✅ Deterministic
- Feature scores: ✅ Deterministic
- OOD detection: ✅ Deterministic
- Confidence calc: ✅ Deterministic
- matchId uses Math.random(): ⚠️ Cosmetic only, does not affect probabilities

**Result**: Same input always produces same prediction probabilities. ✅

## 9. Runtime Requirements

| Requirement | Status |
|-------------|--------|
| Node.js 18+ | ✅ |
| PostgreSQL | ✅ (via pg dependency) |
| In-memory dev mode | ✅ |
| Deterministic predictions | ✅ Verified |
| Immutable odds | ✅ Append-only |
| Evidence chain | ✅ SHA-256 linked |

| Prediction Types | `lib/data/prediction/types.ts` | ✅ Present |
| Prediction Engine | `lib/data/prediction/engine.ts` | ✅ Present |
| Evidence Ledger | `lib/data/evidence/ledger.ts` | ✅ Present |
| Evaluation Runner | `lib/data/evaluation/runner.ts` | ✅ Present |

## 3. Database Migrations Present

| Migration | Table | Status |
|-----------|-------|--------|
| 001 | `fixtures` | ✅ Present |
| 002 | `odds_snapshots` | ✅ Present |
| 003 | `prediction_snapshots` | ✅ Present |
| 004 | `settlements` | ✅ Present |
| 005 | `evidence_ledger` | ✅ Present |
| 006 | `evaluation_runs` | ✅ Present |
