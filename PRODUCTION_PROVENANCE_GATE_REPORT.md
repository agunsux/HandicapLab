# PRODUCTION PROVENANCE GATE REPORT — EPIC 57 Preflight

**Timestamp**: 2026-08-16T02:58:32+07:00 (Asia/Jakarta)
**Commit SHA**: `cab012850aa98ce1f62c050d8042bd1b92e2e013` (HEAD, main) — working tree carries uncommitted preflight hardening
**Environment classification**: `LOCAL_DEV` (Windows, Node 20, Next.js 16.2.11 / Turbopack) — **no production credentials provisioned**
**Gate**: `PRODUCTION_PROVENANCE_GATE`

---

## FINAL GATE STATUS: `FAIL`

**Mandatory fail-closed status**: `ODDSPAPI_LIVE_AUTH_FAILED`

Do **NOT** proceed to EPIC 57 backtest/shadow execution. Per the gate instructions, the final status is `ODDSPAPI_LIVE_AUTH_FAILED` because OddsPAPI credentials cannot be verified, and production provenance has not been independently verified against live provider evidence.

---

## 1. Synthetic-Data Isolation — `FAIL`

The quarantined arrays (`DETERMINISTIC_10_FIXTURES_DATA`, `RAW_ODDSPAPI_EVENTS`, `RAW_API_FOOTBALL_FIXTURES`) no longer exist in `src/`; they live only in `tests/fixtures/synthetic.ts` (marked `TEST_ONLY_SYNTHETIC_DATA`). No file under `src/` imports from `tests/` (verified by import scan). `executeStageALinkage()` in `src/lib/integrity/dataIntegrityEngine.ts` now throws `[FAIL CLOSED]`.

**However**, the following production provenance/prediction/ingestion/integrity paths can still reach fabricated (non-provider) evidence. Each is a gate-failing finding:

| Path | Evidence concern |
|---|---|
| `src/app/api/cron/sync-warehouse/route.ts` | Ingestion path fabricates finished-match scores (`homeGoals: 2`, `awayGoals: 1`) and feeds them into `wh_fixtures` + ELO updates. |
| `src/app/api/cron/live-validation/scheduler/route.ts` | Live-validation path returns a fabricated default quote set (e.g. `priceHome: 2.10`) when no real `odds_snapshots` row exists — a synthetic odds fallback. |
| `src/lib/pipeline/engine/index.ts` (~L847) | Prediction pipeline "legacy synthetic execution" fallback fabricates `homeProb/drawProb/awayProb`, `clv: 0.05`, `clvBps: 500`, `hit1x2/hitAH: true`, actual scores, etc. when no adapter is registered. |
| `src/lib/integrity/dataIntegrityEngine.ts` Stage B/D (+C/E) | Stage B runs an in-memory `testDataset`; Stage D returns hardcoded snapshot counts (`1069`) with `passed: true`; Stage C/E assert fabricated booleans — no live DB/providers. `runDataIntegrityCheck()` therefore cannot produce trustworthy evidence. |
| `src/app/api/v1/predictions/[id]/provenance/route.ts` | Provenance endpoint asserts `"API-Football fixture linkage verified"` / `"OddsPAPI sharp bookmaker odds snapshot"` as literal strings and falls back to fabricated `canonical-<id>` / `odds: 1.95` values without live verification. |
| `src/lib/simulation/ReplayEngine.ts` (+ `/api/replay`) | Simulation path returns synthetic historical decisions consumed by a production endpoint. |

Out-of-scope for this gate (not provider evidence): `checkout` mock sessions, `daily-digest` mock recipients, `health-snapshot` placeholder Brier, `settle` `GOALS_FALLBACK` (real score fallback), `attribution` in-memory scaffolding.

## 2. Credential Fail-Closed Behavior — `PASS` (verified live + unit)

`src/lib/auth/credentialValidator.ts` throws `[FAIL CLOSED]` for: missing, empty, whitespace/newline, control characters, transcript markers (`Searched for`, `Viewed `, `Ran command`, `Created `, `Tool Use`, …), placeholders (`your_`, `placeholder`, `changeme`, `mock`, `xxxx`), suspiciously short, malformed opaque charset, and malformed JWT structure (Supabase service-role). Never returns a substitute credential; values are never printed.

Live endpoint results (`GET /api/v1/provenance/smoke`, HTTP 503 in every case):

| Scenario | Result |
|---|---|
| `ODDS_PAPI_KEY` missing | `ODDSPAPI_LIVE_AUTH_FAILED` — `Missing credential for ODDS_PAPI_KEY` |
| `ODDS_PAPI_KEY` placeholder | `ODDSPAPI_LIVE_AUTH_FAILED` — `dummy/placeholder value` |
| `ODDS_PAPI_KEY`+`APIFOOTBALL_KEY` valid-format, `SUPABASE_SERVICE_ROLE_KEY` missing | `AUTH_FAILED` — `Missing credential for SUPABASE_SERVICE_ROLE_KEY` |
| All three valid-format, Supabase key rejected (live 401) | `AUTH_FAILED` — `Supabase query rejected: Invalid API key` |

All provider failures (401/403/429/timeout/network) are classified fail-closed (`AUTH_FAILED` / `PROVIDER_UNAVAILABLE` / `ODDSPAPI_LIVE_AUTH_FAILED`); `baseProvider` now surfaces the HTTP status; the native OddsPAPI client classifies `INVALID_KEY`/`RATE_LIMITED`/`QUOTA`/`DEGRADED`/`NETWORK`.

Safe probe (`scripts/probe-credentials-safely.ts`): all credential classes **MISSING** → `FAIL CLOSED`. Transcript-contamination scanner: **no contamination** found (env files contain empty values, not contaminated text).

## 3. API-Football Provenance (3/3 live) — `FAIL` (not verifiable)

No eligible production record was independently verified against a fresh live API-Football response: the API-Football credential is **absent** in this environment, so no live request could be made. The route fail-closes deterministically instead of fabricating evidence. This check CANNOT PASS until a genuine `APIFOOTBALL_KEY` is provisioned.

## 4. OddsPAPI Provenance (3/3 live) — `ODDSPAPI_LIVE_AUTH_FAILED`

OddsPAPI credential is **absent**. The smoke endpoint performs a fresh live OddsPAPI auth/evidence pass only after credential validation, and returns `ODDSPAPI_LIVE_AUTH_FAILED` (no fabricated odds evidence, no marked `VERIFIED_LIVE` on the strength of API-Football alone). Mandatory final status per gate instructions: **`ODDSPAPI_LIVE_AUTH_FAILED`**.

## 5. Provenance Status Semantics — `PASS`

The smoke endpoint distinguishes the minimum taxonomy (Step 5 of the gate), each as a distinct fail-closed state — never a generic boolean:

`VERIFIED_LIVE`, `VERIFICATION_FAILED`, `AUTH_FAILED`, `PROVIDER_UNAVAILABLE`, `RECORD_NOT_FOUND`, `SCHEMA_INVALID`, `PROVENANCE_MISSING` (+ `ODDSPAPI_LIVE_AUTH_FAILED` for the OddsPAPI-specific gate). Verified by `tests/provenance-smoke.test.ts`.

## 6. Zero Mutation — `PASS`

`/api/v1/provenance/smoke` is read-only: it issues `select()`/`maybeSingle()` only (never insert/update/upsert/delete/rpc). Enforced by a source-level test (`tests/provenance-smoke.test.ts`) that rejects any write operator in the route. No records, predictions, fixtures, odds, snapshots, or ledger state are altered.

## 7. Production Endpoint Behavior — `PASS` for fail-closed cases

Valid live credentials: **not testable in this environment** (no genuine credentials). Deterministic invalid/missing credential behavior verified live (see §2): always a deterministic fail-closed status, no fabricated provider response, no synthetic fallback, no database mutation, no credential values or provider internals exposed.

## 8. Automated Checks

| Check | Result |
|---|---|
| `npx tsc --noEmit` | **PASS** (exit 0) |
| `eslint` (changed files) | **PASS** (0 errors; 16 `no-explicit-any` warnings only) |
| `vitest run` (full suite) | **PASS** — 200/202 files passed, 2 skipped, **1554/1554 tests passed** |
| `npx next build` | **PASS** with valid-format credentials present (compile, TypeScript, 221 pages prerendered). Without credentials the build blocks at static prerender with fail-closed `[FAIL CLOSED]` errors — credentials are a hard build-time requirement by design. |

## 9. Exact Failure Reasons (summary)

1. **OddsPAPI credential cannot be verified** → mandatory `ODDSPAPI_LIVE_AUTH_FAILED`.
2. **API-Football credential absent** → API-Football live provenance 3/3 not verifiable.
3. **Supabase service-role credential absent** → `prediction_ledger_v3` eligibility/3-record selection not executable against the live DB.
4. **Synthetic isolation gaps** — production provenance/prediction/ingestion/integrity paths can still reach fabricated evidence (see §1).
5. **No genuine provider credentials were provisioned in this environment** — no credential value is ever printed or substituted.

## Final Decision

`PRODUCTION_PROVENANCE_GATE = FAIL` — with `ODDSPAPI_LIVE_AUTH_FAILED` as the mandatory status.

**Blocked from starting EPIC 57** (backtest, shadow pipeline, model validation, prediction generation) until: genuine OddsPAPI + API-Football + Supabase credentials are provisioned, the §1 synthetic-isolation gaps are remediated, and the live 3/3 API-Football + 3/3 OddsPAPI provenance checks return `VERIFIED_LIVE` with zero mutation.
