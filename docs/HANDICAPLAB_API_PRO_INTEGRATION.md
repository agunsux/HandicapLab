# HANDICAPLAB — API-FOOTBALL PRO INTEGRATION

Status: implemented 2026-09-11. Plan: **PRO ($19/month), 7,500 requests/day**.

## 1. Provider architecture

All API-Football access goes through one quota-aware client:

```text
caller
  ↓
src/lib/apis/apifootball.ts        (canonical client, Zod-validated)
  ↓
src/lib/providers/providerGateway.ts  (quota reserve → execute → confirm/rollback)
  ↓
src/lib/providers/quotaManagerV4.ts   (atomic Supabase quota_state)
  ↓
api-football (v3.football.api-sports.io)
```

Direct `fetch()` calls to API-Football outside this client are prohibited.
The former mock-capable client `src/lib/api/apiFootball.ts` is retained for
research scripts only and now **fails closed** (`DATA_UNAVAILABLE`) instead of
generating synthetic data.

## 2. Quota limits (see HANDICAPLAB_QUOTA_POLICY.md)

| Limit | Value | Meaning |
| --- | --- | --- |
| Hard | 7,500/day | Provider contract — atomic stop |
| Soft | 6,000/day | Application operating ceiling; priority rationing begins earlier |

Environment overrides:

```text
API_FOOTBALL_DAILY_HARD_LIMIT=7500
API_FOOTBALL_DAILY_SOFT_LIMIT=6000
```

Legacy `QUOTA_APIFOOTBALL_DAILY` is still honoured as a hard-limit fallback.

## 3. Credentials

Server-side only:

```text
APIFOOTBALL_KEY      (canonical)
API_FOOTBALL_KEY     (accepted fallback)
```

Never expose via `NEXT_PUBLIC_*`. The previous `NEXT_PUBLIC_APIFOOTBALL_KEY`
read in `src/services/api.ts` was removed.

## 4. Endpoints used

| Endpoint | Method | Consumers |
| --- | --- | --- |
| `/fixtures` | `getFixtures(league, season)` | ingestion, providers |
| `/fixtures?date=` | `getFixturesByDate(date)` | discovery |
| `/fixtures?from=&to=` | `getFixturesRange(from,to)` | homepage upcoming (1 request per window) |
| `/leagues` | `getLeagues()` | LeagueRegistry sync |
| `/injuries`, `/lineups` | `getInjuries`, `getLineups` | T-60 snapshots |
| `/fixtures/statistics`, `/teams/statistics` | stats methods | post-match |
| `/odds`, `/odds/bookmakers`, `/odds/bets`, `/odds/live` | odds methods | reference only |
| `/standings`, `/venues` | standings/venue | enrichment |

## 5. Rate limiting, retries, backoff

Implemented inside the canonical client + `src/lib/http`:

- per-endpoint cooldown (7s serial delay for API-Football calls),
- exponential backoff with retries on 429/5xx,
- circuit breaker,
- in-memory + disk cache with per-endpoint TTLs,
- 429 handling rolls back the quota reservation.

## 6. Error taxonomy

| Class | Behaviour |
| --- | --- |
| 401 | `INVALID_KEY` — no retry, reservation rolled back |
| 429 | `RATE_LIMITED` — backoff, reservation rolled back |
| 4xx contract | surfaced as error, never masked |
| Network/5xx | `NETWORK` — retried, reservation rolled back |
| Quota hard limit | `QuotaExhaustionError` → caller serves cache / `DATA_UPDATE_PAUSED` |
| Missing key | fail closed `DATA_UNAVAILABLE` — no mock fallback |

## 7. Caching

Static metadata (leagues, teams, bookmakers) long TTL; fixtures short TTL.
The homepage never triggers a provider call per visitor: it renders cached
database/snapshot data and background ingestion updates it.

## 8. Verification

- `tests/no-mock-guard.test.ts` — fail-closed behaviour
- `tests/quota-policy.test.ts` — limits/modes
- `tests/quota-system.test.ts` — reservation RPC semantics
- `tests/historical-ingestion.test.ts` — fixture ingestion path
- `tests/provider-gateway.test.ts` — reserve/confirm/rollback
