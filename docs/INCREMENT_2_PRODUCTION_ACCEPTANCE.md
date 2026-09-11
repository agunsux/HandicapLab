# INCREMENT 2 — PRODUCTION ACCEPTANCE

Executed 2026-09-11. Scope: production quota activation, REAL historical
entry/closing odds ingestion (unmetered), deterministic canonical fixture-ID
mapping. No model changes. No UI redesign. No monetization. No commit.

## Executive status

```text
CONDITIONAL GO
```

All Increment 2 P0 acceptance criteria pass with executable evidence. Two
operational blockers remain outside the code scope:

1. **DDL unavailable** — `provider_fixture_map` table and `historical_odds`
   provenance columns (migration `20260911000001`) could not be applied to the
   production database (no DB password; pooler/direct hosts unreachable from
   this environment). Mapping decisions and odds rows are therefore persisted
   as auditable JSONL artifacts, and DB writes are skipped + classified.
2. **API-Football subscription renews today** — live probe shows plan `Pro`,
   active until `2026-09-11T23:27:51Z`; renewal must be verified before relying
   on the 7,500/day limit tomorrow.

## Quota

| Check | Result | Evidence |
| --- | --- | --- |
| API-Football hard = 7,500/day | PASS | live `/status`: `x-ratelimit-requests-limit=7500`, plan `Pro` |
| API-Football soft = 6,000/day | PASS | `quotaPolicy` + `tests/quota-policy.test.ts` |
| OddsPapi hard = 250/month | PASS | live `/v4/account`: `request_limit=250` |
| OddsPapi soft = 200/month | PASS | policy + tests; protection label `ODDS_QUOTA_PROTECTION` |
| Historical unmetered | PASS | 40+ historical-odds calls → billable count moved 187→188 (+1 = `/v4/markets` catalog only) |
| RPCs exist | PASS | PostgREST schema lists all 4 (`reserve/confirm/rollback/cleanup_stale`) |
| Reservation | PASS | probe reserve issued a reservation id |
| Confirmation | PASS | probe confirm ok; second confirm → `ALREADY_CONFIRMED` |
| Rollback | PASS | probe rollback ok; second rollback → `ALREADY_ROLLED_BACK` |
| Cleanup | PASS | `cleanup_stale_reservations(0)` HTTP 204 |
| Hard-limit protection | PASS | probe limit=1: first reserve ok, second → `QUOTA_EXHAUSTED` |
| Hard-limit alignment | PASS | 31/31 `quota_state` rows aligned (`safe_limit = limit_value`, reserve 0%) |

Probe artifacts: `data/verification/increment2_quota_verification.json`
(20 PASS / 0 FAIL / 0 SKIP).

Note on the historical 300/day rows: those `limit_value`s came from the
gateway falling back to `x-ratelimit-limit` (the **per-minute** limit) when the
daily header was absent. The gateway now prefers `x-ratelimit-requests-limit`
(7,500) and the rows are aligned.

## Historical odds (OddsPapi, unmetered)

Controlled sample: one finished Premier League fixture per month (Feb–May
2026), bookmaker `pinnacle`, entry window 14 days, closing = latest
observation at/before kickoff.

| Metric | Count |
| --- | ---: |
| Raw provider observations | 158,639 |
| Normalized observations | 158,639 |
| Invalid odds skipped | 0 |
| Fixtures processed | 4 / 4 |
| Fetch failures | 0 |
| Markets ready | 202 |
| Markets no valid observations | 118 |
| Unsupported markets (classified) | 170 |
| Entry observations valid | 412 |
| Closing observations valid | 412 |
| Both valid | 412 |
| Single observation | 0 |
| Missing closing | 0 |
| Entry after closing | 0 |
| Invalid timestamps | 0 |
| Closing-after-kickoff rejected (in-play) | 74,760 |
| Outside 14-day entry window | 1,585 |
| Storage rows built | 404 (202 markets × opening/closing) |
| Partial books | 0 |
| Rows rejected | 118 (`NO_VALID_OBSERVATIONS`) |

Artifacts (real payloads + derived rows):
`data/historical/oddspapi/ingested/2026-09-11T07-46-23-182Z/`
(`report.json`, `mapping.jsonl`, `historical_odds_rows.jsonl`) and
`data/historical/oddspapi/raw/*.json`.

Line preservation verified in output: AH lines `-2.5 … +0.75`, OU lines
`0.5 … 11.5`, BTTS stored as yes/no, each as a distinct row with per-side
timestamps. No fabricated closing: closing is only the last pre-kickoff
observation.

### Bookmaker availability (real provider responses)

| Bookmaker | Historical odds |
| --- | --- |
| Pinnacle (S1) | AVAILABLE (200) |
| SBOBet (S1) | NOT IN SUBSCRIPTION / no data |
| Betfair Exchange (S1) | requires 1 bookmaker + 1 outcomeId per call; no sample data returned |
| Singbet/IBC (S2) | 404 no data |
| Circa / Matchbook / Betdaq | 404 no data |

Consequence: CLV reference is currently **Pinnacle-only** (source diversity
`LOW_SOURCE_DIVERSITY`). This is reported, never substituted.

## Fixture mapping

| Status | Count |
| --- | ---: |
| MAPPED | 4 |
| UNMAPPED | 0 |
| AMBIGUOUS | 0 |
| CONFLICT | 0 |
| Duplicate provider events | 0 |

Method: explicit alias table (real provider names → canonical display names,
`data/identity/team_aliases.json`) + league map (`17 → ENG-PL`) + calendar-date
equality; provider-ID crosswalk supported as the first-priority rule. Mapping
failure modes (missing id, unresolved team, orientation conflict, ambiguous
duplicates, missing explicit target) are unit-tested in
`tests/fixture-mapping.test.ts` (13 tests).

## CLV readiness

- matches with valid entry: 4
- matches with valid closing: 4
- matches with both: 4
- matches missing closing: 0
- line mismatches: 0
- mapping failures: 0

CLV **computation** is not published: canonical storage is blocked (see
blocker 1) and no ROI/CLV claim is made from a 4-match sample.

## BTTS readiness

BTTS rows were produced from real Pinnacle prices (16 rows in the sample,
yes/no preserved). BTTS remains fail-closed for market claims until the
canonical storage + validation gate runs on a sufficient sample.

## Test status

| Suite | Result |
| --- | --- |
| `npx tsc --noEmit` | 2 pre-existing errors only (test files unrelated to Increment 2) |
| `npx eslint` (new modules) | 0 errors (7 warnings, `any`) |
| `npx vitest run` | 221 passed / 18 failed / 2 skipped |

All 18 failing files are pre-existing and unrelated: none imports any
Increment 1/2 module (verified by import scan), and the same set failed before
Increment 2. Root causes:

- 13 files: `vi.spyOn(supabase, 'from')` → "from does not exist" against the
  lazy Proxy in `src/lib/supabase.server.ts` (mock/environment defect).
- `signal-feed`, `trust-dashboard`: mocked feed returns `[]` (mock contract
  mismatch).
- `competition-intelligence`: empty plugin output (mock mismatch).
- `epic59-public-terminal`: stale constant expectation
  (`AUDITED_RESEARCH_BASELINE` vs `RESEARCH_ONLY`).
- `epic61-real-data-lock`: pre-existing TS error (Promise iterator) + mock.
- `epic31b/orchestrator`: order-dependent (passes alone).

New Increment 2 tests: `tests/fixture-mapping.test.ts` (13) and
`tests/historical-odds-pipeline.test.ts` (14) — all passing.

## Files changed (uncommitted)

```text
data/identity/team_aliases.json                      (new)
data/identity/league_map.json                        (new)
src/lib/identity/fixtureMapping.ts                   (new)
src/historical/oddspapi/marketCatalog.ts             (new)
src/historical/oddspapi/observationSeries.ts         (new)
src/historical/oddspapi/storageRows.ts               (new)
src/lib/data/providers/odds/native/schemas.ts        (tolerant historical entry schema)
src/lib/data/providers/odds/native/normalize.ts      (invalid-entry classification)
supabase/migrations/20260911000001_increment2_mapping_and_odds_provenance.sql (new)
scripts/verify/production-quota-verification.ts      (new)
scripts/verify/activate-quota-policy.ts              (new)
scripts/verify/api-football-plan-probe.ts            (new)
scripts/verify/db-connectivity-probe.ts              (new)
scripts/verify/oddspapi-historical-probe.ts          (new)
scripts/verify/oddspapi-historical-matrix-probe.ts   (new)
scripts/verify/oddspapi-markets-catalog.ts           (new)
scripts/verify/historical-odds-sample-ingest.ts      (new)
scripts/verify/_load-env.ts                          (new)
tests/fixture-mapping.test.ts                        (new)
tests/historical-odds-pipeline.test.ts               (new)
tests/quota-policy.test.ts                           (OddsPapi transition case)
```

## Recommended next action

1. Apply `supabase/migrations/20260911000001_increment2_mapping_and_odds_provenance.sql`
   with DDL credentials, then re-run
   `npx tsx scripts/verify/historical-odds-sample-ingest.ts --reuse-raw=1` to
   write the mapping/odds rows into canonical storage.
2. Verify API-Football Pro renewal after 2026-09-11T23:27Z.
3. Only after 1–2: extend the sample, run the CLV gate, and only then consider
   any performance claim. No commit until explicitly approved.
