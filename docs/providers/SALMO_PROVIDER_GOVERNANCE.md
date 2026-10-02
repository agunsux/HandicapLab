# SALMO — PROVIDER GOVERNANCE

**Sprint:** Provider Execution Gate · **Phase:** 2 · **Date:** 2026-10-02
**Status:** `AGENTS.md` amended (narrow, auditable). No production behaviour changed by this
document.

---

## 1. Core principle

> Optimise for **the smallest reliable provider stack that gives SALMO trustworthy
> AH / OU / BTTS decisions while staying inside quota, cost and governance constraints.**
>
> One production odds authority. One fixture/statistics authority. Historical providers stay
> historical. **No provider gets promoted simply because it has more endpoints.**

---

## 2. Role separation (one provider per domain)

| Domain | Authority | Role | Basis |
|---|---|---|---|
| **Fixtures / results / statistics** | **API-Football** | Production | `AGENTS.md` Single Source of Truth |
| **Production odds** | **OddsPapi** (v4) | Production — **sole** odds authority | `AGENTS.md`; Pinnacle ground truth for CLV |
| **Sharp benchmark bookmaker** | **Pinnacle** via OddsPapi | Production | `AGENTS.md` Bookmaker Hierarchy |
| **Secondary comparison bookmaker** | **SBOBET** via OddsPapi | Production (comparison only) | `AGENTS.md` |
| **Team/player feature enrichment** | **Dribble360** | Research/enrichment | existing, unchanged |
| **Historical results + a single closing price** | **Football-Data.co.uk** | Offline research corpus | existing, unchanged |
| **Historical odds / market movement research** | **5DollarFootballAPI (5DFA)** | **Research / historical ONLY** | amendment §3 — **new** |

Core SALMO markets remain exactly three: **Asian Handicap · Goals Over/Under · BTTS**.

---

## 3. The amendment

### 3.1 Why it was required

`AGENTS.md` previously stated, in a single line, both the Single Source of Truth rule and a
blanket prohibition:

> *"Wajib menggunakan `API-Football` untuk data fixture/statistik dan `OddsPAPI` untuk odds.
> **Dilarang menambah provider baru.**"*

The 5DFA upgrade gate (`SALMO_5DFA_GATE_G5DFA1.md`, gate #6) requires a permitted research role
**before** any purchase, because provider promotion is a **governance** act, not a code act. A
blanket prohibition and a research-only allowance cannot both stand unqualified.

### 3.2 Exact rule added to `AGENTS.md`

Under **Research Invariants & Data Governance**:

> **Provider Role Separation** *(amendment — SALMO provider execution gate, 2026-10-02)*:
> `OddsPAPI` tetap menjadi **satu-satunya production odds authority**. `5DollarFootballAPI`
> diizinkan **hanya** sebagai provider research/historical (offline, non-production) dan
> **tidak boleh** dipromosikan menjadi production odds authority tanpa persetujuan arsitektur
> eksplisit. Amendment ini **tidak** mengizinkan provider baru lainnya dan **tidak** melemahkan
> aturan Single Source of Truth di atas.

### 3.3 What the amendment deliberately does NOT do

| Not done | Why it matters |
|---|---|
| Does **not** weaken *"OddsPapi for production odds"* | The production odds authority is unchanged, and is now stated twice rather than once |
| Does **not** add generic language such as *"new providers allowed"* | No blanket exception; no future provider can read this as a licence |
| Does **not** create an unrestricted exception | It names **one** provider and grants **one** role |
| Does **not** grant production access | 5DFA is explicitly offline / non-production |
| Does **not** amend League Whitelist, No-Future-Leakage or CLV-over-ROI | Those invariants are untouched |

---

## 4. 5DFA scope-isolation rules (binding while on any tier)

1. **Research namespace only.** Any 5DFA ingest lands in `src/lib/research/` + `data/research/`.
   Never the gold layer. Never the production pipeline.
2. **No production wiring.** 5DFA must not be added to `providerGateway.ts`,
   `quotaManagerV4.ts`, `tournamentOddsBatch.ts`, the live pipeline services, or any cron route.
3. **Provenance labelling.** Every 5DFA row must carry `bookmaker='bet365'` while on Free —
   **never inferred as Pinnacle** — plus `source='5dollarfootballapi'`.
4. **Attribution.** On $0 tiers the vendor requires a visible
   *"Football data by 5DollarFootballAPI"* link in any public-facing product. Attribution is
   optional on paid tiers. Do not resell or redistribute the raw feed.
5. **Credential hygiene.** `FIVE_DOLLAR_API_KEY` is `.env.local`-only and must stay out of
   `.env.example` and out of logs.
6. **Promotion requires a new governance act.** Moving 5DFA into any production path requires a
   further explicit, reviewed `AGENTS.md` change — this amendment is not licence for that.

---

## 5. P0 reinforcement (OddsPapi authority made enforceable)

P0 did **not** change the authority table — it made the existing rule *enforceable*:

- The three live pipelines previously issued **billable, unaccounted** `fetch()` calls to
  OddsPapi, invisible to `QuotaManagerV4`. That was a governance gap, not merely a quota bug.
- All OddsPapi traffic now flows through `NativeOddsClient` → `reserveQuota` / `confirmQuota` /
  `rollbackQuota`. Every request is observable and reservable.
- No second quota system was introduced; no bypass remains.
- Consumption fell from **468%** of the contractual ceiling to **36%**.

See `SALMO_ODDSPAPI_QUOTA_OPTIMIZATION.md`.

---

## 6. Enforcement points

| Invariant | Enforced by |
|---|---|
| OddsPapi is the only production odds source | `src/lib/data/providers/odds/native/*`, `tournamentOddsBatch.ts`, `quotaManagerV4.API_COST_REGISTRY` |
| All billable calls are quota-accounted | `NativeOddsClient.get()` → `reserveQuota` |
| No unmetered raw provider fetches | `tests/security/provider-firewall.test.ts`; `tests/tournament-odds-batch.test.ts` asserts the per-fixture endpoint is never used |
| 5DFA stays non-production | §4; reviewable by grepping for `5DOLLAR`/`5dollar` outside `src/lib/research`, `scripts/research`, `data/research` |

---

## 7. Change record (auditable)

| Date | Change | Authorisation | Reversible? |
|---|---|---|---|
| 2026-10-02 | Added **Provider Role Separation** to `AGENTS.md` § Research Invariants & Data Governance | SALMO provider execution gate §Phase 2 | Yes — revert one line |
| 2026-10-02 | OddsPapi odds acquisition routed through the quota manager (P0) | SALMO provider execution gate §P0 | Yes — revert 4 files |

No purchase, no subscription change and no cancellation was performed by either change. The
governance amendment itself changed no production behaviour. Separately, **P0 was deployed to
production on 2026-10-02** — that is a deployment of the quota-routing change, not of this
amendment; see `SALMO_P0_DEPLOYMENT_RECORD.md`.

---

## 8. Acceptance

```
[x] OddsPapi = sole production odds authority         (unchanged, now enforced)
[x] API-Football = fixtures/statistics authority      (unchanged)
[x] 5DFA = research / historical only                 (amended in AGENTS.md)
[x] 5DFA NOT promoted to production                   (no production wiring added)
[x] No generic "new providers allowed" language       (amendment names one provider, one role)
[x] No purchase / cancellation / subscription change
[x] Amendment is one line and independently revertible
```

**Referenced by:** `SALMO_ODDSPAPI_QUOTA_OPTIMIZATION.md` · `SALMO_5DFA_GATE_G5DFA1.md` ·
`SALMO_PROVIDER_ARCHITECTURE_AUDIT.md` · `SALMO_PROVIDER_COVERAGE_MATRIX.md` ·
`SALMO_PROVIDER_COST_MODEL.md`

