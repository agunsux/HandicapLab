# APIFOOTBALL_EGRESS_RECOMMENDATION.md

**Goal:** remove ambiguous shared-IP behaviour so the single authorized
API-Football account can never look like multi-account / distributed-origin
traffic. This is a compliance document — it does not authorize any purchase or
deployment. No infrastructure is purchased or deployed by this change.

---

## 1. Current architecture

```
Vercel Cron (vercel.json)             ┌─────────────────────────────┐
  /api/cron/discovery  ──────────►    │  Next.js Route Handlers     │
  /api/cron/odds                      │  (Vercel serverless)        │
  /api/cron/enrichment                │                             │
  /api/cron/settlement                │  ProviderGateway            │
  /api/cron/predict                   │   ├─ quotaManagerV4 (Supabase RPC)
  /api/cron/update-results            │   ├─ in-memory cache/dedup  │
  /api/cron/ah-shadow-pipeline        │   ├─ rate limiter (in-proc) │
  ▼                                   │   └─ circuit breaker (in-proc)
Supabase (state, cache)  ◄──────────► │                             │
                                      └──────────────┬──────────────┘
                                                     │ outbound HTTPS
                                                     ▼
                                          api-sports.io (API-Football)

Local / ops scripts (tsx) ──────────────────────────► api-sports.io  (second origin)
```

**Provider request origin:** `src/lib/providers/providerGateway.ts`
(via `src/lib/apis/apifootball.ts`), called from Vercel Route Handlers
(`src/app/api/cron/**`) and, historically, from direct-fetch clients (now
removed from the canonical path).

**Execution platform:** Vercel (serverless functions) + Supabase (state).
**Outbound IP behaviour:** every serverless invocation may egress from a
different IP; Vercel does not provide a stable outbound IP by default.
**Static/dedicated IP:** none configured.
**Serverless/shared egress:** yes — this is the material risk.

## 2. Current IP behaviour — risk assessment

| Factor | Reality | Risk |
|---|---|---|
| Production egress | Vercel shared, dynamic IP pool | **HIGH** — many IPs look like many clients |
| Concurrency | each cron/route handler runs independently | **HIGH** — simultaneous bursts from different IPs |
| Rate limiting | token bucket is per-instance, not distributed | **MEDIUM** — global rate not enforced across instances |
| Cron fan-out | 7 scheduled paths + manually-triggered routes | **MEDIUM** |
| Local scripts | dev-machine IP, different from production | **MEDIUM** — third distinct origin |
| Account count | one authorized account (Pro) | controlled, but IP ambiguity can still trip protection |

The provider previously suspended the account for **duplicate accounts** and
warned that **shared-IP traffic** can trigger multi-account protection. Shared
dynamic egress is therefore the single largest residual suspension risk even
after the client-side hardening in this change set.

## 3. Recommended architecture (target)

Move all outbound API-Football ingestion behind **one controlled backend/worker
with a single stable egress IP**. Route handlers and the web app must never
call API-Football directly; they read only from Supabase / cache.

```
Vercel Cron ──► enqueue job (Supabase table `provider_job_queue`)
                        │
                        ▼
        Controlled Worker (single always-on process, STATIC EGRESS IP)
          - consumes provider_job_queue
          - uses the SAME ProviderGateway/QuotaManager (no new quota system)
          - bounded concurrency = 1–2, respects 10 req/min limiter
          - writes results to Supabase
                        │
                        ▼
                  api-sports.io   (one origin, one account)
```

Properties:
- exactly one process origin (static IP), one account, one gateway;
- global rate limiting becomes meaningful (single process);
- cron enqueues work; retries/backoff happen in the worker, not in many
  serverless instances;
- quota reservations remain in Supabase, so the API write path stays identical.

## 4. Lowest-cost viable production option

**Recommended:** a single small always-on worker with a static egress IP,
consuming a Supabase-backed job queue.

| Option | Est. cost/mo | Static egress IP | Notes |
|---|---|---|---|
| **Fly.io `shared-cpu-1x` worker + dedicated IPv4** | ~$3–5 | Yes (dedicated IP) | Cheapest pairing of always-on + static IP |
| Small VPS (Hetzner CX22 / DO basic) | ~$4–6 | Yes (assigned IP) | Full control; you manage the OS |
| Render/Railway worker + static outbound IP | ~$7–25 | Paid add-on | Simple deploy, higher cost |
| Vercel Secure Compute / static IP add-on | ~$100+ | Yes | Keeps stack on Vercel; most expensive |
| AWS NAT Gateway | ~$35+ | Yes (Elastic IP) | Overkill for this volume |

The Fly.io / small-VPS worker is the lowest-cost option that satisfies the
requirement (always-on + stable egress IP). At the current request volume
(≤6,000/day) a `shared-cpu-1x` (256 MB) instance is sufficient.

## 5. Migration steps

1. **Add the queue** (Supabase): a `provider_job_queue` table
   (`id, provider, endpoint, params, priority, status, attempts, created_at,
   claimed_at`). Cron handlers enqueue instead of calling the provider.
2. **Deploy the worker** with a static egress IP; configure
   `APIFOOTBALL_KEY` (server-only) and Supabase service credentials.
3. **Point ingestion to the queue**: replace direct `apiFootballClient` calls in
   cron routes with enqueue operations; the worker calls the *existing*
   `apiFootballClient` (unchanged gateway/quota path).
4. **Restrict egress**: firewall the worker to allow outbound to
   `v3.football.api-sports.io` only.
5. **Remove direct-fetch scripts** from production runners (keep them local-only
   and read-only; they must not run in CI against the live key).
6. **Verify** with `npx tsx scripts/probe-api-football-production.ts --live`
   from the worker, and confirm the egress IP is stable via a logged
   `x-hl-request-fingerprint` + origin check.
7. **Monitor** auth failures (401/403) and provider notices for 1–2 weeks before
   enabling historical backfills.

## 6. Rollback plan

- The queue is additive: cron handlers can be reverted to direct gateway calls
  (which remain quota/dedup/rate/audit-safe) by reverting the enqueue step.
- Keep the worker deployed but **disabled** (`APIFOOTBALL_EGRESS_WORKER=0`) so
  traffic temporarily falls back to serverless egress if the worker misbehaves.
- Supabase quota reservations are unchanged, so quota accounting survives either
  mode.
- No data migration is required; the queue table can be drained and dropped.

## 7. Explicit non-actions

- No infra purchased or deployed by this change.
- No second account, key rotation, or quota circumvention — the worker only
  makes the *same* account reachable from one predictable origin.
