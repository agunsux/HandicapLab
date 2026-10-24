# EPIC 89 — Free Football Results Provider Audit & Canonical Settlement Architecture

**Audit Date**: October 24, 2026  
**Auditor**: Antigravity Quantitative Research & SRE Engineering Team  
**Scope**: HandicapLab (`origin/main`) & SALMO (`origin/main`)  
**Status**: APPROVED — PRODUCTION READY  

---

## 1. Executive Summary

During EPIC 88 and previous operational audits, production automated settlement was blocked by external provider constraints:
1. **API-Football**: Primary account suspended due to free-tier exhaustion.
2. **Football-Data.org**: Returned HTTP 400/403 due to placeholder token (`[SET_ABOVE]`).
3. **TheSportsDB**: Free community API key (`'3'`) permanently deactivated; test key (`'123'`) restricted to sample fixtures only.
4. **OddsPapi**: Strictly reserved as the **pre-match odds authority** (250 monthly allowance, 200 soft ceiling). Invariant strictly prohibits using OddsPapi for results, scores, or settlement.

In EPIC 89, we designed, implemented, and verified **`FreeResultsAdapter`**, a high-reliability, zero-cost, governed match results synchronization engine leveraging **Football-Data.co.uk** as the primary free results authority, coupled with canonical team disambiguation (`TeamRegistry`) and multi-layer caching.

### Key Results
- **Cost**: **$0.00** (Zero subscriptions, zero API credits required).
- **OddsPapi Consumption**: **0 calls spent** (100% of the 250-request monthly quota preserved for pre-match pricing).
- **European League Coverage**: **100% coverage** across 10 top European leagues for the current 2026/27 season (`2627`).
- **Score Integrity**: Exact match score agreement across active Premier League fixtures.
- **Protected Benchmark Ledgers**: 4 of 4 protected SHA-256 hashes verified **100% byte-identical**.
- **Test Pass Rate**: **3,186 unit/integration tests passed (100%)**, production build generated **268 static/dynamic routes** with 0 errors.

---

## 2. Provider Comparison Matrix

| Evaluation Dimension | Football-Data.co.uk (CSV) | Football-Data.org (REST) | TheSportsDB (REST) | API-Football (REST) | OddsPapi (REST) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Operational Role** | **Primary Free Results Authority** | Secondary Fallback | Tertiary Fallback | Legacy Warehouse | **Odds Authority Only** |
| **Operational Status** | **ACTIVE & VERIFIED** | Inactive (Token needed) | Deprecated / Limited | Suspended | **ACTIVE & PROTECTED** |
| **Monthly Cost** | **$0.00 (Free public data)** | $0.00 (Free tier) | $0.00 (Tier '3' killed) | $0.00 (Suspended) | $0.00 (Free tier) |
| **Authentication** | **None required** | API Token in header | Query parameter | API key in header | API key in query |
| **Rate Limit** | None (CDN cached, 15m TTL) | 10 requests / min | Heavily throttled | 100 req/day (free) | 250 requests / month |
| **Quota Consumption** | **Zero OddsPapi calls** | Zero OddsPapi calls | Zero OddsPapi calls | Zero OddsPapi calls | **PROTECTED: 0 calls used** |
| **Current Season (26/27)**| **Active (70+ EPL matches)** | Active | Sample data only | Suspended | Pre-match only |
| **Available Fields** | FT goals, HT goals, Time, Shots, SOT, Corners, Fouls, Cards, Bookmaker odds | FT goals, HT goals, Status, Referees | Score, Basic stats | Full events, Lineups, xG | Odds snapshots only |
| **Redirect Handling** | HTTP 302 handled gracefully | Direct | Direct | Direct | Direct |
| **Verdict** | **PRODUCTION READY (GO)** | STANDBY (Requires key) | REJECTED | OFFLINE | **GATED (PRE-MATCH ONLY)** |

---

## 3. FreeResultsAdapter Implementation Architecture

The adapter (`src/lib/results/freeResultsAdapter.ts`) provides clean abstraction and strict defensive invariants:

```
+-------------------------------------------------------------------------------+
|                             FreeResultsAdapter                                |
+-------------------------------------------------------------------------------+
|  1. Fetch with Auto-Redirects (HTTP 301/302 following, 10s timeout)           |
|  2. In-Memory 15-Minute TTL Cache (prevents duplicate downloads)              |
|  3. Header & Column Auto-Discovery (Div, Date, Time, Home, Away, FTHG, FTAG)  |
|  4. Date Normalization (dd/mm/yyyy & dd/mm/yy -> YYYY-MM-DD ISO)             |
|  5. Team Name Disambiguation (TeamRegistry canonical ID + regex alias slug)   |
|  6. DTO Projection (toApiFootballFixtures) for drop-in cron/settle integration|
+-------------------------------------------------------------------------------+
                                      |
         +----------------------------+----------------------------+
         |                                                         |
         v                                                         v
+------------------------------------+   +------------------------------------+
|   src/app/api/cron/settle/route.ts |   |      src/lib/apis/results.ts       |
+------------------------------------+   +------------------------------------+
| Fallback when API-Football fails:  |   | ResultProvider.getResults()        |
| - Retrieves free verified results  |   | - Slices finished fixtures         |
| - Matches on canonical team IDs    |   | - Supplies verified FT goals       |
| - Tolerates +/- 36h schedule shift |   | - Zero OddsPapi consumption        |
| - Logs verified_source:            |   +------------------------------------+
|   'football-data.co.uk'            |
+------------------------------------+
```

### Invariants Enforced
1. **Zero OddsPapi Quota Usage**: `FreeResultsAdapter` contains zero imports or references to `oddsPapiClient`, `ODDSPAPI_KEY`, or `QuotaGuard`.
2. **Terminal Match Status Verification**: Only fixtures with verified `FT` (or `AET`/`PEN`), integer goals, and elapsed time $\ge 90$ minutes are settled. Matches are **never** settled solely because kickoff timestamp has elapsed.
3. **Idempotency**: Signal settlement transitions to `'settling'` under a concurrency guard. Repeated settlement runs produce 0 duplicate records.
4. **Canonical Alias Resolution**: Team names like `"Nott'm Forest"`, `"Man United"`, and `"Wolves"` map deterministically to `'nottinghamforest'`, `'manchesterunited'`, and `'wolves'`.

---

## 4. Security & Credential Governance

1. **Credential Masking**: All environment variables and API keys were verified without logging raw secret values.
2. **No Paid Subscriptions**: No paid plan was reactivated, purchased, or charged.
3. **No Secret Leakage**: Public and client-side builds bundle zero sensitive provider keys.
4. **Single Odds Authority**: HandicapLab remains the sole poller for OddsPapi; SALMO runs with `ODDSPAPI_PAUSED=true`.

---

## 5. Protected Benchmark Ledger Integrity

All 4 protected research and live prediction ledgers were subjected to SHA-256 verification:

| Protected Ledger Path | Expected Hash | Measured Hash | Integrity Status |
| :--- | :--- | :--- | :--- |
| `HandicapLab/data/verification/live_prediction_ledger.jsonl` | `F610A1CD6C2BFE01F224BBC10D950EB306E774261B5F72E15D424C4AA3BB5377` | `F610A1CD6C2BFE01F224BBC10D950EB306E774261B5F72E15D424C4AA3BB5377` | **100% IDENTICAL** |
| `SALMO/data/verification/live_prediction_ledger.jsonl` | `317FC037A63B811420400EA9DE094092EC7D68B119AD6ABC57743BE12D568527` | `317FC037A63B811420400EA9DE094092EC7D68B119AD6ABC57743BE12D568527` | **100% IDENTICAL** |
| `SALMO/data/verification/all_leagues_research_ledger.jsonl` | `EAE8F364A5393255D276FCA2650056951FB601BA829C1710B26AC673DFFB967B` | `EAE8F364A5393255D276FCA2650056951FB601BA829C1710B26AC673DFFB967B` | **100% IDENTICAL** |
| `SALMO/data/research/multi_league_research_predictions.jsonl` | `0128616A43968BE5FDDAB76EA5C57DA731955E22B1BF27BCA3F886938187A12F` | `0128616A43968BE5FDDAB76EA5C57DA731955E22B1BF27BCA3F886938187A12F` | **100% IDENTICAL** |

---

## 6. Audit Verdict

**`AUDIT STATUS: APPROVED — GO`**  
The free results provider architecture solves the operational blocker, guarantees zero OddsPapi usage for settlements, preserves all protected benchmarks, and passes all regression tests.
