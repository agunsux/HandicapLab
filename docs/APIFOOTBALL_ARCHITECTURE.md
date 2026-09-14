# API-Football Architecture

**Status:** production reference.
**Authoritative account:** one HandicapLab API-Football Pro account (7,500 req/day).

## 1. Target topology

```
Users ─► HandicapLab web/API ─► internal data layer ─► cache / Supabase
                                                              │
                                                              ▼
                                                   Provider Gateway
                                              (src/lib/providers/providerGateway.ts)
                                                              │
                                        ┌─────────────────────┼─────────────────────┐
                                        ▼                     ▼                     ▼
                                 Provider Manager       Rate limiter          Circuit breaker
                                 (quotaManagerV4)     (10 req/min, conc≤3)   (ACTIVE/PAUSED/FAILED/DISABLED)
                                        │
                                        ▼
                              API-Football (single account)
```

There is **one canonical integration boundary**: `src/lib/providers/providerGateway.ts`.
No feature may call API-Football directly.

## 2. Layers

| Layer | Module | Responsibility |
|---|---|---|
| Canonical client | `src/lib/apis/apifootball.ts` | endpoint methods, Zod validation, bounded retry/backoff |
| Gateway | `src/lib/providers/providerGateway.ts` | cache → circuit → quota → rate limit → fetch → audit → provenance |
| Request identity | `src/lib/providers/requestIdentity.ts` | canonical, secret-free cache/dedup keys and fingerprints |
| Quota manager | `src/lib/providers/quotaManagerV4.ts` | atomic reserve/confirm/rollback (Supabase RPC) |
| Quota policy | `src/lib/providers/quotaPolicy.ts` | single source of truth for plan limits |
| Health | `src/lib/providers/providerHealth.ts` | ACTIVE/PAUSED/FAILED/DISABLED state machine |
| Audit | `src/lib/providers/providerAuditLog.ts` | structured, secret-free request trail |
| HTTP primitives | `src/lib/http/{RateLimiter,CircuitBreaker,Cache,HttpClient}.ts` | reusable building blocks |

## 3. Request lifecycle (cache-first)

```
request
  │
  ├─ cache hit ─────────────────────────────► return cached (no quota, no network)
  │
  └─ cache miss
        │
        ├─ circuit open? ──────────────────► reject (CIRCUIT_OPEN)
        │
        ├─ reserve quota (atomic) ─────────► reject if exhausted (QUOTA_BLOCKED)
        │
        ├─ acquire rate token + concurrency slot (bounded wait)
        │
        ├─ fetch provider (bounded retry handled by canonical client)
        │
        ├─ classify + confirm quota + circuit onFailure/onSuccess
        │
        ├─ persist cache (success only)
        │
        └─ attach provenance headers ──────► REAL_PROVIDER / CACHE / PROVIDER_ERROR
```

## 4. Cache / dedup

- Cache key = `gwcache:{provider}:{endpoint}:{method}:{canonicalUrl}:{body}`.
- `canonicalUrl` sorts query params and strips sensitive/volatile params, so
  `fixtures?league=39&season=2026` and `fixtures?season=2026&league=39` resolve
  to the same identity.
- Identical **in-flight** GETs are collapsed to a single provider call
  (`inFlightRequests`).
- TTLs (defaults, per endpoint): leagues/teams 24h · standings/team-stats 6h ·
  fixtures 60s · postmatch 30m · injuries/lineups 15m · odds 5m · odds/live 30s ·
  bookmakers/bets/venues 7d · health 5m.

## 5. Quota management

- Policy defaults: API-Football **hard 7,500/day, soft 6,000/day** (Pro).
- Env overrides: `API_FOOTBALL_DAILY_HARD_LIMIT`, `API_FOOTBALL_DAILY_SOFT_LIMIT`,
  `QUOTA_APIFOOTBALL_DAILY`, `API_FOOTBALL_OPERATIONAL_BUDGET`.
- Modes: NORMAL → ECONOMY (≥80% of soft) → CRITICAL (≥soft) → QUOTA_EXHAUSTED (≥hard).
- Priority gating: P0 settlement/prediction ≥90, P1 snapshot ≥70, P2 discovery/historical ≥40, P3 metadata <40.
- Reservations are atomic via Supabase RPC and must be confirmed or rolled back.
  Stale reservations are recovered by `cleanup_stale_reservations`.

## 6. Rate limiting, retries, circuit breaking

- Rate limiter: token bucket, default API-Football 10 req/min; concurrency cap 3
  (`APIFOOTBALL_RATE_LIMIT_PER_MIN`, `APIFOOTBALL_MAX_CONCURRENCY`).
- Retries: maximum **2 retries**, exponential backoff with full jitter, capped at
  30s, honouring `Retry-After`. Retries never bypass quota/circuit decisions.
- Circuit breaker: 5 failures → FAILED (open) for 60s → PAUSED (half-open probe)
  → ACTIVE after 2 successes. `DISABLED` is a manual compliance stop.

## 7. Provenance

Every gateway response carries:
`x-hl-provider`, `x-hl-endpoint`, `x-hl-fetched-at`, `x-hl-source-status`
(`REAL_PROVIDER` | `CACHE` | `PROVIDER_ERROR`), `x-hl-request-fingerprint`,
`x-hl-data-version`. Synthetic/mock data is quarantined to test fixtures and
must never be labelled `REAL_PROVIDER`.

## 8. Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `APIFOOTBALL_KEY` | yes | server-only API-Football credential (canonical) |
| `API_FOOTBALL_KEY` | legacy | accepted during migration only |
| `APIFOOTBALL_BASE_URL` | no | override base URL |
| `APIFOOTBALL_RATE_LIMIT_PER_MIN` | no | rate limiter override |
| `APIFOOTBALL_MAX_CONCURRENCY` | no | concurrency override |
| `PROVIDER_AUDIT_STDOUT` | no | set `1` to emit audit lines to stdout |
