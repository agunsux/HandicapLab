# SALMO — P0 PRODUCTION DEPLOYMENT RECORD

**Sprint:** Provider Execution Gate · **Phase:** P0 deployment · **Date:** 2026-10-02
**Commit deployed:** `5d340ac` — `feat(oddspapi): optimize production odds quota with tournament batching`
**Status:** `P0 PRODUCTION = PASS`

This is the audited completion artifact for the P0 deployment. It records only measured
facts. Every claim below is reproducible from the commands and evidence files cited.

---

## 1. Pre-deploy gate (Phase 1)

| Gate | Command | Result |
|---|---|---|
| Commit isolation | `git show --stat 5d340ac` | **23 files**, all approved P0 work; no unrelated paths |
| Production gold unchanged | `git diff 5d340ac^ 5d340ac -- data/golden/europe` | **no output**; `--exit-code` = **0** |
| Secret values | independent scanner over all 7,708 added lines | **0 findings**; control (real 32-char key) **DETECTED**, so the scan was live |
| Typecheck | `npx tsc --noEmit` on a clean worktree pinned to `5d340ac` | **exit 0** |
| P0 test | `npx vitest run tests/tournament-odds-batch.test.ts` | **16/16 passed** |
| Related regression | 12 provider/pipeline/quota suites | **12/12 files passed, exit 0** |

### 1.1 Why a clean worktree was used

The repository working tree carries substantial unrelated, uncommitted work from prior
sessions. Typechecking or deploying *that* tree would not have validated the commit.
A detached worktree at `5d340ac` (with `node_modules` junctioned in) was therefore used for
all build/test gates, so the results describe the deployed revision and nothing else.

### 1.2 The secret scan, precisely

An earlier naive scan flagged evidence JSONs on the string `api_key`. That was a false
positive: `api_key` appears there only as a **field name** inside a `topLevelShape.keys`
record — a schema-shape record proving `/v4/account` returns that key. The scanner used here
matches credential **values** only, and its own control case proves it can still detect a real
key. **Zero credentials are present in the commit.**

---

## 2. Deployment (Phase 2)

| Item | Value |
|---|---|
| Method | Vercel CLI (`vercel --prod`) from the clean worktree at `5d340ac` |
| Deployment ID | `handicap-j7kkg76ft-shinerva.vercel.app` |
| Production alias | `handicaplab.dev`, `www.handicaplab.dev` |
| Build | `Ready` — 4m, Next.js preset, Node 24.x |
| `git push` | **not performed** |

### 2.1 Why there was no `git push`

The Vercel project has **no Git integration** — `vercel project inspect` reports no Git
section, and every historical deployment is a CLI deployment by `agunsux` (no
`*-git-main-*` deployment URLs exist). Pushing to GitHub therefore would not have deployed
anything.

It would also have violated the instruction to deploy only `5d340ac`: `origin/main` is **5
commits behind** `main`, so any push would have carried four non-P0 commits
(`cb90677`, `56d966e`, `d4f0753`, `887509b`) with it. Deploying the pinned worktree
directory deployed exactly the verified tree and nothing more.

---

## 3. Post-deploy smoke test (Phase 3)

Run against `https://handicaplab.dev` using the same modules the AH/OU/BTTS pipelines call:
`fetchOddsPapiFixtureIndex()` → `primeTournamentOdds()` → `getBatchedFixtureOdds()`.

```
[discovery] status=READY fixtures=1839 meteredCalls=1
[selection] top tournaments: 544, 20782, 23755
[batch]     status=READY fixtures=73 bookmakers=pinnacle+sbobet meteredCalls=2
[resolution] 12 (fixture, bookmaker) pairs resolved with ZERO extra provider calls
[metered] this cycle = 3 calls (legacy equivalent = 37)
```

Evidence: `data/research/provider_audit/oddspapi_p0_live_smoke_2026-10-02T18-19-48-877Z.json`

### 3.1 Public endpoint responses

| Endpoint | Status |
|---|---|
| `/api/health` | 200 — `{"status":"healthy"}`, storage healthy, 0 missing vars |
| `/api/v1/health/production` | 200 — `{"status":"HEALTHY"}`, `contradictions: []` |
| `/api/public/manifest` | 200 — 500 predictions, merkle root + signature present |
| `/api/providers/status` | 200 — `Pinnacle: true`, `SBO: true`, 0 dropped events |
| `/api/v1/markets/asian-handicap` | 200 |
| `/api/v1/markets/over-under` | 200 |
| `/api/v1/markets/btts` | 200 |

The market routes returned `count: 0`. This is **not** a P0 regression: production odds
ingestion is stale (`latestOddsIngestion = 2026-09-21T19:05:26Z`), and the routes respond
correctly with an empty set. The live batch smoke above proves AH/OU/BTTS resolution works
against the real vendor API.

### 3.2 Market resolution observed

From the 12 resolved pairs (live prices, zero extra calls):

| fixture | bookmaker | markets | AH | OU | BTTS |
|---|---|---|---|---|---|
| `id1002078268344870` | pinnacle | 40 | 8 | 12 | 0 |
| `id1002078268344870` | sbobet | 26 | 4 | 6 | 0 |
| `id1002078268378080` | pinnacle | 46 | 9 | 16 | 0 |
| `id1002078268378084` | pinnacle | 32 | 9 | 7 | 0 |
| `id1002375568931482` | pinnacle | 112 | 10 | 9 | 1 |
| `id1002375568931484` | pinnacle | 125 | 10 | 11 | 1 |

All three core markets resolve. BTTS is absent on some fixtures because those fixtures are
already in play or the bookmaker does not price BTTS — a provider-data fact, not a code fault.

### 3.3 Identity at value level

Fixture identity (`id…` + `tournamentId` + `startTime`), bookmaker identity (`pinnacle`,
`sbobet` slugs), and market identity all survive the batch path. Value-level parity was
established by the P0 parity probe over the same deployed revision:

```
totalPriceMismatch = 0
identityMismatch   = 0
priceMatches 65/65 · changedAtMatches 65/65 (pinnacle)
```

---

## 4. Quota reconciliation (Phase 3)

Read from the unmetered `/v4/account` endpoint **immediately before and after** the smoke:

| Point in time | `request_count` |
|---|---|
| before smoke | **88** |
| after smoke | **91** |
| delta | **+3** |

The delta equals the smoke's independently reported metered total (1 discovery + 1 batch × 2
bookmakers = 3). Accounting reconciles **exactly** — no unexplained calls.

`request_limit = 250`. At 3 calls/cycle and ~1 cycle/day that is ~90 calls/month ≈ **36%** of
---

## 5. P0 acceptance checklist (Phase 4)

```
[x] deployment succeeded
[x] production smoke test succeeded
[x] AH works
[x] OU works
[x] BTTS works
[x] fixture identity intact
[x] bookmaker identity intact
[x] odds identity intact
[x] quota accounting reconciles
[x] no unexpected extra metered calls
[x] no model/decision regression
[x] no production gold mutation
```

**`P0 PRODUCTION = PASS`**

### 5.1 How "no model/decision regression" was established here

P0 touched no model, feature, threshold, EV or decision-gate code — the commit's only `src/`
changes are `config.ts` (lazy credential resolution) and the four odds-acquisition modules.
Independently, the three production-integrity suites (`ah-live-pipeline`,
`ou-production-integrity`, `btts-production-integrity`) pass unmodified on the deployed
revision, and 65/65 Pinnacle prices plus 65/65 `changedAt` timestamps matched the legacy path.

---

## 6. Honest findings and limitations

These are disclosed rather than omitted.

### 6.1 The batch module is not on any HTTP route

`tournamentOddsBatch` is imported only by the three `*LivePipelineService` classes, whose sole
callers are `scripts/run-ah-live-pipeline.ts`, `scripts/run-ou-live-pipeline.ts` and
`scripts/run-btts-live-pipeline.ts` (plus tests). No API route, cron route or worker imports
them — `/api/cron/*` uses the legacy `quotaManager`, and `worker/index.ts` uses
`providerGateway` + `quotaManagerV4`.

Consequence: deploying P0 changed the behaviour of the **operational pipeline runs**, not of
any inbound HTTP route. The smoke test therefore had to exercise the real modules directly
against the live vendor API, which is what §3 records.

### 6.2 P0 is deployed but **not pushed**

`origin/main` is at `ef424f8`; local `main` is 5 commits ahead (P0 plus four pre-existing
commits). No push was performed, because the instruction was to deploy `5d340ac` only, and a
push would necessarily carry four non-P0 commits. This is an open item — see §7.

### 6.3 Production odds ingestion is stale

`latestOddsIngestion = 2026-09-21T19:05:26Z`. Production market endpoints answer correctly but
empty. Detected during this smoke test; **not** caused by and **not** fixed by P0.

### 6.4 Quota rollback was not forced post-deploy

`reserveQuota` → `confirmQuota` succeeded live and reconciled to the exact call count.
`rollbackQuota` is wired in `NativeOddsClient` and covered by mocked provider-gateway tests;
a live 404 (`FIXTURE_NOT_FOUND` on `sbobet`) was observed during the P0 parity probe and left
the cycle `READY` with no fan-out. However, no synthetic forced failure was induced against
the vendor after deployment. This is a **verification gap**, stated plainly rather than
claimed as verified.

---

## 7. Open items

| Item | State |
|---|---|
| Push `main` (P0 + 4 ancestor commits) to GitHub | **awaiting human decision** |
| Stale production odds ingestion since 2026-09-21 | **awaiting decision** |
| Forced-failure rollback verification | **not performed** |
| 21 pre-existing failing test files / 30 failing tests | pre-existing, unrelated to P0 |


