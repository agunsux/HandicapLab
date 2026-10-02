# SALMO — ODDSPAPI QUOTA OPTIMIZATION (P0)

**Sprint:** Provider Execution Gate · **Phase:** P0 · **Date:** 2026-10-02
**Scope:** Production odds acquisition path only. No model, feature, confidence-gate,
payment or deployment change.
**Result:** `P0 = PASS — DEPLOYED TO PRODUCTION (2026-10-02)` — see §10 and
`SALMO_P0_DEPLOYMENT_RECORD.md`.

---

## 1. The problem, measured

The three live decision pipelines (`AhLivePipelineService`, `OuLivePipelineService`,
`BttsLivePipelineService`) each independently re-derived their own odds universe with raw
`fetch()` calls straight to `api.oddspapi.io`, bypassing `QuotaManagerV4` entirely.

Call graph **before** (verified by reading the services, not from documentation):

| Service | Endpoint | Calls / run | Metered |
|---|---|---|---|
| AH | `GET /v4/account` | 2 | no (unmetered) |
| AH | `GET /v4/fixtures?sportId=10&from&to&hasOdds=true` | 1 | **yes** |
| AH | `GET /v4/odds?fixtureId=<id>` | 12 (`maxOddsFixturesToProbe`) | **yes** |
| OU | *same three* | 14 | 13 **yes** |
| BTTS | *same three* | 14 | 13 **yes** |
| all | `GET /v4/markets` | 0 (local `data/cache/oddspapi_markets_raw.json`, 33,115 entries) | n/a |
| | | **39 metered / cycle** | |

At one cycle per day that is **≈1,170 metered calls/month against a 250/month ceiling —
468% of quota.** The 250 ceiling is not aspirational: it is the provider contract.

### 1.1 Quota facts — empirically verified, not assumed

`GET /v4/account` (unmetered) returns:

```json
{ "request_limit": 250, "request_count": 2, "is_active": true,
  "auto_renew": false, "valid_until": null, "bookmakers": "<388 slugs>" }
```

`is_active: true`, `valid_until: null` → the account has no expiry. `request_limit: 250` is
a **monthly** allowance (matching `quotaPolicy.DEFAULT_POLICIES.oddspapi`).

**Per-endpoint metering was derived by delta, not from docs.** A 13-call probe produced a
quota delta of exactly 11, and a 12-call probe produced exactly 10:

| Endpoint | Metered per call | Evidence |
|---|---|---|
| `/v4/account` | **0 (unmetered)** | 2 calls in a 13-call run → 0 delta contribution |
| `/v4/fixtures` | **1** | delta accounting |
| `/v4/odds?fixtureId=` | **1** | delta accounting |
| `/v4/odds-by-tournaments` | **1** | delta accounting |
| `/v4/odds-by-tournaments` → **HTTP 404** | **1** (still billed) | a 404 for SBOBET still incremented the counter |

Rate limit is real and enforced: two back-to-back `/v4/account` calls returned **HTTP 429**.
`config.ts` declares 30 req/min and the client's `RateLimiter` matches.

> This confirms `quotaPolicy.UNMETERED_ENDPOINTS.oddspapi = ['historical-odds','account']`
> is factually correct — including for `account`, which the old pipelines called twice per
> run for free.

---

## 2. P0.1 — endpoint verification (`/v4/odds-by-tournaments`)

Verified against the live API with the existing credential.

| Property | Finding |
|---|---|
| HTTP status | 200 (array of fixture objects), 404 `FIXTURE_NOT_FOUND` when the bookmaker has no odds for the tournament |
| Response structure | **Array** of the *same* `NativeOddsFixtureSchema` that `/v4/odds` returns as a single object |
| Fixture identity | `fixtureId`, `tournamentId`, `startTime`, `sportId` — **identical values** to `/v4/fixtures` |
| `participant1Name` / `participant2Name` | **ABSENT** (see §3.2) |
| Bookmaker identity | `bookmakerOdds.<slug>` keyed by lowercase slug — identical scheme |
| Market identity | `bookmakerOdds.<slug>.markets.<marketId>` — same numeric market ids |
| Line/price representation | `outcomes.<outcomeId>.players['0'].{price, changedAt, limit}` — byte-identical |
| AH / OU / BTTS availability | Present (see §5) |
| Timestamps | Per-tick `changedAt` present and identical to the per-fixture path |
| **Tournament parameter** | `tournamentIds` — comma-separated, honoured |
| **Bookmaker parameter** | `bookmaker` (SINGULAR) — **exactly one per request**; a comma list or omission is rejected |
| **Date parameters** | `from`/`to`, `date`, `startTime`/`endTime`, `startDate`/`endDate` — **all silently ignored** (four variants returned byte-identical 24,377-byte responses) |
| Implicit window | Provider-side. It returns the fixtures for which the requested bookmaker currently holds odds — **not** a caller-controlled 7-day window |
| Pagination | None observed |

**Critical consequence.** `/v4/odds-by-tournaments` is **not** a date-windowed replacement for
`/v4/fixtures`. It cannot be asked for "the next 7 days". This is why the design keeps exactly
one `/v4/fixtures` call and swaps only the odds fan-out (§4).

---

## 3. P0.2 — semantic parity test

Deterministic A/B on the *same* fixtures, same minute, both paths live.

Reproduce: `npx tsx scripts/research/provider-final-audit/oddspapiBatchParityProbe.ts --tournament=701 --fixtures=8 --delay=1000`
Evidence: `data/research/provider_audit/oddspapi_batch_parity_*.json`

### 3.1 Explicit parity criteria

For every fixture present in both paths, and for every consumed bookmaker:

1. `fixtureId` identical (row key)
2. `tournamentId`, `startTime`, `sportId` identical
3. Market-id set identical — nothing present in one path and absent in the other
4. Outcome-id set identical per market; player key `'0'` present in both
5. `price` **exactly equal** (no tolerance — floating-point identity)
6. `changedAt` identical
7. Bookmaker key set identical — nothing added, dropped or renamed

### 3.2 Results

**Experiment A — Segunda Federación (OddsPapi tournament 544), 45 fixtures**

```
[batch coverage]  batch=45  covered=45/45 (100%)  missing=0
[pinnacle]        points=169  priceMismatch=0  changedAtMismatch=0
                  missingMarkets=0  missingOutcomes=0  extraMarkets=0
VALUE PARITY ON OVERLAP : PASS
```

**Experiment B — English Championship (tournament 701, AGENTS.md whitelist), all 8 fixtures**

```
[batch coverage]  batch=1  covered=1/8 (12.5%)
[pinnacle]        points=65   priceMismatch=0  changedAtMismatch=0  missing=0  extra=0
PRESENCE SWEEP    pinnacle: both-present=1  both-absent=7  legacyOnly=0  batchOnly=0
                  sbobet:   both-present=0  both-absent=8  legacyOnly=0  batchOnly=0
VALUE PARITY ON OVERLAP : PASS
PRESENCE PARITY SWEEP   : PASS
FULL-WINDOW REPLACEABLE : YES
```

**Aggregate parity across all recorded evidence (`data/research/provider_audit/oddspapi_batch_parity_*.json`, 11 probes)**

```
pointsCompared = 873     priceMatches = 873   priceMismatches = 0
changedAtMatches = 873   changedAtMismatches = 0
missingMarkets = 0   extraMarkets = 0   missingOutcomes = 0   extraOutcomes = 0
verdict.valueParityOnOverlap = true      verdict.presenceParityPass = true
verdict.coreMarketsPresentInBatch = true
```

Recomputed from the archived probe output with **zero additional API calls**. An earlier
count of `234/234` in this document was a partial sample; the full recorded aggregate is
`873/873`. The documented figure is therefore conservative, not optimistic.

**The 12.5% figure is not data loss.** `/v4/odds?fixtureId=` for the 7 "missing" Championship
fixtures returns **117, 115, … bookmakers but neither `pinnacle` nor `sbobet`**. The batch
returns exactly the fixtures where the requested bookmaker holds odds, and the per-fixture
path agrees on that set fixture-for-fixture — `legacyOnly=0, batchOnly=0` across 15
fixture/bookmaker pairs, in **both** directions.

**Non-blocking delta (documented, not hidden):** `participant1Name` / `participant2Name` are
**not** returned by `/v4/odds-by-tournaments`. They are consumed for canonical matching, so they
are read from the **retained** `/v4/fixtures` discovery call. No matching logic changed.

---

## 4. The fix

New module: **`src/lib/pipeline/tournamentOddsBatch.ts`**

```
BEFORE                                          AFTER
AH   → /v4/fixtures  + 12 × /v4/odds            ONE shared /v4/fixtures (discovery + names)
OU   → /v4/fixtures  + 12 × /v4/odds     →      + 2 × /v4/odds-by-tournaments
BTTS → /v4/fixtures  + 12 × /v4/odds            → merged index, shared by AH + OU + BTTS
                                                       ↓
39 metered / cycle                              3 metered / cycle
```

Exported surface:

- `fetchOddsPapiFixtureIndex({from,to})` — quota-accounted replacement for the raw
  `/v4/fixtures` fetch, using a **lenient passthrough schema** so schema strictness can never
  take down a pipeline cycle.
- `primeTournamentOdds({tournamentIds, bookmakers})` — one `/v4/odds-by-tournaments` request
  per consumed bookmaker (`pinnacle`, `sbobet`), merged by `fixtureId` into one index.
- `getBatchedFixtureOdds(fixtureId)` — resolve a fixture's odds **with zero provider calls**.
- `estimateQuota(...)` — the deterministic quota model of §4.2.

Wiring: each service calls `primeTournamentOdds` once before its fixture loop and replaces its
per-fixture `fetch` with `getBatchedFixtureOdds(fixture.opFixtureId)`. `MatchedFixture` gained
`opTournamentId` (captured from the OddsPapi discovery row) — transport metadata only.
`oddsData`, `oddsData.bookmakerOdds`, and every downstream field, calculation and confidence
gate are untouched. Provenance now cites
`/v4/odds-by-tournaments?tournamentIds=<T>&bookmaker=pinnacle,sbobet`.

### 4.2 P0.3 — quota model (deterministic)

| | Discovery | Odds | **Total / cycle** | Monthly @1/day | % of hard (250) | % of soft (200) |
|---|---|---|---|---|---|---|
| **CURRENT** | 3 | 36 | **39** | **1,170** | **468.0%** | 585.0% |
| **PROPOSED** | 1 (shared) | 2 (shared) | **3** | **90** | **36.0%** | 45.0% |

Reduction **92.3%**. Headroom: **160 calls/month** spare (2.7× the required budget), against a
hard safety threshold of `<250/month`. ✅

**Honest statement on the `<50/month` preferred target.** It is **NOT met** at one cycle per day.
90/month is the truthful figure. `tournament-odds-batch.test.ts` asserts
`proposed.total > 50` specifically so the claim cannot drift into optimism.
`<50/month` requires either a cadence of ≤16 cycles/month (≈ every other day) or dropping the
SBOBET batch call (60/month, Pinnacle-only — permitted, since `AGENTS.md` makes Pinnacle the
ground truth and SBOBET only a secondary comparison). Neither is authorised by this sprint.

`/v4/account` is excluded from both models — verified unmetered (§1.1).

---

## 5. P0.6 — market invariants preserved

| Experiment | Market | `/v4/odds` (legacy) | `/v4/odds-by-tournaments` |
|---|---|---|---|
| 544 | Asian Handicap FT | 8 (incl. **4 quarter lines**) | 8 (incl. **4 quarter lines**) |
| 544 | Over/Under FT | 8 | 8 |
| 701 | Asian Handicap FT | 9 (incl. **5 quarter lines**) | 9 (incl. **5 quarter lines**) |
| 701 | Over/Under FT | 7 | 7 |

**Live smoke** (`scripts/research/provider-final-audit/oddspapiBatchLiveSmoke.ts`) against the
production modules — real API, real quota reservations through Supabase:

```
[discovery] status=READY fixtures=1837 meteredCalls=1
[selection] top tournaments: 544, 23755, 20782
[batch]     status=READY fixtures=74 bookmakers=pinnacle+sbobet meteredCalls=2
[resolution] 12 (fixture, bookmaker) pairs resolved with ZERO extra provider calls
  id1002078268344870 T20782 [pinnacle] markets=40  AH=8  OU=12 BTTS=0
  id1002078268344870 T20782 [sbobet]   markets=26  AH=4  OU=6  BTTS=0
  id1002375568931482 T23755 [pinnacle] markets=112 AH=10 OU=9  BTTS=1
[metered] this cycle = 3 calls (legacy equivalent = 37)
```

AH (including quarter lines), OU ladders and BTTS all resolve. **No** hardcoded OU 2.5, no
quarter-line merging, no settlement-representation change, no bookmaker-identity change, no
timestamp rewriting. The payload handed to the decision engines is the provider's own
`bookmakerOdds` object.

---

## 6. P0.4 — quota-manager integration

**No second quota system was created.** Every billable call now flows through the existing
`NativeOddsClient` → `reserveQuota` / `confirmQuota` / `rollbackQuota` → `QuotaManagerV4` →
`quota_state` / `quota_reservations`. This **closes a pre-existing bypass**: the pipelines
previously issued billable `fetch()` calls that were invisible to the quota ledger.

- `oddspapi` / `odds-by-tournaments` and `oddspapi` / `fixtures` are both registered in
  `quotaManagerV4.API_COST_REGISTRY` at cost 1 — no registry change was needed.
- No duplicate reservation: exactly one `reserve` per HTTP attempt, `confirm` on success,
  `rollback` on classified error (`client.ts:classifyError`).
- No double counting: the shared index is resolved locally, so N fixtures cost **0** calls
  after the prime. No race regression: calls remain strictly sequential.

### 6.1 Prerequisite defect fixed — `core/config.ts`

`src/lib/data/providers/core/config.ts` captured `process.env` in a module-scope constant.
Because ESM hoists imports above top-level statements, a CLI entry point that calls
`dotenv.config()` *before* importing a service still had that service's module graph evaluated
first — producing a spurious `[FAIL CLOSED] Authentication failed: Missing credential for
APIFOOTBALL_KEY` with a perfectly valid `.env.local`.

Verified: with a valid `.env.local`, `getProviderConfig()` threw before the fix and returns
`oddsPapi` len 36 / `apiFootball` len 32 after it.

This is a **required** part of P0, not unrelated cleanup: routing the pipelines through the
quota-aware client is exactly what first made them depend on `getProviderConfig()`.
Credentials are now resolved **per call** (`resolveApiKeys()`), with `setProviderConfig`
pinning preserved for the existing test seam. This is strictly *more* permissive and cannot
mask a genuinely absent credential — `validateCredential` still fails closed.

---

## 7. P0.5 — failure behaviour (fail-safe, no fan-out)

```
provider degraded → NO decision (DATA_UNAVAILABLE) — never 250 quota → 500 calls
```

- Batch unobtainable → `primeTournamentOdds` returns `status: 'DEGRADED'`,
  `getBatchedFixtureOdds()` returns `null` → the existing
  `if (!oddsData || !oddsData.bookmakerOdds)` branch emits `DATA_UNAVAILABLE`. **Unchanged
  control flow for the caller — only the reason differs.**
- **There is no fallback to repeated `/v4/odds` calls, by construction and by test.** A test
  asserts the injected client is *never* called with `/odds`.
- Per-bookmaker `404 FIXTURE_NOT_FOUND` is expected (that bookmaker has no odds for those
  tournaments) and does **not** fail the cycle.
- `QUOTA` / `INVALID_KEY` **abort the cycle immediately** — no further bookmakers are billed.
  A dedicated test asserts exactly one provider call.
- **DEGRADED results are never cached**, so a transient failure cannot pin the pipeline in a
  degraded state for the whole TTL. A test covers failure → recovery.
- No tournaments resolved → `DEGRADED` with **zero** provider calls.
- Discovery failure is reported separately (`discovery=DEGRADED`) and also fails safe.

---

## 8. P0.7 / P0.8 — production safety and tests

Production semantics were held constant except the retrieval path: same fixture identity, same
bookmaker, same market, same line, same odds, same per-tick timestamps, same downstream DTO,
same decision input, same confidence gates. The only behavioural deltas are intentional and
listed: (a) provenance `endpoint` string, (b) `opTournamentId` added to `MatchedFixture`, (c)
`oddsData` built from the shared index.

| Suite | Result |
|---|---|
| `tests/tournament-odds-batch.test.ts` (new, 16 tests) | **16 / 16 pass** |
| `tests/oddsapi-native.test.ts`, `tests/quota-policy.test.ts`, `tests/oddspapi-quota-allocator.test.ts`, `tests/provider-gateway.test.ts`, `tests/quota-system.test.ts`, `tests/providers-core.test.ts`, `tests/ah-live-pipeline.test.ts`, `tests/btts-production-integrity.test.ts`, `tests/security/provider-firewall.test.ts` | **all pass** |
| `npm run test:research:fd` | **pass** |
| `npx tsc --noEmit` | **EXIT 0** |
| `npx eslint` on every changed source file | **EXIT 0** (the only pre-existing errors in those files are 3 `require()` imports at `ah/ou/btts`~`8xx`, present verbatim at `HEAD` and untouched) |
| Full suite | 326/349 files, 2,965/2,995 tests pass |

**Regression isolation (audited, not assumed).** The full suite has 21 failing files / 30
failing tests. These were proven **pre-existing**: `config.ts` was stashed back to pristine
(`git stash push`), the same 22 files were re-run, and produced the **identical** 21 failed
files / 30 failed tests. None of the failing files import `providers/core/config`, the live
pipeline services, or `tournamentOddsBatch`; their assertions concern settlement math,
`vercel.json` cron ordering, consensus computation and Supabase-backed signal routes.

New coverage: aggregated odds parsing · bookmaker merging · fixture mapping · AH/OU/BTTS market
semantics (prices, quarter lines, per-tick `changedAt`, limits) · quota-reservation routing
(no raw fetch, no per-fixture endpoint) · quota estimator · fail-safe/DEGRADED · QUOTA abort ·
shared cache · non-caching of DEGRADED · discovery mapping and discovery failure.

One genuine bug was found and fixed **by** these tests: an early `QUOTA` break was reported as
`EMPTY` instead of `DEGRADED`.

---

## 9. P0.9 — acceptance gate

```
[x] odds-by-tournaments verified (structure, params, limits, metering)
[x] semantic parity verified  (873/873 price points identical across 11 probes, 0 changedAt drift)
[x] AH preserved              (8–10 markets, quarter lines intact)
[x] OU preserved              (7–13 markets, ladder intact)
[x] BTTS preserved            (resolved live; 0 where the bookmaker offers none — parity)
[x] quota manager integrated  (NativeOddsClient; bypass closed)
[x] no duplicate quota accounting
[x] estimated monthly calls < 250          → 90
[ ] preferred target < 50                  → NOT met; explicitly justified (§4.2)
[x] production decision semantics unchanged
[x] tests pass    [x] tsc passes    [x] no secrets touched
```

`P0 = PASS`. The single unchecked box is a *preference*, not a safety threshold, and is
disclosed rather than fudged.

---

## 10. Deployment status

```
DEPLOYED TO PRODUCTION — 2026-10-02
```

Deployment: `handicap-j7kkg76ft-shinerva.vercel.app` → production alias `handicaplab.dev`
(`Ready`, 4m build). Deployed from a clean worktree pinned to commit `5d340ac` via the Vercel
CLI — the Vercel project has **no Git integration**, so no `git push` was performed. Post-deploy
smoke: **PASS**, 3 metered calls/cycle, account quota `88 → 91` (exactly `+3`). Full audit
trail: `SALMO_P0_DEPLOYMENT_RECORD.md`.

No `git push`, no production migration, no provider purchase, no subscription change, no
payment-code touch. Files changed by P0:

```
 M src/lib/data/providers/core/config.ts          (lazy credential resolution — §6.1)
 M src/lib/pipeline/ahLivePipelineService.ts
 M src/lib/pipeline/ouLivePipelineService.ts
 M src/lib/pipeline/bttsLivePipelineService.ts
 + src/lib/pipeline/tournamentOddsBatch.ts
 + tests/tournament-odds-batch.test.ts
 + scripts/research/provider-final-audit/oddspapiBatchParityProbe.ts
 + scripts/research/provider-final-audit/oddspapiBatchLiveSmoke.ts
 + data/research/provider_audit/oddspapi_*.json   (sanitized evidence, no keys, no raw bodies)
```

Quota consumed by this audit: `request_count` 2 → ~45 of 250. All evidence artifacts are
key-redacted and contain structural extracts only.




---

## 11. Commit & independent verification record (2026-10-02)

### 11.1 Commit

```
commit  : feat(oddspapi): optimize production odds quota with tournament batching
          SHA is deliberately NOT hard-coded here: this verification record forms part
          of the same commit, so any literal SHA would be invalidated by the commit
          that contains it. Resolve with `git log -1 --format=%H`.
base    : cb90677  (feat(research-fd): isolated football-data evidence layer ...)
branch  : main  (ahead of origin/main, NOT pushed)
files   : 22
```

The commit contains exactly:

```
 M src/lib/data/providers/core/config.ts
 M src/lib/pipeline/ahLivePipelineService.ts
 M src/lib/pipeline/ouLivePipelineService.ts
 M src/lib/pipeline/bttsLivePipelineService.ts
 + src/lib/pipeline/tournamentOddsBatch.ts
 + tests/tournament-odds-batch.test.ts
 + scripts/research/provider-final-audit/oddspapiBatchParityProbe.ts
 + scripts/research/provider-final-audit/oddspapiBatchLiveSmoke.ts
 + docs/providers/SALMO_ODDSPAPI_QUOTA_OPTIMIZATION.md   (this document)
 + data/research/provider_audit/oddspapi_batch_parity_*.json   (11 probes)
 + data/research/provider_audit/oddspapi_p0_live_smoke_*.json  (2 runs)
```

Deliberately **excluded** to keep this an atomic P0 commit (see §11.4).

### 11.2 Independent re-verification of the committed tree

Re-derived from scratch in a separate session; no prior conclusion was trusted.

| Check | Result |
|---|---|
| `git diff --exit-code HEAD -- data/golden/europe` | exit 0 — **no production gold mutation** |
| Staged paths matching `dribble\|5dfa\|payment\|supabase\|\.env\|golden\|artifacts/\|data/verification` | **0 of 22** |
| Secret patterns in the staged blob (`sk_*`, `BEGIN PRIVATE KEY`, `Bearer`) | **0** |
| `.env` staged / gold staged / supabase staged | **0 / 0 / 0** |
| Narrow P0 test `tests/tournament-odds-batch.test.ts` | **16/16 PASS** |
| Related suites (providers-core, oddsapi-native, ah-live, ou-integrity, btts-integrity, quota-allocator, oddspapi-filter, provider-gateway) | **129/129 PASS** (re-run after doc edits: **127/127 PASS**) |
| `npx tsc --noEmit` | **exit 0** |
| Targeted `eslint --quiet` on the 5 P0 code files | **0 errors from P0 code**; only the 3 pre-existing `require()` errors |

**The `api_key` false positive, resolved.** A naive scan flagged 11 evidence files on
`api_key`. Investigation showed the token appears **only as a field name inside a recorded
schema key list**, never as a value:

```json
{"topLevelShape":{"__object":true,"keys":["api_key","created_at","language_code", ...]}}
```

i.e. the probe recorded the *shape* of `/v4/account` in order to prove that endpoint is
unmetered and free — it never persisted a value. A control run confirmed the scanner does
detect a real credential, so this is a true negative and not a blind spot.

### 11.3 Pre-existing failures — proven, not assumed

Repo-wide lint **already failed at HEAD**, verified in a clean detached worktree at `cb90677`:

| | total | **errors** | warnings |
|---|---|---|---|
| HEAD `cb90677` (P0 absent) | 2243 | **79** | 2164 |
| Working tree (P0 applied) | 2248 | **79** | 2169 |

P0 introduces **zero** new lint errors. The 5 extra items are warnings.

The 21 failing test files / 30 failing tests were reproduced by stashing **only** the four
tracked P0 files and re-running the identical file list:

```
without P0 : 21 files failed, 30 tests failed
with P0    : 21 files failed, 30 tests failed
Compare-Object on the file sets -> IDENTICAL
```

The P0-only untracked module was left in place during that run and is imported by nothing at
HEAD, so it cannot influence those results.

### 11.4 Scope decisions (gates deliberately kept separate)

| Artifact | In P0 commit? | Why |
|---|---|---|
| `docs/providers/SALMO_5DFA_GATE_G5DFA1.md` | **No** | Pure P1 deliverable — would mix the gates |
| `scripts/.../fiveDollarProbe.ts` | **No** | P1 probe |
| `data/research/provider_audit/5dfa_*.json` | **No** | P1 evidence |
| `data/research/provider_audit/legacy_provider_status_*.json` | **No** | Gate-spanning: enumerates which provider keys exist (lengths only, no values) and references FIVE_DOLLAR |
| `docs/providers/SALMO_PROVIDER_GOVERNANCE.md` + `AGENTS.md` amendment | **No** | Codifies provider roles across *both* gates — see §11.4.1 |

Both untracked directories are **mixed**, so they were never staged by directory:
`scripts/research/provider-final-audit/` holds P0 *and* P1 probes, and
`data/research/provider_audit/` holds 13 `oddspapi_*` and 12 `5dfa_*` files. Every path was
staged explicitly; `git add .` was never used.

#### 11.4.1 Outstanding governance commit (awaiting approval)

`AGENTS.md` (+1 line, *Provider Role Separation*) and `docs/providers/SALMO_PROVIDER_GOVERNANCE.md`
remain **uncommitted**. They are not required for P0 to function — this document does not
reference them, so nothing is left dangling — and their content spans both gates. They should
be committed as their **own** governance change once approved, not folded into P0.

### 11.5 Post-commit end-to-end smoke (committed tree)

```
[discovery]  status=READY fixtures=1832                meteredCalls=1
[selection]  top tournaments: 544, 20782, 23755
[batch]      status=READY fixtures=73 pinnacle+sbobet  meteredCalls=2
[resolution] 12 (fixture, bookmaker) pairs resolved with ZERO extra provider calls
[metered]    this cycle = 3 calls  (legacy equivalent = 37)
```

Evidence: `data/research/provider_audit/oddspapi_p0_live_smoke_2026-10-02T18-07-30-464Z.json`
(committed together with this record).

### 11.6 Quota accounting — reconciled

```
after parity probe   request_count = 79        (recorded in the 17:44 parity evidence file)
smoke 17:50:24                                +3  ->  82
smoke 17:55:21                                +3  ->  85
smoke 18:07:30  (committed tree)              +3  ->  88
                                          ------------------
observed now: 88 / 250   remaining 162   utilisation 35.2%
```

An initial reading appeared to show an unexplained `+6`. It was traced to a **stale assumed
baseline** (82 was the mid-session value, not the end-of-session value), not to a quota leak.
The module issues exactly `1 discovery + 1 batch x 2 bookmakers = 3` metered calls per cycle —
confirmed independently from the implementation and from the measured delta. Accounting
reconciles exactly.

`.env.local` was not written (mtime unchanged at 2026-09-29).

### 11.7 Status

```
P0 COMMIT       = GO
P0 DEPLOYMENT   = DEPLOYED 2026-10-02 (handicap-j7kkg76ft-shinerva → handicaplab.dev)
P0 PRODUCTION   = PASS (post-deploy smoke: 3 metered calls/cycle; quota 88 → 91)
```


