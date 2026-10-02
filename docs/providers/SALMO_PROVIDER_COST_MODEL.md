# SALMO PROVIDER COST MODEL & QUOTA ECONOMICS

**Audit date:** 2026-10-02 · **Companion to:** `SALMO_PROVIDER_ARCHITECTURE_AUDIT.md`
**Rule applied:** never design a stack that consumes 95–100 % of a quota. Target operational headroom.

## Price verification status (read this first)

| Provider | Price | Verifiability |
|---|---|---|
| 5DFA Free / Pro / Ultra | $0 / **$5 mo** ($50 yr) / **$25 mo** ($250 yr) | **VERIFIED** — read directly off `5dollarfootballapi.com/pricing` |
| OddsPapi | Free tier $0; paid = **calculator** (bookmakers × sports × requests) | **PARTIAL** — model verified, unit prices behind client-side JS → **quote required** |
| Dribble360 Lite | $19/mo (500 calls) | **DOCUMENTED** (internal harvest report) |
| The Odds API | $0 (500/mo) / $30 (Starter, 20K credits) | **DOCUMENTED** (repo + vendor) |
| **API-Football Pro** | **as invoiced — confirm in dashboard** | **UNKNOWN** — `api-football.com` / `api-sports.io` return HTTP 403 to this environment. Repo docs quote "~$25/mo" for *Basic*, not Pro. |
| SportMonks / GoalServe | ~$50 / $500+ | DOCUMENTED (repo, historical) |

> No number in this document is invented. Where a price could not be verified it is marked
> **as invoiced / quote required** rather than estimated.

---

## 1. Quota economics — the decisive calculation

### 1.1 OddsPapi is the binding constraint

`quotaPolicy.ts` → `oddspapi: { period: 'MONTHLY', hardLimit: 250, softLimit: 200 }`.
The live pipelines currently use the **per-fixture** pattern:

```text
per pipeline run, per service (AH, OU, BTTS):
  1 × /v4/fixtures             (discovery, METERED)
  N × /v4/odds?fixtureId=…      (one call PER fixture, METERED)
```

| Scenario | Calls/day | Calls/month | vs 200 soft | vs 250 hard |
|---|---:|---:|---:|---:|
| 3 services × (1 discovery + 2 fixtures/run), 1 run/day | 9 | 270 | **135 %** | **108 % — BREACH** |
| 3 services × (1 discovery + 5 fixtures/run), 1 run/day | 18 | 540 | 270 % | 216 % — BREACH |
| 3 services × (1 discovery + 10 fixtures/run), 1 run/day | 33 | 990 | 495 % | **396 % — BREACH** |

**Conclusion: the current per-fixture pattern cannot operate inside the Free tier.** Any real
production cadence breaches the contractual ceiling, which the gateway would fail closed on
(`ODDS_QUOTA_EXHAUSTED` → `DATA_UPDATE_PAUSED`) — correct behaviour, but the product stops.

### 1.2 The fix does not require paying: use `/v4/odds-by-tournaments`

OddsPapi's own v4 documentation shows one call returning **fixtures *and* odds** for multiple
tournaments at once:

```text
GET /v4/odds-by-tournaments?bookmaker=pinnacle&tournamentIds=17,8&apiKey=…
```

| Pattern | Calls/day | Calls/month | vs 200 soft |
|---|---:|---:|---:|
| `/v4/odds-by-tournaments` for 10 whitelist tournaments, 1 run/day | 1 | 30 | **15 % ✅** |
| same, hourly pre-kickoff refresh (12 runs/day) | 12 | 360 | 180 % — breach |

**Aggregation at 1–6 runs/day is comfortably inside the Free tier; per-fixture fan-out is not.**
Quota-before-quota is the correct engineering answer here.

### 1.3 Other providers

| Provider | Ceiling | Modelled production need | Headroom |
|---|---:|---:|---|
| **API-Football** | 7,500/day hard (6,000 soft) | ~160/day (discovery + details + lineups + injuries) | **~97 %** |
| **5DFA Free** | 60/hour (no daily cap) | research only, bursty | adequate for research, **not** production polling |
| **5DFA Ultra** | 40/min (≈57,600/day theoretical) | fixture + odds + tick harvest | **ample** for 10 whitelist leagues |
| **Dribble360** | tier-dependent | **0** (offline corpus, cancelled) | n/a |
| **Football-Data.co.uk** | n/a (CSV) | 0 API calls | n/a |

Observed API-Football utilisation on audit day: **538 / 7,500 = 7.2 %**. The plan is roughly 55×
over-provisioned against current usage — it is kept for *breadth* (lineups, injuries, 100+ leagues),
not throughput.

---

## 2. Storage / volume economics

| Dataset | Scale | Storage posture |
|---|---|---|
| 5DFA Free research pull (5 leagues, 3 months) | ≈2.6 k fixtures + odds | small (tens of MB) |
| 5DFA Ultra historical warehouse (to 2014, 20 books, ticks) | 10⁷–10⁹ tick rows — **the real scale risk** | requires Parquet/DuckDB; see §4 |
| Football-Data.co.uk corpus | local CSVs, already committed | on disk |
| Dribble corpus | 489 MB `team_matches_*.jsonl` (70,651 rows) | **already on disk, frozen** |
| Ladder research JSONL | 54 MB `MARKET_METADATA.jsonl` | **git-ignored** (`.gitignore:133`) — must stay out of git |

**Cost-relevant warning:** 5DFA Ultra's "full tick history back to 2014" is the only line item in this
audit whose *storage* could exceed its *subscription*. Do not purchase Ultra without first sizing the
tick-history pull against a Parquet/DuckDB target.

---

## 3. Cost model

### 3.1 Current monthly stack

| Provider | Plan | Monthly | Notes |
|---|---|---:|---|
| API-Football | Pro | **as invoiced (CONFIRM)** | expires 2026-10-14 → renewal mandatory |
| OddsPapi | Free | $0 | 250/mo; production-blocked |
| 5DFA | Free | $0 | research only |
| Dribble360 | Elite trial | $0 | if billed, cancel |
| Football-Data.co.uk | CSV | $0 | licensing caveat |
| The Odds API | none | $0 | key absent |
| TheStatsAPI | none | $0 | key absent |
| FootyStats | placeholder | $0 | never in production path |
| **TOTAL** | | **= API-Football Pro only** | |

### 3.2 Recommended monthly stack

| Provider | Plan | Monthly | Δ |
|---|---|---:|---:|
| API-Football | Pro | as invoiced | 0 |
| OddsPapi | Free (retain) | $0 | 0 |
| **5DFA** | **Ultra** (conditional) | **$25** | **+$25** |
| Dribble360 | cancelled | $0 | − (trial/Elite fee) |
| Football-Data.co.uk | CSV | $0 | 0 |
| **TOTAL** | | **as invoiced + $25** | **+$25/mo** |

| Line | Amount |
|---|---:|
| Current monthly cost | API-Football Pro (as invoiced) |
| Recommended monthly cost | API-Football Pro + **$25** |
| **Incremental cost** | **+$25.00 / month** |
| Savings | Dribble360 subscription cancelled (fee TBD by invoice) |
| Annual commitment proposed | **NONE** — monthly billing only until gate G-5DFA-1 passes |

### 3.3 Current vs recommended stack

```text
CURRENT                                   RECOMMENDED
  API-Football Pro        (fixtures)        API-Football Pro      (fixtures)      unchanged
  OddsPapi Free           (odds, blocked)   OddsPapi Free         (validation)    demoted, not cancelled
  Dribble360 Elite trial  (health probe)    Dribble offline corpus (features)     subscription cancelled
  5DFA Free               (unused)          5DFA Ultra $25        (hist. odds)    upgraded (gated)
  Football-Data CSVs      (research)        Football-Data CSVs    (validation)    unchanged
```

### 3.4 Cheaper alternatives considered and rejected

| Option | Monthly | Why rejected |
|---|---:|---|
| The Odds API Starter | $30 | spreads ≠ true AH quarter lines; no per-book BTTS; $5 more than Ultra for less. |
| SportMonks Starter | ~$50 | 2× Ultra for capability SALMO already owns. |
| Dribble Lite | $19 | AH-only value; API-Football shots deliver ~80 % of the edge at $0. |
| Paid OddsPapi | quote req. | Only if a Premium/Pinnacle production tier is required; obtain the quote before paying. |

---

## 4. Open cost questions (must be closed before any purchase)

1. **API-Football Pro renewal price** — read from the dashboard before **2026-10-14**.
2. **OddsPapi paid quote** — for `pinnacle` + `soccer` + N requests/month.
3. **5DFA Ultra tick-history storage budget** — size before purchase (DuckDB/Parquet; task D4).
4. **Dribble360 cancellation confirmation** — stop the recurring charge; keep the corpus.

---

## 5. Procurement recommendation

| Action | Amount | Timing | Approval |
|---|---:|---|---|
| Renew API-Football Pro | as invoiced | **before 2026-10-14** | required |
| Buy 5DFA Ultra (monthly, not annual) | $25/mo | only after **G-5DFA-1** | required |
| Cancel Dribble360 | − (TBD) | this sprint | required |
| Request OddsPapi paid quote | $0 | this sprint | none (paper only) |
| Everything else | $0 | — | — |

**Target monthly operating cost: API-Football Pro + $25.00 (5DFA Ultra) + $0 + $0 + $0.**

### 5.1 Renewal & procurement decisions (recorded 2026-10-02)

```
API-FOOTBALL PRO RENEWAL  = APPROVED — PENDING BILLING EXECUTION
  Role      fixture / result / statistics authority (unchanged; NOT replaced by 5DFA)
  Expiry    2026-10-14
  Decision  RENEW (engineering decision; provider role architecture unchanged)
  Pending   the billing action itself has not been executed — no spend authorised
  Price     deliberately NOT hardcoded: read from the live invoice/dashboard,
            because api-football.com / api-sports.io return HTTP 403 to this
            environment and repo docs quote Basic, not Pro (§4 item 1)

5DFA ULTRA PURCHASE       = NOT APPROVED
  Gate      G-5DFA-1 remains OPEN (see SALMO_5DFA_UPGRADE_DECISION.md §7)
  Evidence  vendor evidence request issued: SALMO_5DFA_ULTRA_VENDOR_REQUEST.md
            status = PREPARED — NOT SENT (no outbound channel exists for the agent)
  Rule      trial/real API response BEFORE any purchase, never after

DRIBBLE360                = NO NEW SPEND
  Elite access runs to its documented expiry; no upgrade, no new
  feature-engineering project. Existing validated value only.
```

The `$25.00` Ultra line in the target above therefore remains **contingent** — it is not
committed spend until G-5DFA-1 closes with real API evidence.

