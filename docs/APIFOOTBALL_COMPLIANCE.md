# API-Football Compliance

**Policy owner:** HandicapLab Principal Engineer.
**Scope:** all API-Football (`api-sports.io`) usage.

## 1. The rule

> HandicapLab must use **one authorized API-Football account** and must **never**
> create or rotate accounts/keys to circumvent provider limits or account
> protection.

Corollaries (non-negotiable):

1. No second API-Football account.
2. No second API-Football key unless explicitly required by the provider.
3. No key rotation to evade rate limits or account protection.
4. No multiple accounts to increase quota.
5. The key is **server-only**: never `NEXT_PUBLIC_*`, never `VITE_*`, never in
   client bundles, never logged, never returned by APIs, never committed.
6. No browser/client component may call API-Football.
7. No uncontrolled serverless fan-out; no aggressive retries; no rate-limit
   bypass.
8. Provider Manager / Quota Manager protections must never be disabled.
9. Real provider data must never be replaced by mock data to satisfy tests or UI.

## 2. Account & plan

| Item | Value |
|---|---|
| Account | Single authorized HandicapLab account (duplicate accounts deleted by provider) |
| Plan | **Pro — $19/month** |
| Daily hard limit | 7,500 requests/day (contractual ceiling) |
| Daily soft limit | 6,000 requests/day (internal operating budget) |
| Reset | 00:00 UTC |
| Source of truth | `src/lib/providers/quotaPolicy.ts` |

Any code that hardcodes a quota number other than through `quotaPolicy.ts` is a
compliance defect.

## 3. API key handling

- Canonical variable: `APIFOOTBALL_KEY`. The legacy alias `API_FOOTBALL_KEY` is
  read only for migration and must be removed once environments are updated.
- Validation is fail-closed (`src/lib/auth/credentialValidator.ts`): missing,
  empty, whitespace/transcript-contaminated, placeholder, malformed or
  suspiciously short values are rejected. No substitute credential is fabricated.
- The secret must never be printed. Diagnostics must print only presence/status.
- Environment files are gitignored (`.env*`); no `.env*` file is tracked.

## 4. Provider gateway & callers

- Exactly one canonical gateway: `src/lib/providers/providerGateway.ts`.
- `src/lib/apis/apifootball.ts` is the only client on the canonical path.
- Direct-fetch clients (`src/lib/api/apiFootball.ts`, the `data/providers`
  HttpClient) have been routed through the gateway or reduced to gateway
  delegation. Direct fetches in operational scripts are research-only and must
  never run against the live key in production or CI.

## 5. Caching & deduplication

Cache-first, per-endpoint TTLs (see Architecture §4). Identical requests within
the cache window must not generate a second provider call; query-param order and
sensitive params do not affect identity.

## 6. Quota management

Atomic reserve → confirm/rollback through `quotaManagerV4` (Supabase RPC).
Concurrent requests cannot overspend the configured allowance. Stale reservations
must be reclaimed (`cleanup_stale_reservations`); see Runbook for the schedule.

## 7. Rate limiting & retries

- Provider-level token bucket + concurrency cap.
- Bounded exponential backoff with jitter; hard maximum of 2 retries; honour
  `Retry-After`. No `while (error) retry`.
- HTTP 429 increments provider failure/cooldown; it never triggers a storm.

## 8. Provider failure handling

State machine: `ACTIVE → (failure threshold) → FAILED → (cooldown) → PAUSED
(half-open probe) → ACTIVE`. `DISABLED` is a manual stop for incidents.
Behaviour: provider traffic must not be hammered after failures; no infinite retries.

## 9. IP / egress compliance

Production currently egresses through Vercel shared/serverless IPs. This is a
known residual risk. Migration to a single controlled-egress worker is specified
in `APIFOOTBALL_EGRESS_RECOMMENDATION.md`.

## 10. Monitoring & incident response

- Audit trail: `src/lib/providers/providerAuditLog.ts` (timestamp, provider,
  endpoint, fingerprint, status, latency, cache hit/miss, retry count, quota
  reservation, classification). It never contains credentials or raw bodies.
- Probe: `npx tsx scripts/probe-api-football-production.ts [--live]`.
- On provider notice / 401 / 403 / repeated 429:
  1. Stop ingestion (`git`/flag the provider DISABLED).
  2. Do **not** create or rotate accounts/keys.
  3. Diagnose egress origin and request volume from the audit log.
  4. Contact the provider through the existing account only.
  5. Resume only after an explicit provider OK.

## 11. Recovery procedure

1. Confirm the single account is active via the probe (`--live`).
2. Verify `APIFOOTBALL_KEY` is present and valid (server-side).
3. Confirm quota state and clear stale reservations.
4. Re-enable provider state to ACTIVE.
5. Resume with low priority (P2/P3) workflows; monitor 429/5xx for 24h before
   enabling historical backfills.

## 12. Evidence / verification commands

```
npx tsx scripts/probe-api-football-production.ts --live
npx vitest run tests/apifootball-compliance.test.ts tests/provider-gateway.test.ts tests/quota-policy.test.ts
npx tsc --noEmit
git ls-files | findstr .env      # must be empty
```
