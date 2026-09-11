# HANDICAPLAB — ODDSPAPI INTEGRATION

Status: implemented 2026-09-11. Plan allowance: **250 billable requests/month**.
`/v4/historical-odds` and `/v4/account` are **unmetered**.

## 1. Client architecture

```text
caller
  ↓
src/lib/data/providers/odds/native/client.ts   (OddsPapiClient, Zod-validated)
  ↓
src/lib/providers/quotaManagerV4.ts            (reserve/confirm — billable only)
  ↓
api.oddspapi.io/v4
```

`src/lib/providers/sharpOdds.ts` is the service facade used by ingestion.
Client-side bookmaker filtering follows the client-side-filtering decision:
one request per fixture, filtered locally to approved sharp books.

## 2. Endpoint classification

| Endpoint | Metered | Notes |
| --- | --- | --- |
| `/v4/fixtures` | yes | fixture catalog |
| `/v4/odds` | yes | per-fixture current odds |
| `/v4/odds-by-tournaments` | yes | batch by tournament |
| `/v4/historical-odds` | **no** | price history since 2026-01; cooldown 5s |
| `/v4/account` | **no** | quota/subscription sync |
| `/v4/sports`, `/tournaments`, `/bookmakers`, `/markets` | yes | static metadata, long TTL |

One billable call = one request regardless of response size or HTTP status.

## 3. Historical odds (research first)

`OddsPapiClient.fetchHistoricalOdds({ fixtureId, bookmakers?, outcomeId?, active? })`
bypasses the billable budget entirely (`getUnmetered`).

Normalization: `normalizeHistoricalOdds()` produces a chronological price
series; `selectEntryAndClosing()` returns the last observation at/before
(kickoff − lead) and at/before kickoff. Missing data → `null`, never
interpolated. This is the primary source for:

- historical AH / OU / BTTS / ML prices,
- backtesting and market-movement research,
- CLV entry/closing pairs.

Do **not** spend the 250 billable requests on historical research.

## 4. Billable budget (see HANDICAPLAB_QUOTA_POLICY.md)

| Limit | Value |
| --- | --- |
| Hard | 250/month (`ODDSPAPI_HARD_LIMIT`) |
| Soft | 200/month (`ODDSPAPI_SOFT_LIMIT`) → `ODDS_QUOTA_PROTECTION` |

`src/lib/providers/requestCounter.ts` checks the budget **before** every
billable fetch; at the hard limit the fetch is skipped with a warning and the
pipeline degrades gracefully.

Billable requests are reserved for:

1. current odds for prediction-critical fixtures,
2. selective high-priority refreshes,
3. prediction-critical re-prices.

Not allowed: static metadata re-fetching, homepage-visitor polling, duplicate
fixture requests, historical research.

## 5. Sharp book filtering

Approved sources come from the Sharp Market Reference Policy config
(`src/lib/config/sharpBooks.ts`):

- S1: Pinnacle, SBOBet, Betfair Exchange
- S2: Singbet/IBC, Marathonbet

`src/lib/providers/oddspapiFilter.ts` derives its allowlist from that config —
there is a single source of truth.

## 6. Sharp consensus

`src/lib/market-intelligence/sharpReferenceProvider.ts` converts per-book
snapshots into quotes; `sharpConsensus.ts` computes per-source de-vigged
probabilities, weighted consensus, dispersion and source quality. Exchange
prices are commission/spread/liquidity adjusted before use. Missing sources
are reported (`S1_SOURCES_AVAILABLE:n/m`), never fabricated.

## 7. Account sync

`getAccountInfo()` calls `/v4/account` (unmetered, cached 60s) to reconcile
`request_limit` / `request_count` / reset state. Do not call it per frontend
request.

## 8. Verification

- `tests/quota-policy.test.ts` — unmetered endpoint classification
- `tests/oddspapi-filter.test.ts` — sharp book filtering
- `tests/sharp-consensus.test.ts` — no-vig, line preservation, exchange math
