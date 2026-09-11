# HANDICAPLAB — DATA LINEAGE

Principle: **real data only**. No fake fixtures, synthetic odds, hardcoded
probabilities, placeholder ROI/CLV or fabricated confidence anywhere in the
production path.

## 1. Canonical pipeline

```text
API-Football (fixtures/statistics)
OddsPapi (market prices; historical odds unmetered)
        ↓
Provider adapter + Quota Manager
        ↓
Ingestion
        ↓
Validation (Zod schemas, provenance checks)
        ↓
Canonical data (Postgres/Supabase)
        ↓
Features (point-in-time, no leakage)
        ↓
Model (Dixon-Coles / Bivariate Poisson / ensemble)
        ↓
Prediction ledger (provenance recorded)
        ↓
Backend API → Frontend
```

The browser never calls providers directly. `src/services/api.ts` no longer
reads `NEXT_PUBLIC_*` provider keys and refuses provider access in the browser.

## 2. Provenance fields

Every production prediction must be traceable to:

```text
fixture_id, canonical_match_id, provider, provider_timestamp,
odds_timestamp, market, line, odds, dataset_version, feature_version,
model_version, prediction_timestamp
```

Historical odds carry `fixtureId, bookmaker, marketId, outcomeId,
createdAt, price, limit, active` (see `HistoricalOddPoint`).

## 3. Canonical match registry

API-Football fixture IDs and OddsPapi fixture IDs are distinct namespaces.
Mapping/dedup status: the existing registry/entity-resolution layer is used
where available; a persistent cross-provider mapping is **not yet complete**
and is tracked as a remaining gap (see PRODUCTION_READINESS). Until it exists,
predictions must carry their provider fixture IDs so no duplicate match is
silently created.

## 4. Data states (UI contract)

`src/lib/data/dataState.ts`:

| State | Meaning |
| --- | --- |
| `REAL` | freshly computed from provider/database evidence |
| `CACHED` | cache hit within TTL |
| `STALE` | real data older than its freshness budget |
| `INSUFFICIENT_DATA` | sample too small for a claim |
| `DATA_UNAVAILABLE` | no real data exists |
| `DATA_UPDATE_PAUSED` | quota protection active; updates intentionally paused |

Never display stale data as live. Never substitute mock data for any state.

## 5. Anti-fabrication enforcement (2026-09-11)

Removed/quarantined fabricated surfaces:

- homepage ROI +28.42% / +77.96% and "110,394 Pinnacle odds" → replaced with
  the persisted walk-forward artifact (`data/reports/homepage_backtest_latest.json`).
- EPIC-66 discovery rankings → `QUARANTINED_PENDING_AUDIT`; its own coverage
  matrix reports 0 Pinnacle rows while claiming p=0 triple-digit ROI.
- `/api/dashboard` → deprecated, returns HTTP 410 (previously synthetic odds
  and hardcoded stats).
- `/api/evidence` → real `prediction_audits` aggregates; uncomputable metrics
  are `null`.
- `/api/v1/predictions` → requires `matchId`; no hardcoded fixture.
- Legacy mock generator → deleted; client fails closed with `DATA_UNAVAILABLE`.
- Football-data provider → factory rejects non-API-Football providers.

## 6. Research vs production

Synthetic data may exist only in tests/research. Production predictions cannot
consume synthetic data. `RESEARCH`, `BACKTEST`, `SIMULATION` and `PRODUCTION`
datasets remain separated by dataset/feature/model versions.

## 7. Verification

- `tests/no-mock-guard.test.ts`
- `tests/data-state.test.ts`
- `tests/services/epic67_data_services.test.ts`
- `tests/api/epic67_public_endpoints.test.ts`
