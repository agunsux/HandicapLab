# API_FOOTBALL_AUDIT.md

**Scope:** HandicapLab API-Football integration — forensic audit (Phase 0).
**Method:** static repository inspection only (no writes to production code, no provider calls).
**Account model:** ONE authorized API-Football account, Pro plan ($19/mo, 7,500 req/day).
**Key policy:** canonical env var `APIFOOTBALL_KEY` (server-only). Legacy alias `API_FOOTBALL_KEY` is accepted for backward compatibility during migration only.

> This report never prints secret values. Any exposed credential is shown as `REDACTED`.

---

## 1. Canonical provider configuration

| Item | Value | Location |
|---|---|---|
| Base URL | `https://v3.football.api-sports.io` | `src/lib/data/providers/core/config.ts:55`, `src/lib/apis/apifootball.ts:451`, `src/lib/api/apiFootball.ts:22` |
| Auth header | `x-apisports-key` | all clients |
| Canonical env var | `APIFOOTBALL_KEY` | `src/lib/utils/envValidator.ts:6`, `src/lib/data/providers/core/config.ts:56` |
| Legacy alias | `API_FOOTBALL_KEY` | read in ~20 sites (migration debt) |
| Plan | **Pro: hard 7,500/day, soft 6,000/day** | intended by `scripts/verify/production-quota-verification.ts:266-267` |
| Actual code default | **Custom1500: hard 1,500,000/day** | `src/lib/providers/quotaPolicy.ts:100-110` — **MISMATCH / non-compliant** |
| Rate limit (min) | 10 req/min | `src/lib/data/providers/core/config.ts:57` |

The quota policy default (1.5M/day) contradicts both the Pro contract and the project's own production verification script (7,500/6,000). Under the current default the quota manager would never protect the Pro allowance. **This is a P0 compliance defect.**

## 2. Provider access surfaces (who can reach API-Football)

### 2.1 Canonical, quota-aware client (GOOD)
`src/lib/apis/apifootball.ts` → `globalGateway.fetch()` (`src/lib/providers/providerGateway.ts`) → `quotaManagerV4` (Supabase RPC) + in-memory cache + in-flight dedup → `fetch`.

Callers (server-only):
- `src/lib/crons/fixtureDiscovery.ts`, `historicalIngestor.ts`, `t60Snapshot.ts`
- `src/lib/config/leagueRegistry.ts`, `src/lib/ingestion/globalIngestionEngine.ts`
- `src/lib/services/upcomingFixturesService.ts`, `src/lib/services/etl/historicalImporter.ts`
- `src/lib/pipeline/dailyAhShadowPipeline.ts`
- `src/lib/apis/results.ts`
- `src/app/api/cron/{generate-signals,settle,t60-snapshot}/route.ts`
- `src/app/api/admin/test-competition-feed/route.ts`
- `src/lib/api/providers/apiFootball.ts` (provider abstraction wrapper)
- `src/services/api.ts` `apiFootball` helper (goes through `globalGateway`) ✅

### 2.2 Gateway-quota-aware adapters (GOOD)
- `src/lib/providers/apiFootballProvider.ts` (`BaseProvider.fetchWithQuota` → `globalGateway`) — used by `src/lib/providers/orchestrator.ts`.
- `src/lib/api/providers/apiFootball.ts` (via canonical client).

### 2.3 Bypass paths that reach API-Football WITHOUT quota/dedup (DEFECTS)
| Path | Transport | Quota | Dedup | Used by |
|---|---|---|---|---|
| `src/lib/api/apiFootball.ts` (legacy) | direct `fetch` + file cache + file rate limit | ❌ | file cache only | `src/lib/data/historicalDataFetcher.ts:72,100,108`, ~8 scripts |
| `src/lib/data/providers/apiFootball/client.ts` | `HttpClient` (own cache/limiter/circuit) | ❌ | in-process only | `src/lib/data/providers/apiFootball/provider.ts` → `src/lib/closing-odds/CaptureEngine.ts` |
| `src/lib/warehouse/ingestion/apiFootballProvider.ts` | `HttpClient` | ❌ | in-process only | `src/lib/warehouse/providerRegistry.ts`, `src/scripts/ingestPhase1Core.ts` |
| `src/lib/providers/canonicalHealth.ts` | direct `fetch('/status')` | ❌ | ❌ | health endpoints |
| `src/services/api.ts` `apiFootball.get` | `globalGateway` ✅ | ✅ | ✅ | service layer |
| ~18 `scripts/**` + `src/scripts/**` probes | direct `fetch`/`axios` | ❌ | ❌ | research/probes |

### 2.4 Duplicate-client summary
There are **4 distinct API-Football transport implementations**: `apis/apifootball.ts` (canonical), `api/apiFootball.ts` (legacy), `data/providers/apiFootball/client.ts` (HttpClient), `warehouse/ingestion/apiFootballProvider.ts` (HttpClient). This violates the single-gateway requirement. Two of them (legacy + data/provider client) are reachable from production code.

## 3. Execution environments
- **Vercel serverless (Production/Preview):** Next.js Route Handlers under `src/app/api/**` + Vercel Cron (`vercel.json` — 7 cron paths, incl. `ah-shadow-pipeline`, `discovery`).
- **Node scripts (local/ops):** `tsx src/scripts/*`, `scripts/*` (research, ingestion, probes).
- **Browser:** no direct provider calls found; `src/services/api.ts` hard-guards `typeof window !== 'undefined'` → throws `PROVIDER_ACCESS_DENIED`.

## 4. Cron / scheduler paths
`vercel.json:3-32` → `/api/cron/discovery`, `/odds`, `/enrichment`, `/settlement`, `/predict`, `/update-results`, `/ah-shadow-pipeline`. Additional cron routes exist on disk without a `vercel.json` schedule (t60-snapshot, generate-signals, settle, etc.) and may be triggered manually/admin.

## 5. Environment variables
- Read canonical + legacy alias: `APIFOOTBALL_KEY`, `API_FOOTBALL_KEY`.
- Optional: `APIFOOTBALL_BASE_URL` (`src/lib/apis/apifootball.ts:451`).
- Quota overrides: `API_FOOTBALL_DAILY_HARD_LIMIT`, `API_FOOTBALL_DAILY_SOFT_LIMIT`, `QUOTA_APIFOOTBALL_DAILY`.
- **No `NEXT_PUBLIC_APIFOOTBALL*` or `VITE_APIFOOTBALL*` reads exist in `src/`** (verified). Naming only appears in scanner allowlists `scripts/scan-env-contamination.ts` and `scripts/probe-credentials-safely.ts`.

## 6. Retry logic
| Location | Behavior | Assessment |
|---|---|---|
| `src/lib/retry.ts` | bounded exponential backoff + full jitter, max 3 | ✅ acceptable |
| `src/lib/http/HttpClient.ts:147-168` | `retry()` around fetch, retries 429/503/504/network | ✅ bounded; uses shared backoff |
| `src/lib/apis/apifootball.ts:487-589` | manual `for attempt 1..3`, fixed backoff `10s*attempt` (429) / `5s*attempt` (5xx), **no jitter, ignores `Retry-After`** | ⚠️ needs jitter + `Retry-After` |
| `src/lib/api/apiFootball.ts` | **no retry** | ⚠️ no circuit / no backoff |
| `scripts/gate1_coverage_probe.ts` | custom per-request retry | tooling only |

## 7. Caching
| Layer | TTL | Notes |
|---|---|---|
| `ProviderGateway.memoryCache` | per-call `cacheTtlMs`, default 0 (disabled) | canonical client passes 1h; `services/api.ts` 1h / 1m live |
| `HttpClient` `Cache` | 30s default (apiFootball client) | separate cache |
| `ApiCache` (file, `/tmp` on Vercel) | none (no TTL/expiry) | legacy; unbounded staleness |
| `apiCache` file cache | none | legacy |
- Gateway cache key = raw URL string (`providerGateway.ts:47-49`) → **query-param order is NOT normalized** (`?league=39&season=2026` ≠ `?season=2026&league=39`) → duplicate calls. **P0 defect (Phase 4).**
- `Cache.buildKey` (HttpClient) *does* sort query params (`src/lib/http/Cache.ts:113-122`).

## 8. Rate limiting
- **Canonical path:** fixed 7s inter-request delay in `apis/apifootball.ts:454-462` (single-process, not distributed). No concurrency cap. No 429-driven cooldown.
- **Gateway:** **no rate limiter.**
- `src/lib/http/RateLimiter.ts` token bucket — used only by the bypass HttpClient clients.
- `src/lib/api/rateLimiter.ts` — hardcoded `maxRequestsPerDay = 100` (Free-tier assumption) + 1.5s delay; file-based (per-instance on serverless). **Stale/wrong for Pro.**
- `src/lib/data-platform/rateLimiter.ts` — separate implementation.
- No distributed/atomic rate limiting exists under serverless fan-out.

## 9. Quota accounting
- `quotaManagerV4.ts` — atomic `reserve/confirm/rollback` via Supabase RPC; `cleanupStaleReservations` for crashed reservations. ✅
- `providerGateway` confirms quota even on 4xx/5xx (conservative over-accounting). Note `_fetchInternal` calls `confirmQuota` but does **not await/verify** rollback correctness on circuit-open.
- Stale reservations cleaned by `cleanup_stale_reservations` RPC (`staleMinutes=5` default) — **no verified scheduled caller** in `vercel.json`.
- Daily reset is UTC; provider reset is UTC — aligned.

## 10. Provider health / circuit breaking
- `src/lib/http/CircuitBreaker.ts` (CLOSED/OPEN/HALF_OPEN) exists and is wired **only** to the bypass HttpClient paths.
- **Canonical gateway has no circuit breaker** → failures can be retried by every caller.
- The required states `ACTIVE / PAUSED / FAILED / DISABLED` are **not implemented** for API-Football. `ProviderHealthStatusEnum` (`canonicalHealth.ts`) uses a different vocabulary (NOT_CONFIGURED/CONFIGURED/AUTH_FAILED/API_UNAVAILABLE/AUTHENTICATED/DATA_AVAILABLE).

## 11. Data provenance
- `src/lib/dataProvider.ts`? Provenance gate exists (`src/app/api/v1/provenance/smoke/route.ts`, `PRODUCTION_PROVENANCE_GATE_REPORT.md`). Synthetic fixtures are quarantined to `tests/fixtures/synthetic.ts`.
- Gateway responses carry **no provenance metadata** (`provider`, `endpoint`, `fetched_at`, `source_status`).
- Legacy `apiFootballClient` no longer fabricates data — fails closed with `DATA_UNAVAILABLE` (`src/lib/api/apiFootball.ts:38-42`). ✅

## 12. Mock / synthetic provider paths
- `src/lib/api/providers/mockProvider.ts` (registered provider abstraction), `src/lib/market/mockProvider.ts`, `src/lib/replay/MockReplayDataProvider.ts`, `src/lib/data/teams.ts` / `leagues.ts` placeholder logo URLs.
- `tests/setup-env.ts` injects `APIFOOTBALL_KEY: 'api-football-test-key-1234567890'` (test-only). ✅
- `src/scripts/trigger-local-ingest.ts:2` sets `process.env.API_FOOTBALL_KEY='mock'` (localhost script).
- No evidence that mock data currently enters the production prediction pipeline (quarantine + provenance gate), but provenance is not enforced at the gateway boundary.

## 13. Frontend exposure risks
- No client component calls API-Football. `src/services/api.ts` guards against browser execution.
- `src/lib/apis/apifootball.ts:5-7` throws if `typeof window !== 'undefined'` — import-time guard. ✅
- Risk: any future `NEXT_PUBLIC_`/`VITE_` prefix or importing a provider client from a `'use client'` component would inline the key. No automated CI guard currently enforces this.

## 14. Shared-IP / serverless egress risks
- Production egress = Vercel serverless functions → **shared, non-deterministic outbound IPs** (no dedicated egress config in repo). Vercel does not guarantee a static outbound IP by default.
- Cron (`vercel.json`) + route handlers + any fan-out create **concurrent requests from many ephemeral egress IPs**, which can appear as distributed/multi-origin traffic to the provider — the exact pattern that previously triggered API-Football multi-account protection.
- `src/lib/api/rateLimiter.ts` is file-based and per-instance → **not a real distributed limit** under serverless.
- No dedicated worker/queue with a stable egress IP exists. See `APIFOOTBALL_EGRESS_RECOMMENDATION.md`.

## 15. Secret handling
- No `.env*` files are tracked (`git ls-files` → 0); `.gitignore` ignores `.env*`. ✅
- No literal API key found in tracked source (all reads via `process.env`). ✅
- `validateCredential` blocks whitespace/placeholder/transcript contamination. ✅
- **EXPOSURE:** `scratch/check-key-status.ts:5` logs the raw key: `console.log('Checking API-Football status with key: ' + apiKey)`. Tracked file. **Must be redacted.**
- `scratch/check-key-status.ts:9` also targets a **RapidAPI** host (`api-football-v1.p.rapidapi.com`) — a second API-Football access channel. Not used by production, but it is a compliance concern (multi-provider account surface). Should be removed.
- Legacy direct `fetch` clients bypass the gateway so their request URLs are logged (`src/lib/api/apiFootball.ts:50` logs full URL) — currently URL excludes the key (header-based), acceptable.

## 16. Tests covering the provider
- `tests/provider-gateway.test.ts` (cache/no-quota-on-hit, reserve/confirm, exhausted, rollback, 429-confirm).
- `tests/quota-system.test.ts`, `tests/quota-policy.test.ts`, `tests/custom1500-verification.test.ts` (policy defaults — assert the **stale 1.5M** plan).
- `tests/providers-core.test.ts`, `tests/provider-abstraction.test.ts`, `tests/providers-repos.test.ts`.
- `tests/no-mock-guard.test.ts`, `tests/provenance-smoke.test.ts`, `tests/custom1500-verification.test.ts` (fail-closed).
- `tests/worldcup-feed.test.ts`, `tests/worldcup-production-flow.test.ts`, `tests/validate-*`.
- **Missing:** no test for query-order dedup, no test for gateway rate limiter / circuit breaker / backoff, no test for secret absence in client bundle, no test for canonical-key enforcement.

## 17. Findings summary (severity)

| # | Finding | Severity |
|---|---|---|
| F1 | Quota policy default (1,500,000/day) contradicts Pro contract (7,500/day) | **P0** |
| F2 | 4 duplicate API-Football transports; 2 reachable from production without quota | **P0** |
| F3 | Gateway cache key ignores query-param order → duplicate provider calls | **P0** |
| F4 | Canonical gateway has no rate limiter, no circuit breaker, no 429 cooldown | **P0** |
| F5 | Shared/serverless egress + non-distributed rate limiting → suspension risk | **P0** |
| F6 | Raw API key logged in `scratch/check-key-status.ts` | **P1** |
| F7 | Legacy file rate limiter hardcodes 100/day; unbounded file caches | **P1** |
| F8 | Provider states ACTIVE/PAUSED/FAILED/DISABLED not implemented for the canonical path | **P1** |
| F9 | No provenance metadata on gateway responses | **P2** |
| F10 | No automated secret-in-bundle / canonical-env CI guard | **P2** |
| F11 | `cleanup_stale_reservations` has no scheduled caller | **P2** |

## 18. Remediation plan (implemented in this change set)
1. Centralize Pro plan limits in `quotaPolicy.ts` (F1).
2. Add canonical request identity + normalized cache/dedup to the gateway (F3).
3. Add provider rate limiter, circuit breaker + health states, bounded 429/5xx backoff with jitter/`Retry-After` (F4, F8).
4. Add structured, secret-free provider audit log + provenance headers (F9).
5. Route bypass clients through the gateway (F2, F7).
6. Redact scratch secret logging + add secret-safety tests (F6, F10).
7. Document egress architecture and recommend controlled-egress worker (F5).
8. Add production probe + compliance tests (F10).
9. Schedule stale-reservation cleanup (F11) — documented in runbook.
