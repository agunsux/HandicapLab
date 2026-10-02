# SALMO — 5DFA Ultra Vendor Evidence Request (B2)

**Sprint:** Provider Execution Gate · **Phase:** P1 · **Date:** 2026-10-02
**Gate:** G-5DFA-1 · **Verdict:** `CONDITIONAL GO` — no purchase made
**Companion to:** `SALMO_5DFA_GATE_G5DFA1.md`

---

## 0. Transmission status

```
PREPARED — NOT SENT
```

No outbound channel is available to this agent (no email account, no vendor ticket access,
no live chat). This document is the **exact** text to send verbatim by a human operator.
Nothing in it has been transmitted, and no reply has been received.

---

## 1. The objective (not a yes/no about the word "Pinnacle")

The question is **not**:

> "Is Pinnacle available on Ultra?"

The question **is**:

> Can SALMO retrieve **historical, timestamped Pinnacle** AH / OU / BTTS odds **and market
> movement** through the Ultra **API**, under the **$25/month** plan, for **commercial SaaS** use?

Anything that does not answer that is not evidence.

---

## 2. Why marketing copy is insufficient

The following are **not** accepted as proof, and are recorded as `DOCUMENTED` only:

```
"Pinnacle supported"          "Historical odds available"
"Multiple bookmakers"         "Live odds"
"Tick data"                   "Deep history"
```

We accept **one** of:

```
1. an actual API response we can inspect
2. official endpoint documentation
3. a trial credential
4. written vendor confirmation
```

Preference order is exactly as listed. An actual response outranks every other form.

---

## 3. The 20 questions

### Historical depth & retrieval

| # | Question |
|---|---|
| 1 | What is the **earliest** date for which historical odds can be retrieved via the API? Give a concrete date, not "deep history". |
| 2 | How are **historical fixtures** enumerated — which endpoint, and can we page a full past season? |
| 15 | What is the **historical retention** window, and does data get deleted or truncated over time? |
| 16 | Does historical data require an **additional purchase** beyond the $25/mo subscription, or a metered credit top-up? |

### Pinnacle payload — the critical axis

| # | Question |
|---|---|
| 3 | Does Ultra return **Pinnacle actual odds values** in the response body (not merely in a catalogue/bookmaker list)? |
| 4 | Pinnacle **Asian Handicap** — available historically? Including quarter lines (e.g. -0.25/-0.75)? |
| 5 | Pinnacle **Over/Under** — available historically? How many lines deep? |
| 6 | Pinnacle **BTTS** — available historically? |
| 12 | Which **exact endpoint names** return each of the above? |
| 13 | Which **required parameters** must we supply for a historical query? |

### Timestamps, opening/closing, movement

| # | Question |
|---|---|
| 7 | Are **opening odds** retrievable, and how is "opening" defined (first snapshot, or first market creation)? |
| 8 | Are **closing odds** retrievable, and how is "closing" defined (last pre-kickoff snapshot, or a computed field)? |
| 9 | Are values **timestamped snapshots**? What is the snapshot **granularity** for historical fixtures? |
| 10 | Is there a **tick / history / movement** endpoint returning the full price path, and what is its update interval? |

### Access, limits, commercial

| # | Question |
|---|---|
| 11 | **Multi-bookmaker**: can Pinnacle and others be requested in one call, or one bookmaker per request? |
| 14 | What are the **rate limits** on Ultra (requests/hour, burst, daily cap)? |
| 17 | Is **Pinnacle included in the $25/month Ultra plan** specifically — not Pro, not a higher unpublished tier? |
| 18 | Does **API access differ from dashboard access**? (We only need API.) |
| 19 | What **commercial / data-use restrictions** apply — may derived outputs be shown to paying subscribers in a SaaS product? May data be stored long-term? |
| 20 | Is a **trial** or temporary Ultra access available before purchase? |

---

## 4. The minimum acceptable trial

If a trial is offered, it must be able to demonstrate **all** of:

```
one historical match
Pinnacle
AH, OU, BTTS
opening AND closing
at least two distinct timestamps
```

Ideal (and decisive):

```
multiple historical timestamps -> a visible market movement path
```

We will not purchase in order to discover whether an advertised endpoint works.

---

## 5. Why this is not over-cautious — the baseline we already hold

Free is verified, and it is **structurally** incapable of the one thing SALMO needs:

```
Free bookmaker catalogue : 21 slugs including pinnacle      -> catalogue only
Free bookmaker payload   : bet365 on EVERY fixture swept    -> pinnacle NEVER in a body
vendor 403 semantics     : "a bookmaker other than Bet365 below Ultra"
```

`catalogue != payload`. 5DFA's own `403 insufficient_plan` semantics confirm that a Pinnacle
reference is unreachable below Ultra. Since `AGENTS.md` names a true Pinnacle as ground truth
for **Closing Line Value**, Free cannot supply SALMO's core evaluation metric at all.

---

## 6. One further test we will apply regardless of the vendor's answer

A `"Pinnacle"` label is not automatically the true sharp book. This failure has **already
occurred once** in this codebase: the `football-data.co.uk` ERA1 "Pinnacle" series was audited
and found to be a **mislabelled BetBrain consensus**.

Therefore a positive response must also survive:

```
sportsbook identity check
 -> genuine Asian-line structure and stake-limit behaviour,
    not an aggregated consensus relabelled "Pinnacle"
```

---

## 7. Decision rule on reply

```
GO            vendor proves Pinnacle payload + historical + AH + OU + BTTS
              + timestamps, accessible via API on the $25/mo plan
CONDITIONAL   written confirmation only, no trial/API evidence
              -> buy ONLY after trial or written commercial/API confirmation
NO-GO         catalogue-only, or no historical access, or no tick history,
              or AH/OU/BTTS historical missing, or requires another paid tier,
              or commercial use prohibited
```

**On `NO-GO`:** keep Free (research-only) and keep `OddsPapi` as the production odds authority.

---

## 8. Economic test applied before any purchase

$25/mo = $300/yr recurring. It must be justified **only** by unique historical market evidence
that materially improves SALMO research/validation and is unavailable economically elsewhere.

It will **not** be justified by "more endpoints".

Known alternatives already assessed:

| Alternative | Verdict |
|---|---|
| Football-Data.co.uk | "Pinnacle" ERA1 series proven to be a mislabelled BetBrain consensus — not a CLV reference |
| Dribble360 offline corpus | Deep Opta features, but **no odds at all** — complementary, not a substitute |
| OddsPapi `/v4/historical-odds` | Genuine Pinnacle and **unmetered**, but history starts 2026-01 — a floor no 5DFA tier can lower |

---

## 9. Provider architecture (unchanged by any outcome)

```
OddsPapi        = production odds authority
API-Football    = fixture / result / statistics authority
5DFA            = research / historical only  (never production)
Dribble360      = offline historical feature corpus
Football-Data   = offline validation / research
```

**Current P1 status:** `CONDITIONAL GO — gate OPEN, no purchase, no subscription change.`

