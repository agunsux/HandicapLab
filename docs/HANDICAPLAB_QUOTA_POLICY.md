# HANDICAPLAB — QUOTA POLICY

Canonical implementation: `src/lib/providers/quotaPolicy.ts`
Enforcement: `providerGateway.ts` → `quotaManagerV4.ts` (atomic), plus the
`quotaManager.ts` compatibility facade and `requestCounter.ts`.

## 1. Limits

| Provider | Period | Hard (contract) | Soft (application) |
| --- | --- | --- | --- |
| API-Football **PRO** | daily | **7,500** | **6,000** |
| OddsPapi | monthly | **250** | **200** |
| TheStatsAPI | daily | 1,000 | 800 |

The soft limit is application policy; the hard limit is the provider contract.
Never exceed the hard limit. Unmetered OddsPapi endpoints
(`historical-odds`, `account`) are exempt.

## 2. Pressure modes and priority gating

Priority bands (Epic §8/§36):

```text
P0 settlement / predictions  ≥ 90
P1 snapshots / homepage      ≥ 70
P2 discovery / historical    ≥ 40
P3 league evolution / metrics < 40
```

| Mode | Trigger | Allowed priorities |
| --- | --- | --- |
| `NORMAL` | below 80% of soft | all |
| `ECONOMY` | ≥ 80% of soft | P0–P2 (reject P3) |
| `CRITICAL` | ≥ soft limit | P0 only |
| `QUOTA_EXHAUSTED` | ≥ hard limit | none |

Operator labels: OddsPapi `CRITICAL` → `ODDS_QUOTA_PROTECTION`,
`QUOTA_EXHAUSTED` → `ODDS_QUOTA_EXHAUSTED`; any hard-limit state surfaces as
`DATA_UPDATE_PAUSED` to the UI.

## 3. Reservation flow

```text
QuotaManager.reserve(provider, endpoint, priority)
  ↓ check + reserve (atomic Supabase RPC)
execute provider request
  ↓
confirm(actual cost)  |  rollback on failure before provider processing
```

`reserve_quota` uses the provider **hard** limit as `safe_limit`
(`p_safety_reserve_pct = 0`); soft-limit rationing is applied in the
application layer by the shared policy so V3/V4 can never disagree.

## 4. Persistence

State lives in Supabase `quota_state` / `quota_reservations` (see
`supabase/migrations/20260812000000_quota_state.sql`) and survives restarts,
deploys, worker restarts and cron restarts. Stale reservations are recovered by
`cleanup_stale_reservations` (default 5 minutes).

Migration `20260911000000_quota_policy_pro_hard_soft.sql` aligns any
pre-existing rows to the hard-limit semantics and is idempotent.

> Operational note: the RPCs must exist in the target database. If they are
> missing, metered calls fail closed (`RPC_ERROR`) and the admin panel shows
> the failure — by design, the system does not guess quota state.

## 5. Consumption order

1. P0 settlement + prediction-critical data
2. P1 homepage/upcoming + T-60 snapshots
3. P2 historical enrichment + discovery
4. P3 non-essential metadata

At the hard limit: stop new requests, serve cached/database data, enter
`QUOTA_EXHAUSTED`. At the OddsPapi soft limit: `ODDS_QUOTA_PROTECTION` — only
essential billable calls continue.

## 6. Alerts (no spam)

- API-Football > 80% of soft, > 95% of soft, exhausted
- OddsPapi > 80% of soft (`ODDS_QUOTA_PROTECTION`), > 95% of soft, exhausted

## 7. Admin control center

- `/admin/system` — provider health, hard usage, soft limit + remaining,
  status label
- `/admin/scheduler` — quota-aware scheduler view with soft/hard limits and
  remaining values

Both read the same `getProviderHealth()` output, which is sourced from
`quota_state` (single source of truth).

## 8. Verification

- `tests/quota-policy.test.ts` — limits, modes, priority gating, labels
- `tests/quota-system.test.ts` — RPC semantics, rollback, provider isolation
- `tests/provider-gateway.test.ts` — gateway reserve/confirm/rollback
- `tests/data-state.test.ts` — `DATA_UPDATE_PAUSED` surfacing
