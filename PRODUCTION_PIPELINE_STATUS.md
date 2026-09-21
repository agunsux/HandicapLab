# Production Pipeline Status Report

**Last Verified**: September 22, 2026  
**Auditor**: HandicapLab Quantitative Architecture & Governance  

---

## 1. Platform & Pipeline Certification Status

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  LEVEL 2 — VERIFIED LIVE PRODUCTION PIPELINE                                │
│  Status: VERIFIED (Real Provider Data & Provenance Chain Operational)       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  LEVEL 3 — PENDING NATURAL MATCH COMPLETION                                 │
│  Status: PENDING (Fixtures Kickoff: October 10, 2026 — Zero Pre-Match Claims)│
└─────────────────────────────────────────────────────────────────────────────┘
```

### Critical Semantic Boundary (Non-Negotiable)
- **`LEVEL 2 — VERIFIED LIVE PRODUCTION PIPELINE`** means strictly:
  1. The live production pipeline is operational.
  2. Live external provider data (`API-Football` fixtures, `OddsPapi` Pinnacle & Bet365 odds) is flowing with zero mock/synthetic fallback.
  3. Provenance and deterministic SHA-256 hashes link fixture $\rightarrow$ odds snapshot $\rightarrow$ model execution $\rightarrow$ permanent archive.
  4. **It DOES NOT mean**:
     - Prediction accuracy is proven.
     - Closing Line Value (CLV) is realized.
     - Return on Investment (ROI) is realized.
     - Model performance is validated over natural sample completion.

- **`LEVEL 3 — PENDING NATURAL MATCH COMPLETION`** means strictly:
  1. Natural match outcomes are chronologically pending (kickoffs scheduled for October 10, 2026).
  2. Realized CLV and Realized ROI remain strictly **`PENDING`** until matches conclude and final closing lines are locked at kickoff.
  3. Pre-match predictions strictly expose forward-looking mathematical expectations: **Expected Value (EV)**, **Expected ROI**, **Model Probability**, and **Fair Odds**.

---

## 2. The Three-Price Model (Architectural Invariant)

To eliminate price conflation across UI, API, and internal database layers, prices are segregated into three non-interchangeable pillars:

```
───────────────────────────────────────────────────────────────────────────────
1. REFERENCE PRICE
   • Benchmark Bookmaker: Pinnacle (Sharp ground truth)
   • Source: OddsPapi v4 (`odds-by-tournaments`)
   • Role: Ground truth benchmark for devigged market probability and CLV
───────────────────────────────────────────────────────────────────────────────
2. MODEL PRICE
   • Model Architecture: SALMO Dixon-Coles Bivariate Poisson
   • Source: Quantitative Model Probability Engine (`params-epl-2026-v1`)
   • Outputs: Model Fair Probability, Fair Odds, Model Edge vs Pinnacle
───────────────────────────────────────────────────────────────────────────────
3. EXECUTION PRICE
   • Benchmark Bookmaker: Retail Bookmaker (Bet365 / Soft Book)
   • Source: Coalesced OddsPapi multi-bookmaker query
   • Role: Evaluation of executable retail edge vs SALMO model price
───────────────────────────────────────────────────────────────────────────────
```

### Gate 2 & Gate 3 Enforcement:
1. **Model Price $\neq$ Reference Price $\neq$ Execution Price**: Neither can be assigned or substituted into another.
2. **Suggested Bet Qualification $\neq$ Positive CLV**:
   - A pick may qualify as a **Suggested Bet** if the retail execution price on Bet365 yields positive edge versus SALMO model fair odds.
   - This **DOES NOT** imply positive Closing Line Value. CLV is an entirely distinct metric calculated post-close exclusively against the Pinnacle closing line.

---

## 3. Immutable Three-Snapshot Evidence Model

Every prediction archived in the permanent ledger must retain three immutable snapshot slots:

| Snapshot Slot | Bookmaker | Lifecycle Timing | State Pre-Kickoff |
| :--- | :--- | :--- | :--- |
| **`referenceSnapshot`** | Pinnacle | Pre-Match (Entry) | **VERIFIED & IMMUTABLE** |
| **`executionSnapshot`** | Bet365 / Retail | Pre-Match (Entry) | **VERIFIED & IMMUTABLE** |
| **`closingSnapshot`** | Pinnacle | Kickoff / Settlement | **PENDING** (Awaiting Oct 10, 2026 Kickoff) |

---

## 4. Explicit Market Schema

No ambiguous free-form market strings (such as `"AH Home -0.5"` or `"1X2"`) are accepted. The schema is typed and validated:

```typescript
type CanonicalMarket = 'AH' | 'OU' | 'ML' | 'BTTS';

interface MarketSelection {
  market: CanonicalMarket;
  line: number | null; // e.g. -0.25 for AH, 2.5 for OU, null for ML/BTTS
  selection: string;   // e.g. 'Ipswich -0.25' or 'Ipswich Win'
  bookmaker: string;
  odds: number;
  timestamp: string;
}
```

---

## 5. Lifecycle & Evidence State Orthogonality (Gate 4)

Prediction lifecycle state and evidence verification status are tracked as orthogonal dimensions:

- **Prediction Lifecycle**:
  `DRAFT` $\rightarrow$ `PUBLISHED` $\rightarrow$ `LIVE` $\rightarrow$ `COMPLETED` | `CANCELLED` | `VOID`
- **Evidence Status**:
  `DATA_VERIFIED` $\rightarrow$ `MODEL_VERIFIED` $\rightarrow$ `CLV_PENDING` $\rightarrow$ `CLV_VERIFIED` $\rightarrow$ `RESULT_VERIFIED`

---

## 6. Real-Time Quota Protection & Coalescing

- **Multi-Bookmaker Coalescing**:
  Odds for both Pinnacle (reference price) and Bet365 (execution price) are requested in a single call via `bookmakers=pinnacle,bet365`.
  - **OddsPapi Monthly Limit**: 250 calls.
  - **Calls per sync**: 1 call (coalesced).
  - **Cost per viewer/refresh**: 0 calls (strictly serves from canonical cached archive).
- **Fail-Closed Guard**: Any detection of mock/synthetic data immediately prevents the record from achieving `VERIFIED` status (`Gate 1 Fail-Closed`).

---

## 7. Current Active Fixtures (Audit Ledger v3)

All active predictions are anchored to verified Premier League fixtures scheduled for October 10, 2026:

1. **Arsenal vs Leeds**
   - **Market**: `AH` | **Line**: `-0.25` | **Selection**: `Arsenal -0.25`
   - **Reference Price (Pinnacle)**: `1.232` (Devig: `77.4%`)
   - **Model Price (SALMO)**: `2.31` (Fair Prob: `43.4%`)
   - **Status**: `LEVEL 2 VERIFIED` | `CLV: PENDING` | `Settlement: PENDING`
2. **Chelsea vs Bournemouth**
   - **Market**: `AH` | **Line**: `-0.25` | **Selection**: `Chelsea -0.25`
   - **Reference Price (Pinnacle)**: `1.595` (Devig: `60.0%`)
   - **Model Price (SALMO)**: `2.31` (Fair Prob: `43.4%`)
   - **Status**: `LEVEL 2 VERIFIED` | `CLV: PENDING` | `Settlement: PENDING`
3. **Ipswich vs Fulham**
   - **Market**: `AH` | **Line**: `-0.25` | **Selection**: `Ipswich -0.25`
   - **Reference Price (Pinnacle)**: `2.32` (Devig: `41.3%`)
   - **Model Price (SALMO)**: `2.31` (Fair Prob: `43.4%`)
   - **Status**: `LEVEL 2 VERIFIED` | `CLV: PENDING` | `Settlement: PENDING`
