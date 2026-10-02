# SALMO — 5DollarFootballAPI UPGRADE DECISION

**Audit date:** 2026-10-02 · **Credential:** Free (`plan: "free"`, `environment: "live"`)
**Companion to:** `SALMO_PROVIDER_ARCHITECTURE_AUDIT.md`
**FINAL ANSWER: `UPGRADE TO ULTRA` — conditional on gate G-5DFA-1. No purchase has been made.**

---

## 1. Why this audit had to be redone

The repository already contained a verdict. It is **wrong**, and this section documents why — because
a decision built on a broken probe is worse than no decision.

`data/verification/PROVIDER_BAKEOFF_AUDIT_REPORT.json` (2026-09-29) records:

```json
"fiveDollar": {
  "rateLimitLimit": "60", "rateLimitRemaining": "0",
  "leaguesCount": 0, "fixturesCount": 0, "sampleFinished": null,
  "markets": { "asianHandicap": null, "goalline": null, "goallineFixedCount": 0, "btts": null },
  "oddsHistorySupported": false, "earliestFixtureUtc": "Unknown" },
"executiveDecisions": { "fiveDollarDecision": "REJECT" }
```

and explains the rejection as "*Bet365-only coverage, paywalled Pinnacle, 3-month history cap,
60 req/hr rate limit, and lack of xG*" with Pinnacle "*behind **$49/mo** Ultra*".

Findings from this audit:

| Bakeoff claim | Reality (verified) |
|---|---|
| `rateLimitRemaining: "0"` | **The probe exhausted its own window** — `usage.today: 11` on a 60/hour limit. Self-inflicted, not a provider limit. |
| `leaguesCount: 0`, `fixturesCount: 0` | Probe artefact. `/leagues` returns **5**; `/leagues/{id}/fixtures` returns **50** (paginated). |
| `goallineFixedCount: 0`, "empty goal ladders" | **Wrong.** `goal_line_fixed` returns an **8-line ladder** (0.5→7.5) with over/under prices. |
| Pinnacle "$49/mo Ultra" | **Wrong price.** The provider's pricing page states **$25/mo** ($250/yr). |
| `earliestFixtureUtc: "Unknown"` | **Resolved:** 3-month window, verified by the 403 boundary probe. |
| Four 0-byte scripts | `scripts/scratch/{audit-fivedollar-deep,test-fivedollar-history-window,test-fivedollar-lines-history,test-fivedollar-params}.ts` are **all 0 bytes** — the audit was never implemented. |
| "Bet365-only coverage" | **Correct** — and now explained by the provider's own error docs. The one claim that survives. |

---

## 2. Free tier — empirical account audit

```text
GET /v1/status                              HTTP 200
plan: "free"    environment: "live"    key created 2026-09-29    expires: null
limits: rate_limit 60 per 3600s · burst 20/min · daily_limit null · daily_reset_at null
usage:  today 11
```

**`daily_limit: null` means there is no daily cap** — the 60/hour window is the only throttle, so a
patient crawler can move ~1,440 requests/day without paying. This is materially more generous than the
bakeoff's framing implied.

---

## 3. 5DFA market audit (Free, Bet365 only)

### 3.1 Leagues on Free — exactly the five Tier-1 whitelist leagues

England Premier League · France Ligue 1 · Germany Bundesliga I · Italy Serie A · Spain La Liga.

**Absent from the AGENTS.md whitelist:** Championship, Eredivisie, J1 League, K League, Liga 1 Indonesia.

### 3.2 Bookmakers — **catalogue ≠ payload**

`/bookmakers` lists **21** including `pinnacle`, `crown`, `macauslot`, `hkjc`, `chinasportslottery`.
A six-fixture sweep returned **`[Bet 365]` for every single fixture**. The provider's own error
documentation is explicit: `403 insufficient_plan` covers "*a bookmaker other than Bet365 below Ultra*".

> **Consequence for SALMO:** on Free, 5DFA can **never** supply a Pinnacle CLV reference — the stated
> ground truth in `AGENTS.md`. Free is therefore structurally incapable of serving as the
> production or historical CLV authority.

### 3.3 Markets actually priced for Bet365 (verified)

| Market | Present | Notes |
|---|---|---|
| `1x2` | ✅ | opening / closing / inplay |
| `asian_handicap` | ✅ | **quarter lines present** — opening `-1`, closing `-1.25` |
| `goal_line` | ✅ | main total line |
| **`goal_line_fixed`** | ✅ | **8 lines: 0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5** |
| **`btts`** | ✅ | yes/no opening + closing |
| `asian_handicap_half` | ✅ | half-time AH |
| `goal_line_half` | ✅ | half-time total |
| `corner_line`, `corner_asian` | present, null for probed fixture | not a SALMO market |
| `card_line`, `card_asian` | present, null | not a SALMO market |

**SALMO coverage implication:** 5DFA Free's *market* coverage is **broader than football-data.co.uk**
on exactly the markets football-data lacks — it has **BTTS** (football-data has none) and a **full OU
ladder** (football-data has only `2.5`), plus quarter-line AH. What blocks it is **bookmaker identity**
(Bet365, not Pinnacle) and **3-month depth**.

### 3.4 Endpoint semantics — an important trap

- `/v1/fixtures/{id}` → line **movement values only** (`opening`/`closing`/`inplay` line *numbers*, no prices).
- `/v1/fixtures/{id}/odds` → **prices** per bookmaker.
- `/v1/fixtures/{id}/statistics` → `attacks, dangerous_attacks, shots_on_target, shots_off_target,
  possession, first_half` — **no xG**.
- `/v1/fixtures/{id}/events` → works (31 events, `type/minute/team/count`).

Anyone wiring SALMO to the wrong one of these will ingest lines where they expected prices.

---

## 4. Historical depth — verified boundary

| Probe (24 h window) | Result |
|---|---|
| 14 days back | `200` — data returned |
| 45 days back | `200` — 0 fixtures that day |
| **100 days back** | **`403 insufficient_plan`** |
| **400 days back** | **`403 insufficient_plan`** |

Verbatim error: *"This request reaches back beyond your plan's history window (last **3 months**).
Pro covers **12 months**, Ultra **everything back to 2014**."*

`/v1/leagues/{id}` still lists **10 seasons** of metadata (15/16 … 26/27) on Free — the *season index*
is readable, the *fixtures* behind it are not. Note the list skips **21/22 and 22/23**.

---

## 5. Tick-history audit

```text
GET /v1/fixtures/4137692406/odds/history      HTTP 403
{ "type": "permission_error", "code": "insufficient_plan",
  "message": "Odds movement history requires the Ultra plan. See /pricing." }
```

**Verified:** tick history is **not** accessible on Free, and the gate is authoritative
(server-side, not marketing). Whether Ultra's tick payload contains **Pinnacle AH/OU/BTTS with
timestamps** is **DOCUMENTED but NOT VERIFIED** — hence gate G-5DFA-1.

---

## 6. Ultra economic gate — is $25/month justified?

### 6.1 Incremental capability (Free → Ultra)

| Dimension | Free | Ultra | Incremental value to SALMO |
|---|---|---|---|
| Leagues | 5 (Tier-1 only) | 1,600+ & cups | **Moderate** — SALMO whitelists 10; Ultra covers the missing 5 |
| Bookmakers in payload | **Bet365 only** | **20 incl. Pinnacle** | **Decisive** — unlocks the AGENTS.md-mandated CLV reference |
| Historical odds | 3 months | **back to 2014** | **Decisive** — the only affordable route to deep Pinnacle history |
| Tick history | `403` | **every price move, every market** | **High** — enables intraday line-movement / CLV research |
| Rate limit | 60/hour | 40/min (≈40×/hour) | **Moderate** — removes research crawl friction |
| China Sports Lottery | `403` | included | none (not a SALMO market) |

### 6.2 Expected economics

```text
Cost                       $25 / month  (or $250/yr; buy MONTHLY until gate passes)
New capability             Pinnacle AH/OU/BTTS closing + tick history, 2014→present,
                           across the full 10-league whitelist
Expected records           ~10 leagues × ~380 fixtures/season × ~9 seasons ≈ 34,000 fixtures,
                           × (opening + closing + N ticks) → 10⁶–10⁷ price rows
Expected API calls         paginated bulk pulls; comfortably inside 40 req/min
Expected storage           the dominant cost — must land in Parquet/DuckDB, NOT git
Research value             replaces an INVALID CLV reference (Football-Data ERA1 BetBrain)
                           with a genuine Pinnacle reference → directly serves the
                           "CLV over ROI" invariant in AGENTS.md
```

### 6.3 Verdict on the $25

**Justified — conditionally.** $25/mo is *less than the cost of the incorrect decisions it prevents*:
today the only pre-ERA2 "Pinnacle" AH/OU series SALMO holds is a **mislabelled BetBrain consensus**,
and OddsPapi's 250/month cannot poll production. Ultra is the cheapest documented route to a genuine,
deep Pinnacle series for all three core markets.

**But** the value rests entirely on a capability that has **not been observed**. Marketing pages are
not evidence. Hence the gate.

---

## 7. Gate G-5DFA-1 — mandatory before any purchase

| # | Requirement | Pass condition |
|---|---|---|
| 1 | **Written vendor confirmation** | Vendor states in writing that Ultra returns **Pinnacle** prices for **AH, OU and BTTS**, with **per-tick timestamps**, and that **commercial SaaS use is permitted** (attribution optional on paid plans). |
| 2 | **Single-month purchase** | Buy **monthly ($25)** — never the annual $250 — until the payload is verified. |
| 3 | **Payload verification** | Re-run `fiveDollarProbe.ts fixture-deep` on a real fixture and confirm `bookmakers[].slug === 'pinnacle'`, `asian_handicap`/`goal_line`/`btts` priced, and `/odds/history` returning timestamps. |
| 4 | **Sportsbook identity** | Confirm the `"Pinnacle"` in the payload is the actual sharp book (Asian lines / stake limits), not a relabelled aggregate — **precisely the failure mode found in football-data.co.uk ERA1.** |
| 5 | **Storage plan** | Tick-history ingest target (Parquet/DuckDB) sized and agreed before the first bulk pull. |
| 6 | **Governance** | `AGENTS.md` amended to permit the promoted role (see §9). |

**If any of 1–4 fails: do NOT upgrade.** Fall back to `KEEP FREE` (research-only) and keep OddsPapi as
the odds provider.

---

## 8. Licensing / attribution caveat

From the provider's own pricing page: commercial use is permitted and caching is permitted, **but** on
the $0 plans (Free / Community / Education) a public-facing product **must** display
*"Football data by 5DollarFootballAPI"* with a link. Attribution is **optional on paid plans**
(Pro, Ultra, Business) and for private/internal use. The one hard line: **do not resell or redistribute
the raw data as a competing feed.**

> **If SALMO ships any 5DFA-derived figure while still on Free, the attribution requirement applies.**

---

## 9. If approved — scope isolation rules

1. **Research namespace only.** Any 5DFA ingest lands in `src/research/` + `data/research/`, never in
   the gold layer, never in the production pipeline.
2. **No production wiring.** Do not add 5DFA to `providerGateway.ts` / `quotaManagerV4.ts` / the live
   pipeline services without an explicit, separate, reviewed change.
3. **Provenance labelling.** Every 5DFA row must carry `bookmaker='bet365'` while on Free (never
   inferred as Pinnacle) and a `source='5dollarfootballapi'` tag.
4. **`AGENTS.md` amendment first.** Provider promotion is a governance act, not a code act.
5. **Never print the key.** `FIVE_DOLLAR_API_KEY` is `.env.local`-only and must stay out of
   `.env.example` and logs.

---

## 10. Final answer

```text
KEEP FREE          ☐
UPGRADE TO ULTRA   ☑   ← conditional on gate G-5DFA-1 (no purchase authorised yet)
DISCARD 5DFA       ☐
```

**One-line rationale:** Free proves the provider's *market breadth* (BTTS + full OU ladder + quarter
lines) but is provably incapable of the one thing SALMO needs — a Pinnacle CLV reference — while Ultra
at **$25/mo** is the cheapest documented path to it, provided the Pinnacle tick payload is verified
before purchase.

**Reproduce this audit:** `npx tsx scripts/research/provider-final-audit/fiveDollarProbe.ts status|basic|fixture-deep|window-probe`
Evidence: `data/research/provider_audit/5dfa_*.json`
