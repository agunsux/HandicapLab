# API-Football Production Runbook

Operational procedures for the single authorized API-Football (api-sports.io)
account. Read `APIFOOTBALL_COMPLIANCE.md` before making changes.

## 1. Prerequisites

- One authorized account, Pro plan (7,500/day hard, 6,000/day soft).
- `APIFOOTBALL_KEY` set server-side (Vercel encrypted env). Never in the client.
- Supabase service credentials available (quota state + reservations).
- Gateway protections enabled (do not disable quota/rate/circuit).

## 2. Daily health check

```
npx tsx scripts/probe-api-football-production.ts --live
```

Expected: `RESULT PASS`. Investigate any `FAIL` before proceeding.

## 3. Monitoring signals

| Signal | Where | Action |
|---|---|---|
| 429 present | gateway audit classification `RATE_LIMITED` | confirm limiter; reduce concurrency; wait for cooldown |
| 401/403 | classification `AUTH_ERROR` | verify key/server config; do NOT create a new account |
| repeated 5xx | classification `SERVER_ERROR` | provider incident; circuit opens automatically |
| quota mode ECONOMY/CRITICAL | `quotaPolicy` / admin snapshot | P3 work stops automatically; do not override |
| `QUOTA_EXHAUSTED` | audit `QUOTA_BLOCKED` | stop ingestion until UTC reset |
| cache hit rate falling | audit summary | check TTL policy and caller cacheTtlMs |
| circuit FAILED | `providerGateway.getHealthMonitor('apifootball')` | wait cooldown; probe; do not battery-retry |

Answer "how many requests today?" from the audit summary:

```
providerAuditLog.getSummary(startOfUtcDay)
// total / providerRequests / cacheHits / deduplicated / errors / byEndpoint
```

## 4. Quota operations

- Snapshot: `getQuotaSnapshot('apifootball')` (single read API).
- Stale reservations: `cleanup_stale_reservations` is invoked by the
  `/api/cron/quota-cleanup` route, scheduled every 5 minutes in `vercel.json`
  (`*/5 * * * *`). It calls `cleanupStaleReservations(5)` and reports the
  current quota snapshot.
- Never raise the hard limit above the provider contract (7,500/day).

## 5. Provider failure / circuit

1. Confirm state: `globalGateway.getHealthMonitor('apifootball').getState()`.
2. `FAILED`: wait ≥60s cooldown; the next request becomes the half-open probe.
3. `PAUSED`: allow 2 successful probes to return to `ACTIVE`.
4. `DISABLED`: manual stop; only re-enable after root cause is fixed.
5. Never loop-retry past the bounded maximum.

## 6. Incident response (account suspension warning)

1. **Stop** all ingestion immediately (set provider `DISABLED` / pause crons).
2. **Do not** create, rotate, or add accounts/keys.
3. Capture audit evidence: request volumes, endpoints, fingerprints, egress
   origin (see egress doc).
4. Contact the provider through the **existing** account only.
5. Resume only after explicit provider confirmation, starting at P2/P3 priority.

## 7. Historical backfill gate

Do **not** run large historical ingestion until:

- `probe-api-football-production.ts --live` passes;
- 429/5xx rates are zero for 24h;
- quota headroom ≥50% of the daily soft limit;
- egress is either controlled or explicitly accepted.

Backfills must use the canonical client (never raw fetch) so quota/dedup apply.

## 8. Environment / deployment checks

- `git ls-files | findstr .env` → empty.
- `npx vitest run tests/apifootball-compliance.test.ts` → 13/13.
- `npx tsc --noEmit` → no new errors in provider modules.
- Confirm no `NEXT_PUBLIC_*FOOTBALL` / `VITE_*FOOTBALL` in `src/`.

## 9. Recovery

1. Verify account active (probe).
2. Verify key present/valid.
3. Clear stale reservations; confirm quota state.
4. Re-enable provider to ACTIVE.
5. Resume low-priority workflows; monitor 24h.

## 10. Ownership

- Primary: Principal Engineer (production reliability).
- Escalation: provider support via the single existing account.
