# SALMO — DURABLE STATE RECOVERY PLAN

**Sprint:** Production Persistence Recovery · **Date:** 2026-10-02 · **HEAD at time of audit:** `f5ed082`
**Scope:** Production state persistence / read-model recovery ONLY.
**Status:** Phase 0 complete (reconnaissance + plan). No code changed yet.

---

## 0. Mandate & non-goals

This document follows the **Production Durable State Recovery** brief.

Root cause is a **two-layer production state defect**, NOT a scheduler, provider, or model defect.
The controlled production run already proved the engine works:

| Layer | Verdict |
|---|---|
| Vercel Cron | **PASS** |
| DailyPipelineOrchestrator | **PASS** |
| OddsPapi `/v4/odds-by-tournaments` batch | **PASS** |
| Fresh odds retrieval | **PASS** |
| OU prediction generation (70 produced) | **PASS** |
| Quota delta (+3 / cycle) | **PASS** |
| **Persistence** | **FAIL — `/tmp` ephemeral** |
| **Read model** | **FAIL — falls back to git-committed bundle** |
| **Cron observability** | **FAIL — `cron_runs` does not exist** |
| Model / decision engine | **NOT TOUCHED** |

**Explicitly out of scope (and confirmed unnecessary):** model logic, decision thresholds, EV
formula, Kelly staking, AH/OU/BTTS market definitions, OddsPapi authority, provider hierarchy,
Vercel Cron schedule, `.env` values, dependency upgrades, frontend, pricing.

---

## 1. ROOT CAUSE CONFIRMATION (evidence)

### 1.1 Layer 1 — WRITE path is ephemeral on Vercel

Every production state module resolves its path as:

```ts
if (process.env.VERCEL) {
  const os = require('os');
  return path.join(os.tmpdir(), 'handicaplab_<module>.json');   // <-- ephemeral
}
return path.resolve('data/...');                                 // <-- dev only
```

On Vercel, `/tmp` is **per-instance and discarded between invocations**. Writes therefore
succeed (no error is raised) and then silently vanish.

The orchestrator's persistence step (`src/lib/pipeline/dailyOrchestrator.ts:534`) calls:

```ts
DailyPredictionLedgerService.recordPrediction(rec);   // -> /tmp/handicaplab_daily_prediction_ledger.json
```

`DailyPredictionLedgerService` has **no Supabase persistence at all**. This is exactly where the
**70 freshly generated OU predictions were lost** in the controlled run.

### 1.2 Layer 2 — READ model falls back to git-committed build artifacts

`/api/health/pipeline` reads:

```
PipelineFreshnessTelemetry.getTelemetryReport()
  -> CanonicalBetLedgerService.getAllPredictions()
     -> CanonicalBetLedgerService.loadLedger()
        -> /tmp/handicaplab_canonical_prediction_ledger.json   (EMPTY on cold instance)
        -> BUNDLED_CANONICAL_LEDGER                            (git-committed, 550 records)
```

`/api/v1/health/production` reads:

```
PredictionArchiveService.loadArchive()
  -> /tmp/handicaplab_prediction_archive.json   (EMPTY on cold instance)
  -> data/ledger/prediction_archive.json        (git-committed, 3 records)
```

Hence the frozen values are **build-time constants presented as live telemetry**:

| Reported value | Actual provenance |
|---|---|
| `latestOddsIngestion = 2026-09-21T19:05:26.901Z` | `data/ledger/prediction_archive.json` (git, 3 records, all sharing that `oddsTimestamp`) |
| `predictions_total = 550` | `src/lib/ledger/canonicalLedgerData.ts` → `BUNDLED_CANONICAL_LEDGER` |
| `odds_freshness = 260070s` | computed from the same bundled max `oddsTimestamp = 2026-09-29T18:11:15.339Z` |

**This is the defect.** Not ingestion, not quota, not the scheduler.

### 1.3 Layer 3 (additional, discovered) — silently swallowed durable write

`CanonicalBetLedgerService.recordPrediction` (`src/lib/ledger/canonicalBetLedger.ts:240-269`)
*does* attempt a durable `daily_picks` upsert, but wraps it in a background IIFE whose failures are
swallowed:

```ts
} catch (dbErr) {
  console.warn('[CanonicalBetLedgerService] Background Supabase sync notice:', dbErr);
}
```

And the payload violates live `daily_picks` CHECK constraints:

| Column | Constraint in production | Value written | Result |
|---|---|---|---|
| `source` | `CHECK (source IN ('live','backtest'))` | `'HandicapLab-Canonical'` | **violation** |
| `status` | `CHECK (status IN ('PENDING','WON','LOST','PUSH'))` | `PredictionStatus` (`VALUE`/`NO_VALUE`…) | **violation** |

`daily_picks.market_type` **does** accept `BTTS` (migration `...054_add_btts_support.sql`), so that
mapping is fine.

### 1.4 Layer 4 (additional, discovered) — cron observability failure is invisible

`src/lib/services/cronLogger.ts` writes to `cron_runs` using columns
`cron_name, start_time, end_time, records_processed, errors`.

- The `cron_runs` table **does not exist** in production (HTTP 404 / `PGRST205`).
- The only definition in `supabase/migrations/00000000000005_phase5_monetization.sql` uses a
  **different column set** (`job_name, status, error_message, started_at, completed_at,
  duration_ms, metadata`) — so even after creation the writer would not match.

`CronLogger.start()` returns `null` and logs to `console.error` only. **Cron execution is
unobservable.**

---

## 2. PHASE 0 — CURRENT STATE FLOW

```text
Vercel Cron  (1 job: /api/cron/pipeline @ "0 4 * * *")
   |
   v
/api/cron/pipeline/route.ts
   |
   v
DailyPipelineOrchestrator
   |
   +--> PredictionArchiveService.loadArchive()        -> /tmp  (empty)  -> git bundle (3 recs)
   +--> API-Football                                   -> fixtures / results
   +--> OddsPapi /v4/odds-by-tournaments               -> FRESH odds  [WORKS]
   |
   v
Prediction / Decision Engine                          [WORKS — 70 OU generated]
   |
   +--> RunIdentityService.startDailyRun()            -> /tmp/handicaplab_daily_runs.json     [LOST]
   +--> DailyPredictionLedgerService.recordPrediction -> /tmp/..._daily_prediction_ledger.json[LOST]
   +--> CanonicalBetLedgerService.recordPrediction    -> /tmp + best-effort daily_picks        [LOST/SWALLOWED]
   +--> PredictionArchiveService.record*              -> /tmp + prediction_snapshots           [PARTIAL]
   +--> SalmoSyncService                              -> /tmp/..._salmo_synced_decisions.json  [LOST]
   +--> CronLogger.start()                            -> cron_runs (MISSING TABLE)             [INVISIBLE]
   |
   v
cold instance / next invocation  ->  /tmp GONE
   |
   v
/api/health/pipeline + /api/v1/health/production
   -> read /tmp (empty) -> fall back to git-committed bundles
   -> report 2026-09-21 timestamp and 550 predictions as if live
```

---

## 3. PHASE 0 — AFFECTED MODULE CLASSIFICATION

Classification key: **A** = must become durable · **B** = may remain ephemeral scratch/cache ·
**C** = read model requiring migration · **D** = observability only.

| # | Module | Ephemeral path | Class | Rationale |
|---|---|---|---|---|
| 1 | `src/lib/pipeline/dailyPredictionLedger.ts` | `handicaplab_daily_prediction_ledger.json` | **A** | Owns the 70 lost OU predictions. **No durable sink at all.** |
| 2 | `src/lib/pipeline/runIdentity.ts` | `handicaplab_daily_runs.json` | **A + D** | Run identity/lifecycle; required for "latest successful run". |
| 3 | `src/lib/archive/predictionArchiveService.ts` | `handicaplab_prediction_archive.json(.jsonl)` | **A + C** | Canonical archive + daily-picks projection. **Root of frozen `latestOddsIngestion`.** |
| 4 | `src/lib/ledger/canonicalBetLedger.ts` | `handicaplab_canonical_prediction_ledger.json` | **A + C** | Backs `predictions_total=550`. **Bundled fallback = the masquerade source.** |
| 5 | `src/lib/services/canonicalFixtureFreshnessGate.ts` | `handicaplab_canonical_match_registry.json` | **A + C** | Backs `fixtures_total` / `fixtures_stale`. |
| 6 | `src/lib/services/canonicalFixtureRegistry.ts` | `handicaplab_canonical_fixtures.json` | **A** | Canonical fixture identity (join key for everything). |
| 7 | `src/lib/pipeline/salmoSyncService.ts` | `handicaplab_salmo_synced_decisions.json` | **A** | SALMO sync status / last-sync timestamp are health inputs. |
| 8 | `src/lib/pipeline/salmoPerformanceSyncService.ts` | `handicaplab_salmo_synced_performance.json` | **A** | SALMO performance sync (same downstream as #7). |
| 9 | `src/lib/ledger/durableLedgerStore.ts` | `handicaplab_high_confidence_ledger.json` | **A** | Named "Durable" but file-first; already dual-writes some tables. |
| 10 | `src/lib/publishing/productionPublishingEngine.ts` | `handicaplab_canonical_published_signals.json` | **A** | Published-signal state drives public picks. |
| 11 | `src/lib/services/cronLogger.ts` | Supabase `cron_runs` (missing) | **D** | Cron observability; currently silently no-ops. |
| 12 | `src/lib/providers/providerHealth.ts` | `handicaplab_provider_health_<p>.json` | **B / D** | Diagnostic health cache; low criticality. |
| 13 | `src/lib/pipeline/dailyReport.ts` | tmpdir / `data/verification/daily` | **B** | Verification artifact. Useful, not authoritative. |
| 14 | `src/lib/crons/distributedCronLease.ts` | tmpdir / `data/test_cache/cron_leases` | **B** | Concurrency lease; single daily cron, low risk. |
| 15 | `src/lib/providers/oddspapiQuotaAllocator.ts` | `handicaplab_oddspapi_quota_allocator_state.json` | **B** | Durable quota authority is already Supabase (`quota_state` + `reserve_quota` RPC). This is a secondary/legacy allocator. |
| 16 | `src/lib/providers/theOddsApiQuotaManager.ts` | `handicaplab_the_odds_api_quota_state.json` | **B** | Legacy TheOddsAPI — **not** the production odds authority. Leave as-is. |
| 17 | `src/lib/api/cache.ts` | `/tmp/cache/api-football` | **B** | Pure response cache. Correctly ephemeral. |
| 18 | `src/lib/api/rateLimiter.ts` | `/tmp/cache/api-football` | **B** | Pure rate-limit cache. Correctly ephemeral. |

**Totals — A: 10 modules · B: 6 modules · C: 5 read paths · D: 2 (overlapping).**

> ⚠ Modules 12–18 plus both `/tmp/cache` paths **must NOT be blindly rewritten.** They are
> legitimately ephemeral. **Modules 1–10 are the durability surface.**

---

## 4. PHASE 2 — DATABASE RECONNAISSANCE (production, live-probed 2026-10-02)

### 4.1 Exists and reusable — **DO NOT recreate**

| Table | Rows | Key columns relevant here |
|---|---|---|
| `daily_picks` | 30 | `fixture_id UUID`, `market_type` (ASIAN_HANDICAP/OVER_UNDER/MONEYLINE/**BTTS**), `prediction`, `model_probability`, `fair_odds`, `market_odds`, `market_bookmaker`, `edge_pct`, `confidence`, `verdict`, `status`, `clv`, `source`, `odds_snapshot_id`, `prediction_id`, `created_at`. **`UNIQUE (fixture_id, market_type, source)` → idempotency key already exists.** |
| `predictions` | 490 | `match_id`, `market_type`, `prediction`, `closing_odds`, `model_version`, `generated_at`, `prediction_timestamp`, `clv`, `confidence`, `market_odds`, `kelly_fraction`, `expected_value`, `selection`, `model_probability`, `fair_odds`, `entry_odds`, `source_type`, `data_status` |
| `public_prediction_ledger` | 13 | `prediction_number BIGSERIAL`, `fixture_id TEXT`, `market`, `selection`, `model_prob`, `ci_lower`, `ci_upper`, `model_fair_odds`, `bookmaker_odds`, `prob_edge`, `expected_value`, `recommendation`, `model_version`, `feature_version`, `prediction_hash`, `dataset_hash`, `verification_status`, `source` |
| `odds_snapshots` | 1041 | `fixture_id`, `bookmaker`, `market`, `line`, `odds`, `captured_at`, `provider`, `snapshot_label`, `snapshot_time`, `btts_yes_odds`, `btts_no_odds`. **`UNIQUE (fixture_id, bookmaker, snapshot_label)`** |
| `matches` | 756 | `home_team`, `away_team`, `league`, `kickoff`, `status`, `pipeline_state`, `source_type`, `data_status` |
| `quota_state` + `quota_reservations` | — | **Durable quota already implemented** via `reserve_quota` / `confirm_quota` / `rollback_quota` RPCs (migration `20260812000000_quota_state.sql`). **No second quota system may be added.** |
| `live_validation_job_runs` | **0** | `job_name*`, `status*`, `started_at*`, `finished_at`, `duration_ms`, `items_discovered`, `items_processed`, `items_failed`, `error_message`, `correlation_id*`, `created_at*` — **best fit for cron / run observability.** |
| `pipeline_events` | 0 | `fixture_id UUID NOT NULL REFERENCES matches(id)`, `step`, `new_state`, `event`, `duration_ms`, `success`, `metadata` — **fixture-scoped, NOT suitable for run-level observability.** |
| `prediction_snapshots` | 268 | `fixture_id`, `model_version`, `prediction_timestamp`, `idempotency_key`, `input_hash`, `chain_hash`, `prediction`, `match_id`, `market`, `selection`, `line`, `odds`, `source_system` |
| `public_settlements`, `performance_ledger`, `track_record`, `archived_daily_picks`, `wh_predictions`, `value_recommendations`, `health_events`, `health_snapshots`, `wh_pipeline_observability` | 0–var | Available for reuse. |

### 4.2 Missing in production

| Table | Status | Action |
|---|---|---|
| `cron_runs` | **HTTP 404 (`PGRST205`)** | **Reuse `live_validation_job_runs`** (no DDL path available). |
| `pipeline_execution_logs` | 404 | Not needed. |
| `pipeline_diagnostics` | 404 | Not needed. |

### 4.3 DDL capability — RESTRICTED (this drives the reuse-only strategy)

- No `exec_sql` / `exec` / `run_sql` RPC exists (all HTTP 404).
- Supabase CLI not installed locally; `npx supabase` unavailable offline.
- **Conclusion: no programmatic DDL.** Creating a table would require a manual SQL-editor step,
  breaking reproducibility and the "one verified deployment" gate.
- → **Strategy: REUSE existing tables only. ZERO new tables. ZERO migrations.**

### 4.4 Row-Level Security

`daily_picks`, `odds_snapshots`, `track_record`, `backtest_summary` have RLS enabled with
`FOR SELECT USING (true)` read policies. **`service_role` bypasses RLS**, so the production
pipeline can INSERT/UPDATE without new policies. **No RLS change required.**

### 4.5 Durable freshness baseline (BEFORE — measured 2026-10-02)

| Table | Max timestamp | Column |
|---|---|---|
| `odds_snapshots` | **2026-09-19T13:30:02Z** | `captured_at` / `snapshot_time` |
| `daily_picks` | **2026-09-18T18:46:57Z** | `created_at` |
| `public_prediction_ledger` | **2026-09-21T19:05:41Z** | `created_at` |
| `prediction_snapshots` | 2026-08-13T01:14:16Z | `created_at` |
| `predictions` | 2026-08-05T10:13:29Z (synthetic) | `created_at` |
| `live_validation_job_runs` | *(0 rows)* | — |

**Durable odds are 13 days stale.** Nothing durable has been written since mid-September. This
independently confirms Layer 1 (ephemeral writes) and Layer 2 (bundle fallback).

---

## 5. PHASE 1 — TARGET ARCHITECTURE

Production durable state must follow:

```text
Vercel Cron
   |
   v
DailyPipelineOrchestrator
   |
   +--> API-Football   (fixtures / results)
   +--> OddsPapi /v4/odds-by-tournaments   (sole production odds authority)
   |
   v
Prediction / Decision Engine        [UNCHANGED]
   |
   v
SUPABASE DURABLE PRODUCTION STATE   [ONLY THIS LAYER IS ADDED/FIXED]
   |
   +--> daily_picks                 (per-pick, UNIQUE idempotency key)
   +--> predictions                 (rich prediction rows)
   +--> public_prediction_ledger    (canonical / audit ledger)
   +--> odds_snapshots              (provenance of odds used)
   +--> prediction_snapshots        (already wired)
   +--> live_validation_job_runs    (run identity + cron observability)
   |
   v
Health / read endpoints  ->  read DURABLE state, NEVER build-time bundles
```

### 5.1 Invariants

1. On Vercel, durable Supabase state is the **only authoritative** production read model.
2. `/tmp` remains legal **only** for caches, leases, and local research scratch.
3. Git-tracked JSON/TS bundles may remain as **development fixtures/fallbacks** but **MUST NOT**
   be served as current production freshness.
4. Production source of truth must never depend on `/tmp`, build artifacts, git-tracked prediction
   JSON, or embedded TypeScript ledger data.
5. **Fail closed:** if durable persistence fails in production, the run is marked `FAILED` /
   `DEGRADED`. **No silent fallback to `/tmp` claiming success.**
6. Quota: `quota_state` + `reserve_quota` RPC remain the **single** quota authority. No second
   quota system.

---

## 6. PHASE 3/4/5 — IMPLEMENTATION DESIGN

### 6.1 New module — `src/lib/durability/productionDurableState.ts`

A single, small, purpose-built adapter. **No new tables. No new provider. No quota logic.**

Responsibilities:

| Function | Target table | Purpose |
|---|---|---|
| `isDurableStateRequired()` | — | `true` on Vercel (`process.env.VERCEL` or `VERCEL_ENV`). Test/local → `false`. |
| `persistDailyPredictions(records, runId)` | `daily_picks` | Upsert one row per prediction. Returns `{attempted, written, failed, errors[]}`. |
| `persistRunRecord(run)` | `live_validation_job_runs` | Run identity + cron observability (`correlation_id = runId`). |
| `readLatestDurableState()` | `daily_picks`, `odds_snapshots`, `public_prediction_ledger`, `live_validation_job_runs` | Returns durable freshness: latest odds ts, latest prediction ts, counts, last run status. |
| `getDurableStateHealth()` | — | `{ available, degraded, reason }` for DEGRADED/UNAVAILABLE reporting. |

**`daily_picks` field mapping (constraint-valid — this is where the current code is broken):**

| `daily_picks` column | Source | Note |
|---|---|---|
| `fixture_id` | `rec.canonicalMatchId` | canonical UUID |
| `league` | `rec.competition` | |
| `home_team` / `away_team` | `rec.homeTeam` / `rec.awayTeam` | |
| `kickoff_utc` | `rec.kickoffTimestamp` | |
| `market_type` | `AH→ASIAN_HANDICAP`, `OU→OVER_UNDER`, `BTTS→BTTS` | BTTS allowed by migration `...054` |
| `prediction` | `rec.selection` | |
| `model_probability` | `rec.calibratedProbability` | |
| `fair_odds` | `1 / calibratedProbability` | |
| `market_odds` | `rec.odds` | |
| `market_bookmaker` | `'Pinnacle'` | AGENTS.md bookmaker hierarchy |
| `edge_pct` | `rec.edge * 100` | |
| `confidence` | `round(rec.confidenceScore)` | |
| `verdict` | `HIGH→LAYAK`, `MEDIUM→PANTAU`, else `LEWATI` | **fixes CHECK violation** |
| `status` | `'PENDING'` | **fixes CHECK violation** (was `VALUE`/`NO_VALUE`) |
| `source` | `'live'` | **fixes CHECK violation** (was `HandicapLab-Canonical`) |
| `data_age_ms` | `predictionTs − oddsTs` | **odds freshness provenance** |
| `reasoning` | structured JSON string: `{line, oddsTimestamp, bookmaker, market, modelVersion, runId, predictionId}` | **preserves line + odds-timestamp + provider identity without DDL** |
| `created_at` | `rec.predictionTimestamp` | |

Conflict target: **`fixture_id, market_type, source`** → **idempotent by construction.**

### 6.2 Orchestrator integration — fail-closed

In `src/lib/pipeline/dailyOrchestrator.ts`, **phase 10** (`phase_10_persist_ledger`, ~line 533)
gains an explicit durable step after the existing local `recordPrediction` loop:

```ts
const durable = await ProductionDurableState.persistDailyPredictions(generatedLedgerRecords, runId);
if (ProductionDurableState.isDurableStateRequired() && durable.failed > 0) {
  // fail closed — create durable "no silent loss" signal
  RunIdentityService.updateStage(runId, 'phase_10_persist_ledger', { status: 'PARTIAL', ... });
}
```

**No change** to how records are *generated*, gated, or scored. Only an additive sink.

### 6.3 Phase 4 — Read model repair (no build artifact as live)

| Endpoint | Change |
|---|---|
| `/api/health/pipeline` | When on Vercel, derive `predictions_total`, `odds_freshness_seconds`, `salmo_last_sync_timestamp` and run status from `ProductionDurableState.readLatestDurableState()`. Report `dataSource: 'DURABLE'`. **Do not** let `BUNDLED_CANONICAL_LEDGER` masquerade as freshness. |
| `/api/v1/health/production` | Same: derive telemetry timestamps from durable reads; expose `dataSource` and `degraded` explicitly. |
| `PipelineFreshnessTelemetry` | Gains an optional durable overlay so a bundled fallback is **labelled** `BUNDLED_FALLBACK`, never `live`. |

If durable storage is unreachable → report **`DEGRADED` / `UNAVAILABLE`**, never a historical
build artifact presented as current.

### 6.4 Phase 5 — Cron observability (reuse, do not create)

`CronLogger` currently targets the non-existent `cron_runs` with a column set that also disagrees
with the only existing migration. Fix by routing to the **existing, empty**
`live_validation_job_runs` table:

| `live_validation_job_runs` column | Value |
|---|---|
| `job_name` | `'daily-pipeline'` (or the cron name) |
| `status` | `'RUNNING'` → `'SUCCESS'` / `'FAILED'` |
| `started_at` / `finished_at` | ISO timestamps |
| `duration_ms` | computed |
| `items_processed` | prediction count |
| `items_failed` | failure count |
| `error_message` | sanitized category (existing `sanitizeAndCategorizeError`) |
| `correlation_id` | `runId` |

**A swallowed failure must become visible.** `CronLogger.start/end` failures are surfaced in the
run summary, not only `console.error`.

---

## 7. EXACT FILES THAT WILL CHANGE

### 7.1 New files

| File | Purpose |
|---|---|
| `src/lib/durability/productionDurableState.ts` | Durable persistence + durable read adapter. |
| `tests/durability/production-durable-state.test.ts` | Phase 6 tests A–I. |
| `docs/providers/SALMO_DURABLE_STATE_RECOVERY_PLAN.md` | This document (Phase 0 deliverable). |

### 7.2 Modified files (minimal, additive)

| File | Change | Risk |
|---|---|---|
| `src/lib/pipeline/dailyOrchestrator.ts` | Add durable persist call in phase 10 + fail-closed signal. | Low (additive) |
| `src/app/api/health/pipeline/route.ts` | Prefer durable state on Vercel; expose `dataSource`. | Medium |
| `src/app/api/v1/health/production/route.ts` | Prefer durable state on Vercel; expose `dataSource`/`degraded`. | Medium |
| `src/lib/telemetry/pipelineFreshnessTelemetry.ts` | Label bundled fallback as `BUNDLED_FALLBACK`. | Low |
| `src/lib/services/cronLogger.ts` | Retarget `cron_runs` → `live_validation_job_runs`; surface failures. | Low |
| `src/lib/ledger/canonicalBetLedger.ts` | Fix constraint-violating `daily_picks` payload; stop swallowing failures. | Low |

### 7.3 Files explicitly NOT changed

`dailyPredictionLedger.ts` (local behaviour retained), `predictionArchiveService.ts` (local
behaviour retained), model/decision modules, `quotaManager`, `providerHealth`, `/tmp` cache modules,
`vercel.json`, `.env*`, `data/golden/europe/**`.

---

## 8. MIGRATION RISK

| Risk | Assessment | Mitigation |
|---|---|---|
| Schema migration needed | **NONE — zero DDL.** All target tables already exist in production. | Reuse-only strategy (§4.3). |
| Data backfill | **NONE.** Existing rows untouched. New rows additive. | Upsert only on new conflict keys. |
| FK integrity | `daily_picks.fixture_id` has **no FK** to `matches` (plain `UUID NOT NULL`). | Verified in migration `...053`. |
| CHECK-constraint violations | **A live defect today.** Current payload violates `source` + `status`. | New mapping validated against `...053` + `...054`. |
| RLS blocking writes | `service_role` bypasses RLS. | No policy change. |
| Idempotency | Existing `UNIQUE (fixture_id, market_type, source)`. | Upsert → no duplicates on retry. |
| Quota behaviour change | **NONE.** No new provider call. Durable writes are Supabase-only. | Expected delta stays **+3 / cycle**. |
| Read-model regression | Health routes change source on Vercel only; local/test untouched. | Route guard + tests E/F. |
| `data/golden/europe` mutation | Not touched. | Byte-identity assertion (test I). |

**Blocking constraint:** no DDL execution path exists. Therefore `cron_runs` **cannot** be created
as part of this change; `live_validation_job_runs` is used instead. A future dedicated `cron_runs`
must ship as a migration applied via the Supabase SQL editor.

---

## 9. ROLLBACK STRATEGY

No schema change and no model change are involved → rollback is a pure code revert.

1. `git revert <commit>` (or `git reset --hard f5ed082`) → previous behaviour returns.
2. No database rollback required (no DDL, no destructive DML).
3. Durable rows written by the new path remain valid `daily_picks` rows, harmless to the old code
   path (old path reads `/tmp` + bundles and ignores them).
4. If only the read model misbehaves, revert §7.2 rows 2–4 independently — the durable write path
   can remain active without the read overlay.
5. Vercel: instant rollback to the previous deployment alias.

---

## 10. PHASE 6 — TEST ISOLATION PLAN

| ID | Test | Assertion |
|---|---|---|
| A | Production path does not use `os.tmpdir()` as durable storage | On `VERCEL=1`, the durable sink resolver never returns a tmpdir path. |
| B | Successful production run persists durable state | `persistDailyPredictions()` upserts `daily_picks`; `written === attempted`. |
| C | Retry is idempotent | Two identical calls → same conflict key → one logical row; no duplicates. |
| D | Failed persistence fails/degrades explicitly | Forced Supabase error on `VERCEL=1` → `failed > 0`, run marked non-`SUCCESS`. |
| E | Health endpoint reads durable state | On `VERCEL=1`, health reports `dataSource === 'DURABLE'`. |
| F | Build-time fallback cannot masquerade as live | On `VERCEL=1`, bundled fallback is labelled `BUNDLED_FALLBACK` / degraded, never `live`. |
| G | `live_validation_job_runs` records execution status | `CronLogger.start/end` write `job_name`, `status`, `started_at`, `finished_at`, `correlation_id`. |
| H | Existing research/test isolation intact | Test mode resolves to `data/test_ledger/**`, never Supabase or tmpdir. |
| I | `data/golden/europe` byte-identical | Hash comparison before/after. |

Test mode must **never** hit Supabase. `NODE_ENV === 'test'` short-circuits every durable call.

---

## 11. MODEL / DECISION CONFLICT DECLARATION

> **This implementation requires NO change to model logic, decision logic, OddsPapi authority,
> market definitions, provider architecture, thresholds, EV calculation, Kelly staking, or CLV
> logic.**
>
> Per the brief's STOP condition: **no conflict — proceed.**

The change is strictly confined to **where state is written** and **what the read model is allowed
to present as current**.

---

## 12. DEPLOYMENT GATES

Deployment is allowed ONLY if ALL are true:

- [ ] TypeScript `tsc --noEmit` EXIT 0
- [ ] targeted tests 100% PASS (`tests/durability/`)
- [ ] affected pipeline tests PASS
- [ ] no new unrelated test failures
- [ ] no secret leakage
- [ ] no `.env` modification
- [ ] `data/golden/europe` byte-identical
- [ ] no model changes
- [ ] no decision-engine changes
- [ ] no threshold changes
- [ ] OddsPapi remains sole production odds authority
- [ ] quota path remains 3 calls/cycle
- [ ] durable persistence verified
- [ ] health endpoint reads durable state
- [ ] cron observability verified
- [ ] idempotency verified
- [ ] rollback path documented

If ANY gate fails: **DO NOT DEPLOY.**

---

## 13. ACCEPTANCE (Phase 10)

```text
OLD:  Cron -> Pipeline -> OddsPapi -> Predictions -> /tmp -> LOST -> build artifact -> FALSE freshness
NEW:  Cron -> Pipeline -> OddsPapi -> Predictions -> SUPABASE DURABLE STATE -> REAL READ MODEL -> REAL FRESHNESS
```

- [ ] latest odds timestamp reflects the controlled run
- [ ] latest prediction timestamp reflects the controlled run
- [ ] prediction count reflects newly persisted records
- [ ] cron run is observable
- [ ] restart / cold instance does not erase production state
- [ ] health endpoints do not revert to 2026-09-21 build data
- [ ] one retry does not duplicate records
- [ ] quota remains within 250/month
- [ ] OddsPapi remains sole production odds provider

---

## 14. IMPLEMENTATION VERIFICATION RECORD (2026-10-02)

### 14.1 Files changed (working tree)

| File | Status |
|---|---|
| `src/lib/durability/productionDurableState.ts` | **NEW** — durable persistence + durable read adapter |
| `tests/durability/production-durable-state.test.ts` | **NEW** — Phase 6 tests A–I (18 tests) |
| `docs/providers/SALMO_DURABLE_STATE_RECOVERY_PLAN.md` | **NEW** — this Phase 0 artifact |
| `src/lib/pipeline/dailyOrchestrator.ts` | durable persist in phase 10 + durable run record + fail-closed status |
| `src/app/api/health/pipeline/route.ts` | durable read model + `persistence` block + `bundledFallbackInUse` |
| `src/app/api/v1/health/production/route.ts` | durable read model + `DURABLE_STATE_UNAVAILABLE` contradiction |
| `src/lib/services/cronLogger.ts` | retargeted `cron_runs` → `live_validation_job_runs`; no longer swallowed |
| `src/lib/ledger/canonicalBetLedger.ts` | constraint-valid `daily_picks` payload; failures now logged loudly |
| `tests/phase35.test.ts`, `tests/phase35.2.test.ts` | updated to the corrected observable contract (assertions unchanged) |

**Zero new tables. Zero migrations. Zero DDL. Zero model/decision/provider changes.**

### 14.2 Gate results

| Gate | Result |
|---|---|
| TypeScript `tsc --noEmit` | **EXIT 0** |
| New Phase 6 suite | **18 / 18 PASS** |
| Targeted affected suites (odds-integrity, data-quality, distributed-cron-lease, dataSafety, durability) | **48 / 48 PASS** |
| Full suite vs stashed baseline | baseline **22 failed / 326 passed** → now **21 failed / 327 passed** |
| **New test failures introduced** | **ZERO** (verified by FAIL-file diff) |
| `data/golden/europe` byte-identical | **PASS** (asserted in suite `afterAll`; absent from `git status`) |
| `.env*` modified | **NO** |
| OddsPapi authority changed | **NO** — no provider code touched |
| Quota logic changed | **NO** — no provider call added; `quota_state` RPC remains sole authority |
| Model / decision / threshold / EV / Kelly / CLV changed | **NO** |

### 14.3 Non-destructive production schema validation

| Check | Result |
|---|---|
| `daily_picks` × 20 mapped columns resolve | **HTTP 200 — all exist** |
| `live_validation_job_runs` × 10 mapped columns resolve | **HTTP 200 — all exist** |
| Existing `daily_picks.source` distinct values | **`live`** (only) |
| Existing `daily_picks.status` distinct values | **`PENDING`** |
| Existing `daily_picks.verdict` distinct values | `LAYAK`, `PANTAU` |
| Existing `daily_picks.market_type` distinct values | `ASIAN_HANDICAP`, `BTTS`, `OVER_UNDER` |
| Existing `daily_picks.market_bookmaker` | `Pinnacle` |

> **Corroboration of §1.3.** Production `daily_picks.source` contains **only** `'live'`.
> The legacy writer supplied `'HandicapLab-Canonical'`, which violates
> `CHECK (source IN ('live','backtest'))`. Since no such row exists, **every** canonical
> durable write was rejected and silently swallowed — independently confirming Layer 3.

### 14.4 Defect found inside this change (self-audit)

A temporal-dead-zone bug was caught by the new suite: `readLatestDurableState` referenced its
own destructuring target (`nowIso`) inside the `Promise.all` closure, so the `matches` count
query threw, was swallowed by `try/catch`, and returned `0`. Fixed to use `capturedAtUtc`.
Recorded here because it is exactly the class of silent-degradation defect this recovery targets.

### 14.5 Not yet executed (requires explicit authorisation)

| Phase | Status | Reason |
|---|---|---|
| Phase 7 — controlled live run | **NOT RUN** | Consumes real OddsPapi quota (+3) and writes to the production database. Awaiting explicit go-ahead. |
| Phase 9 — production deployment | **NOT DONE** | Brief mandates an explicit deployment gate; no push/deploy performed. |
| Phase 10 — production acceptance | **BLOCKED** | Depends on Phase 7 + 9. |

**Current state: implemented, unit/integration-verified, regression-free, schema-validated — but
NOT deployed and NOT yet exercised against live durable storage.**
