# API-Football Controlled Egress — Implementation Plan (P0.3)

**STATUS: IMPLEMENTED (code) — NOT DEPLOYED.**
Queue migration, worker, egress-mode flag, idempotent enqueue and enqueue-only
cron wrapping exist in the repository. No infrastructure was purchased, no
accounts created, no DNS changed, no deploy performed, no `--live` call made,
and no ingestion run. Production remains on `APIFOOTBALL_EGRESS_MODE=serverless`
(default), so behaviour is unchanged until the controlled smoke test is approved
and the flag is explicitly set to `worker`.

---

## 0. Problem

Production API-Football traffic currently egresses through **Vercel
serverless** functions with dynamic/shared outbound IPs. API-Football support
previously flagged duplicate accounts and stated that shared-IP service traffic
can trigger multi-account protection. Client-side controls (gateway, quota,
rate limit, dedup, audit) are in place, but the **origin** of requests is still
ambiguous. This plan fixes the origin, not the client.

## 1. Architecture target

```
Vercel Cron / Admin API          (no provider calls)
        │  enqueue (HTTPS)
        ▼
Supabase  event_queue            (existing table, extended)
        │  atomic claim (FOR UPDATE SKIP LOCKED)
        ▼
Controlled Ingestion Worker      (single long-lived process, STATIC EGRESS IP)
   └─ loops jobs, concurrency = 1 (configurable ≤2)
        │
        ▼
Canonical Provider Gateway       (unchanged: quota → rate → cache/dedup → audit)
        │
        ▼
API-Football (api-sports.io)     one account, one key, one origin IP
        │
        ▼
Supabase (results)               web app reads data only
```

## 2. Existing infrastructure to reuse (no new parallel systems)

| Primitive | Where | Reuse |
|---|---|---|
| `event_queue` table | `supabase/migrations/00000000000050_autonomous_orchestrator.sql` | job queue (extend) |
| Queue helpers | `src/lib/crons/eventQueue.ts` (`enqueue/dequeue/completeEvent/failEvent/recoverStuckEvents/getQueueDepth`) | worker loop |
| `FOR UPDATE SKIP LOCKED` pattern | `claim_founder_slot` (migration 05) | atomic claim RPC |
| Provider Gateway | `src/lib/providers/providerGateway.ts` | unchanged |
| Quota/rate/cache/audit/health | `quotaManagerV4`, `RateLimiter`, `providerAuditLog`, `providerHealth` | unchanged |
| Ingestion engines | `GlobalIngestionEngine`, `fixtureDiscovery`, `t60Snapshot`, `historicalIngestor`, `dailyAhShadowPipeline` | worker job executors |
| Credential validation | `src/lib/auth/credentialValidator.ts` | worker boot |

**Gap found:** `eventQueue.dequeue()` is a non-atomic `select` then `update`.
Under a single worker this is acceptable, but the plan adds an atomic
`claim_next_event` RPC (lease-based) so concurrency and crash-recovery are safe.

## 3. Recommended provider

| Option | Monthly cost (verify at approval) | Static egress IP | Notes |
|---|---|---|---|
| **Fly.io Machine `shared-cpu-1x` 256–512 MB + dedicated egress IP** (recommended) | ~$3–5 | Yes (dedicated egress IPv4) | Managed, always-on, secrets built-in, easiest rollback |
| Small VPS (Hetzner CX22 / DO basic) | ~$4–6 | Yes (reserved public IPv4) | Cheapest full control; you manage OS/systemd |
| Render/Railway worker + static outbound IP | ~$7–25 | Paid add-on | Simpler DX, higher cost |
| Vercel Secure Compute / static IP | ~$100+ | Yes | Most expensive; keeps stack on Vercel |
| AWS NAT Gateway | ~$35+ | Yes | Overkill for ≤6,000 req/day |

**Recommendation:** Fly.io (managed) with a dedicated egress IP. Fallback if
price/approval changes: a small VPS with a reserved public IPv4. At current
volume (Pro, 7,500/day hard) a 256 MB instance with concurrency 1 is enough.

## 4. Static IP mechanism (exact behaviour to be confirmed at approval)

- **Fly.io:** allocate a dedicated egress IP for the worker app; all outbound
  requests originate from that single IPv4. Bind the app to exactly one Machine
  (`fly scale count 1`, no autoscaling) so there is never more than one origin.
- **VPS:** the instance's reserved public IPv4 (or attached Elastic IP) is the
  egress IP; the worker is the only process permitted to reach api-sports.io.
- **Firewall (both):** outbound allowlist = `api-sports.io:443`, `*.supabase.co:443`,
  optional Sentry; inbound = none (health is reported via Supabase heartbeat).
- **Drift detection:** worker records the observed outbound IP at boot and in a
  periodic heartbeat; the ops status route alerts if it changes from the pinned
  value.
- The current Vercel egress remains dynamic/shared; after cutover, no production
  ingestion path egresses from Vercel.

## 5. Network flow

```
cron (Vercel)  →  event_queue.insert (Supabase HTTPS)
worker         →  claim_next_event RPC (Supabase HTTPS)
worker         →  ProviderGateway.fetch → api-sports.io (static IP)
worker         →  upsert results (Supabase HTTPS)
next.js app    →  Supabase reads only
ops/status     →  Supabase heartbeat/queue depth reads only
```

## 6. Secret management

- `APIFOOTBALL_KEY` (canonical) stored as a worker-provider secret (Fly secrets /
  systemd `EnvironmentFile` / Docker secret). Same single key — **no rotation, no
  second key**.
- `SUPABASE_SERVICE_ROLE_KEY` server-only in the worker.
- Secrets are never exposed to the browser, never logged (existing
  `providerAuditLog` is secret-free), never in git (`.env*` gitignored).
- Key is read only via `src/lib/providers/providerKey.ts`.

## 7. Queue design

- Reuse `event_queue`; add API-Football job execution via existing event types
  (`historical_resume`, `fixture_discovered`, `enrichment_due`, `snapshot_due`,
  `settlement_available`) with a `payload` describing provider endpoint + params.
- **Atomic claim RPC** `claim_next_event(p_event_types text[], p_lock_seconds int)`:
  `SELECT ... WHERE status='pending' AND scheduled_for<=now() ORDER BY priority, created_at
   FOR UPDATE SKIP LOCKED LIMIT 1`, then set `status='processing'`,
  `started_at=now()`, `lease_expires_at=now()+lock`.
- **Idempotency:** add `event_key text UNIQUE` (e.g.
  `apifootball:fixtures:league=39&season=2026`) so duplicate enqueues collapse;
  worker relies on the gateway's canonical request identity + cache/dedup and on
  existing keyed upserts for safe replay.
- **Retries:** existing `failEvent` exponential backoff, hard `max_retries = 3`;
  terminal `failed` retained as dead-letter.
- **Stale recovery:** `recoverStuckEvents` (lease expiry) + existing
  `/api/cron/quota-cleanup` for reservations.

## 8. Worker lifecycle

1. **Boot:** fail-closed credential validation; recover stuck `processing` jobs;
   start health heartbeat.
2. **Loop:** claim → execute via existing service/gateway → `completeEvent` or
   `failEvent`; idle sleep (~2 s) when the queue is empty.
3. **Concurrency:** `EGRESS_WORKER_CONCURRENCY=1` default (max 2). Serial
   provider calls per worker process.
4. **Graceful shutdown:** SIGTERM → stop claiming, finish in-flight job, release
   lease, exit 0. Provider/systemd restarts automatically.
5. **Health:** worker writes a heartbeat row (queue depth, provider state from
   `ProviderHealthMonitor`, quota snapshot, last job, observed egress IP).
   Exposed read-only via authenticated `GET /api/ops/egress-worker/status`
   (no inbound port required).

## 9. Failure handling

| Failure | Behaviour |
|---|---|
| Provider 429 | gateway cooldown + bounded client retry; job backoff; no storm |
| Provider 5xx | circuit opens (FAILED) → cooldown → PAUSED probe → ACTIVE |
| Quota exhausted | gateway rejects; job rescheduled; no bypass |
| Worker crash | lease expires → `recoverStuckEvents` returns job to `pending` |
| Supabase outage | worker backs off; heartbeat degraded |
| Egress IP drift | heartbeat mismatch → ops alert; worker can self-pause |

## 10. Rollback architecture

- Env flag `APIFOOTBALL_EGRESS_MODE = 'serverless' | 'worker'` (default
  `serverless` until approved).
  - `serverless`: current behaviour (cron handlers call the gateway directly).
  - `worker`: cron handlers only enqueue; worker consumes.
- Rollback = set flag to `serverless` and stop the worker. **No schema rollback**
  needed (`event_queue` is additive; jobs can be drained).
- Worker may stay deployed but disabled (`WORKER_ENABLED=0`).
- No data migration; no key change; quota/cache state unchanged.

## 11. Migration steps (approval-gated; not executed)

1. Add additive Supabase migration: `event_key`, `lease_expires_at`,
   `claim_next_event` RPC.
2. Add `worker/` process + `Dockerfile.worker`/`fly.toml` (deploy artifacts).
3. Add `APIFOOTBALL_EGRESS_MODE`; wrap cron handlers to enqueue in `worker` mode.
4. Deploy worker, set secrets, confirm single Machine + static egress IP.
5. Verify (no ingestion): worker health, queue claim/drain with a synthetic job.
6. Only with explicit approval: single controlled `--live` smoke from the worker IP.
7. Cut over flag `serverless → worker`; monitor `provider_logs`/audit + egress IP.
8. Keep `serverless` path for instant rollback.

## 12. Exact files that would need modification

**New:**
- `supabase/migrations/<timestamp>_controlled_egress_queue.sql`
- `worker/index.ts`, `worker/config.ts`, `worker/health.ts`, `worker/tsconfig.json`
- `Dockerfile.worker`, `fly.toml` (or `deploy/worker.service` for VPS)
- `src/lib/crons/egressJobs.ts` (API-Football job types + enqueue helpers)
- `src/app/api/ops/egress-worker/status/route.ts` (auth; reads heartbeat)
- `docs/APIFOOTBALL_CONTROLLED_EGRESS_PLAN.md` (this document)

**Modified:**
- `src/lib/crons/eventQueue.ts` — add `claimNextEventAtomic`, `event_key` dedup,
  lease handling.
- `src/app/api/cron/{discovery,enrichment,odds,t60-snapshot,ah-shadow-pipeline,generate-signals,settle,update-results}/route.ts`
  — enqueue when `APIFOOTBALL_EGRESS_MODE=worker`, else unchanged.
- `package.json` — add `worker:start` / `worker:dev` scripts.
- `.env.example` — add `APIFOOTBALL_EGRESS_MODE`, `EGRESS_WORKER_CONCURRENCY`,
  `WORKER_HEALTH_PORT`, `WORKER_ENABLED` (no secret values).
- `vercel.json` — keep crons; schedules unchanged (they enqueue after cutover).
- `src/lib/providers/providerGateway.ts` — **only if a transport/health hook is
  strictly required**; the worker imports the gateway as-is, so no change is
  currently anticipated.

**Unchanged by design:** quota policy, quota manager, rate limiter, cache/dedup,
audit logging, prediction logic, AH logic, odds logic.

## 13. Open questions for approval

1. Provider choice: Fly.io (managed) vs VPS (cheapest, most control)?
2. Acceptable monthly cost ceiling?
3. Approve adding `event_key`/`lease_expires_at` columns + `claim_next_event` RPC?
4. Worker heartbeat destination: new `provider_worker_health` table vs reuse
   existing health tables?
5. Cutover window and rollback authority.

**No action will be taken until this plan is explicitly approved.**
