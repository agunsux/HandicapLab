# SALMO — 5DFA GATE G-5DFA-1 (P1)

**Sprint:** Provider Execution Gate · **Phase:** P1 · **Date:** 2026-10-02
**Credential:** 5DollarFootballAPI **Free** (`plan: "free"`, `environment: "live"`)
**Companion to:** `SALMO_5DFA_UPGRADE_DECISION.md`, `SALMO_PROVIDER_GOVERNANCE.md`

> ### `CONDITIONAL GO — BUY ONLY AFTER TRIAL / VENDOR CONFIRMATION`
> Unconditional `BUY` is **not** supportable: **every** critical Ultra capability is
> `UNKNOWN`. No purchase has been made.

---

## 1. Evidence discipline

You have **Free**. You do **not** have Ultra. Therefore:

```
DOCUMENTED  ≠  VERIFIED
```

No Ultra capability is marked verified. Marketing copy is recorded as `DOCUMENTED` and
explicitly not promoted. Free revalidation was kept minimal (the previous session's evidence is
dated 2026-10-02 — the same day — and is reused rather than re-spent):

```
GET /v1/status      HTTP 200   plan "free"  environment "live"
                              rate_limit 60 / 3600s · burst 20/min
                              daily_limit null · daily_reset_at null
                              usage.today 11 · key created 2026-09-29 · expires_at null
GET /v1/leagues     HTTP 200   exactly 5
GET /v1/bookmakers  HTTP 200   21 slugs
```

Evidence: `data/research/provider_audit/5dfa_*.json`

---

## 2. G-5DFA-1 Free baseline (VERIFIED)

| Item | Value | Status |
|---|---|---|
| Plan | `free` | **VERIFIED** |
| Environment | `live` | **VERIFIED** |
| Rate limit | 60 req / 3600 s, burst 20/min | **VERIFIED** |
| Daily cap | `daily_limit: null` → **no daily ceiling**; the hourly window is the only throttle (~1,440/day theoretical) | **VERIFIED** |
| Key expiry | `expires_at: null` (created 2026-09-29) | **VERIFIED** |
| Leagues | EPL · Ligue 1 · Bundesliga I · Serie A · La Liga | **VERIFIED** |
| Leagues **missing** vs `AGENTS.md` whitelist | Championship · Eredivisie · J1 League · K League · Liga 1 Indonesia | **VERIFIED** |
| Bookmaker **catalogue** | 21 slugs incl. `pinnacle`, `crown`, `macauslot`, `hkjc`, `chinasportslottery` | **VERIFIED** |
| Bookmaker **payload** | `[bet365]` on **every fixture** of a 6-fixture sweep | **VERIFIED** |
| Historical depth | ~3 months (403 boundary probe) | **VERIFIED** |
| Markets | BTTS ✅ · OU 8-line ladder (0.5→7.5) ✅ · quarter-line AH ✅ | **VERIFIED** |
| `/fixtures?season=` | HTTP 200 (accepted) | **VERIFIED** |
| `/fixtures?from=&to=` · `/fixtures?date=` | HTTP 400 (rejected) | **VERIFIED** |
| Pinnacle **in payload** | **never observed** — `pinnacle` appears only inside `/bookmakers`, in **zero** response bodies | **VERIFIED ABSENT** |

### 2.1 The decisive structural finding

The vendor's own error semantics state that `403 insufficient_plan` covers *"a bookmaker other
than Bet365 below Ultra"*. Combined with the payload sweep, this is conclusive:

> **On Free, 5DFA can never supply a Pinnacle reference.** Free is therefore structurally
> incapable of producing the one artefact `AGENTS.md` names as ground truth for
> **Closing Line Value**.

`catalogue ≠ payload` is not a documentation nuance — it is the whole reason a Free-only
evaluation cannot answer the Ultra question.

---

## 3. G-5DFA-1 Ultra capability matrix

`VERIFIED` = observed in a live response on the credential actually held.
`DOCUMENTED` = vendor statement only. `UNKNOWN` = neither.

| Capability | Free | Ultra Documented | **Ultra Verified** | Decision impact |
|---|---|---|---|---|
| Historical depth | ~3 months | "materially deeper" | **UNKNOWN** | BLOCKING |
| AH | ✅ verified | yes | **UNKNOWN** | BLOCKING |
| AH quarter lines | ✅ verified | yes | **UNKNOWN** | non-blocking |
| OU | ✅ 8-line ladder | yes | **UNKNOWN** | BLOCKING |
| OU quarter lines | ✅ verified | yes | **UNKNOWN** | non-blocking |
| BTTS | ✅ verified | yes | **UNKNOWN** | BLOCKING |
| **Pinnacle** | ❌ **absent from payload** | yes | **UNKNOWN** | **BLOCKING — critical** |
| Bet365 | ✅ only | yes | **UNKNOWN** | non-blocking |
| Multi-bookmaker per request | ❌ (1 only) | yes | **UNKNOWN** | non-blocking |
| Opening odds | not observed | yes | **UNKNOWN** | non-blocking |
| Closing odds | not observed | yes | **UNKNOWN** | non-blocking |
| **Tick history / timestamped movement** | `/odds/history` not observed on Free | yes | **UNKNOWN** | **BLOCKING — critical** |

**No row is `VERIFIED` in the Ultra column.** That is the honest state of knowledge, and it is
what forces a conditional verdict.

### 3.1 Critical capabilities required for a BUY

| # | Requirement | Status |
|---|---|---|
| 1 | Historical depth materially beyond Free | UNKNOWN — gate NOT cleared |
| 2 | **Pinnacle actual odds payload** | UNKNOWN — gate NOT cleared |
| 3 | AH historical odds | UNKNOWN — gate NOT cleared |
| 4 | OU historical odds | UNKNOWN — gate NOT cleared |
| 5 | BTTS historical odds | UNKNOWN — gate NOT cleared |
| 6 | Multi-bookmaker access | UNKNOWN — gate NOT cleared |
| 7 | **Timestamped odds history / tick history** | UNKNOWN — gate NOT cleared |

Because (2) and (7) — which carry essentially all of the value — cannot be verified before
purchase:

```
CONDITIONAL BUY
REQUIRES ULTRA TRIAL / WRITTEN VENDOR CONFIRMATION
```

not unconditional `BUY`.

---

## 4. Purchase gate

| # | Gate | Pass condition | Status |
|---|---|---|---|
| 1 | **Written vendor confirmation** | Vendor states in writing that Ultra returns **Pinnacle** prices for **AH, OU and BTTS**, with **per-tick timestamps**, and that commercial SaaS use is permitted. | ⬜ OPEN |
| 2 | **Trial / single-month purchase** | If no trial exists, buy the **monthly $25** — never the annual $250 — and verify before any renewal. | ⬜ OPEN |
| 3 | **Payload verification** | Re-run `fiveDollarProbe.ts fixture-deep` and confirm `bookmakers[].slug === 'pinnacle'`, `asian_handicap`/`goal_line`/`btts` priced, `/odds/history` returning timestamps. | ⬜ OPEN |
| 4 | **Sportsbook identity** | Confirm the `"Pinnacle"` in the payload is the true sharp book (Asian lines, stake limits), not a relabelled aggregate — exactly the failure mode already found in football-data.co.uk ERA1, where a **BetBrain consensus** had been mislabelled as Pinnacle. | ⬜ OPEN |
| 5 | **Storage plan** | Tick-history ingest target sized before the first bulk pull. | ⬜ OPEN |
| 6 | **Governance** | `AGENTS.md` amended to permit the research/historical role. | ⬜ OPEN — see `SALMO_PROVIDER_GOVERNANCE.md` |

**If any of 1–4 fails → `NO-GO`: keep Free (research-only), keep OddsPapi as the odds
authority.**

---

## 5. Economic gate

Stated price, read directly from the vendor's pricing page (previous session):

| Tier | Monthly | Annual |
|---|---|---|
| Free | $0 | — |
| Pro | $5 | $50 |
| **Ultra** | **$25** | $250 |

`$25/month` is assumed **monthly** — the annual tier is deliberately rejected until the payload
is verified (§4.2). The committed bakeoff in `data/verification/PROVIDER_BAKEOFF_AUDIT_REPORT.json`
claims "*$49/mo Ultra*"; that figure is **wrong**.

| Dimension | Assessment |
|---|---|
| Incremental cost | $25/mo = $300/yr |
| Expected leagues | 5 on Free; **Ultra league breadth UNKNOWN** |
| Expected bookmakers | 1 (Bet365) → **Ultra UNKNOWN**; Pinnacle is the whole point |
| Expected markets | AH + OU + BTTS are already covered on Free — the gap is **depth and bookmaker**, not breadth |
| Expected records | Tick history would be genuinely new (SALMO holds none) |
| Research value | **Potentially high, conditional on Pinnacle + tick history** |

### 5.1 The decision question

> *Does Ultra provide unique historical market evidence that SALMO cannot obtain economically
> elsewhere?*

| Alternative | Verdict |
|---|---|
| **Football-Data.co.uk** | Free, but final-results plus a single closing price; its "Pinnacle" ERA1 series was found to be a **mislabelled BetBrain consensus**. Not a CLV reference. |
| **Dribble360 offline corpus** | Deep Opta match features (70,651 team-match records, 303 fields) — **no odds at all**. Complementary, not a substitute. |
| **OddsPapi `/v4/historical-odds`** | **Unmetered**, genuine Pinnacle, but history starts **2026-01** — a hard floor that no 5DFA tier can lower. |

The honest framing is therefore narrow: Ultra is the cheapest *documented* route to a deep
Pinnacle tick series for AH/OU/BTTS. But "documented" is doing all the work in that sentence,
and a recurring $25/mo must not be justified by a marketing page.

---

## 6. Result

```
GO — BUY ULTRA                                                ☐
CONDITIONAL GO — BUY ONLY AFTER TRIAL / VENDOR CONFIRMATION   ☑
NO-GO — DO NOT BUY ULTRA                                      ☐
```

```text
Free historical depth : ~3 months (VERIFIED)
Free markets          : AH ✅ (incl. quarter lines) · OU ✅ (8-line ladder) · BTTS ✅
Free bookmakers       : bet365 ONLY in payload; pinnacle catalogue-only (VERIFIED ABSENT)
Ultra documented      : deeper history · Pinnacle · multi-bookmaker · tick history
Ultra verified        : NONE (Ultra is not subscribed)
Pinnacle verified     : NO — cannot be, on Free
Tick history verified : NO — cannot be, on Free
Incremental value     : UNPROVEN; would rest entirely on the Pinnacle + tick payload
Monthly cost          : $25 (monthly tier; annual $250 rejected pre-verification)
```

**One-line rationale:** Free proves the provider's market *breadth* but is provably incapable of
the one thing SALMO needs — a Pinnacle CLV reference — and the gate that would justify paying
$25/mo cannot be cleared from a Free credential, so the only defensible verdict is conditional.

**Reproduce:**
`npx tsx scripts/research/provider-final-audit/fiveDollarProbe.ts status|basic|fixture-deep|window-probe`

**P1 status:** `COMPLETE — gate open, NO purchase, NO subscription change.`


