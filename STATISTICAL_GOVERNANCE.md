# Statistical Governance — HandicapLab

> **Status:** Adopted — Epic 31A  
> **Owner:** Core Engineering  
> **Last Updated:** 2026-07-15  
>
> This document is the **single source of truth** for every metric, probability, and
> statistical computation used across HandicapLab. All implementations and dashboard
> displays MUST conform to the definitions herein. Deviations are bugs.

---

## Table of Contents

1. [Core Definitions](#1-core-definitions)
2. [De-Vig Methodology](#2-de-vig-methodology)
3. [Metric Display Thresholds](#3-metric-display-thresholds)
4. [Dashboard Quality Gate](#4-dashboard-quality-gate)
5. [Data Provenance Requirements](#5-data-provenance-requirements)
6. [Feature Flag Gating](#6-feature-flag-gating)
7. [Adherence & Auditing](#7-adherence--auditing)

---

## 1. Core Definitions

### 1.1 ROI (Return on Investment)

```
ROI = (Total Profit/Loss) / (Total Stake) × 100
```

- **Formula:** `(sum(profitUnits) / sum(stakeUnits)) × 100`
- **Unit:** Percentage (%)  
- **Stake basis:** 1 unit per bet (standardised)  
- **Scope:** Non-voided bets only  
- **Minimum sample:** See [Metric Display Thresholds](#3-metric-display-thresholds)  
- **Interpretation:** `+12.5%` means 12.5% return on total staked capital  
- **Provenance:** `ROI → Trades → Predictions → Odds Snapshots → Providers`

### 1.2 Yield

```
Yield = ROI
```

For unit-stake betting (every bet = 1 unit), Yield and ROI are numerically
identical. If variable staking (e.g., Kelly) is introduced, Yield becomes:

```
Yield = (Total Profit/Loss) / (Total Stake) × 100
```

Same formula, different interpretation — Yield measures efficiency of capital
utilisation.

### 1.3 CLV (Closing Line Value)

```
CLV = mean( impliedProb(closingOdds) - impliedProb(takenOdds) ) × 100
```

- **Formula:** `mean( 1/closingOdds - 1/takenOdds ) × 100`  
- **Unit:** Percentage points (%)  
- **Requires:** closingOdds > 1 AND takenOdds > 1; null otherwise  
- **Interpretation:**  
  - `CLV > 0` → model beat the closing line (bet into steam)  
  - `CLV < 0` → model was shaded by the market (bet against steam)  
- **CLV is NOT a predictor of future profitability** — see [Metric Display Thresholds](#3-metric-display-thresholds)  
- **Provenance:** `CLV → Trades → Odds Snapshots → Provider Closing Prices`

### 1.4 Brier Score

```
Brier = (1/N) × sum( (p_i - o_i)² )
```

- **Formula:** Mean squared error between predicted probability and binary outcome  
- **Range:** `[0, 1]` where 0 = perfect, 1 = worst  
- **Reference:** Brier = 0.25 for naive climatology (always predict 50%)  
- **Market-specific:**  
  - Moneyline: computed as multi-class Brier across (home, draw, away)  
  - Asian Handicap: binary Brier (home cover vs away cover)  
  - Over/Under: binary Brier (over vs under)  

### 1.5 Log Loss

```
LogLoss = -(1/N) × sum( y_i × log(p_i) + (1-y_i) × log(1-p_i) )
```

- **Range:** `[0, ∞)` where 0 = perfect  
- **Penalises** confident wrong predictions more than Brier  
- **Used for:** Model comparison and calibration assessment  

### 1.6 Expected Calibration Error (ECE)

```
ECE = sum( |acc_k - conf_k| × (n_k / N) )
```

- **Formula:** Weighted average of absolute accuracy-confidence difference across
  K equal-width bins  
- **Default:** 10 bins  
- **Range:** `[0, 1]` where 0 = perfectly calibrated  
- **Interpretation:** ECE = 0.05 means average 5pp miscalibration  

### 1.7 Edge

```
Edge = fairProbability × takenOdds - 1
```

- **Formula:** `expectedValue(takenOdds, fairProbability)`  
- **Unit:** Decimal fraction (0.05 = +5% edge)  
- **Requires:** De-vigged fair probability (see [De-Vig Methodology](#2-de-vig-methodology))  
- **Interpretation:**  
  - `Edge > 0` → positive expected value  
  - `Edge < 0` → negative expected value (should not bet)  
- **Provenance:** `Edge → DeVigEngine → Odds Snapshots → Provider Prices`

### 1.8 Closing Odds

```
ClosingOdds = most recent odds observation at/before match kickoff
```

- **Data source:** Append-only `odds_snapshots` table, filtered by
  `captured_at <= match_kickoff`  
- **Fallback:** If no data ≤ kickoff, closing = latest available (flagged in
  confidence note)  
- **Accuracy:** Must be timestamped with provider latency; stale data (>30s old)
  flagged as `stale`  

### 1.9 Strike Rate

```
StrikeRate = (WinningBets / TotalNonVoidBets) × 100
```

- **Unit:** Percentage (%)  
- **Winning definition:** `profitUnits > 0` (excludes PUSH and VOID)  

### 1.10 Max Drawdown

```
MaxDrawdown = max( PeakCumulativePL - TroughCumulativePL )
```

- **Unit:** Units (1-unit stake basis)  
- **Computed on:** Chronologically ordered, non-voided bets  

---

## 2. De-Vig Methodology

### 2.1 Canonical Method: Proportional (Multiplicative)

| Property | Value |
|----------|-------|
| **Method** | Proportional margin removal |
| **Rationale** | Deterministic, O(n), no iterative solver, trivially reproducible. Matches the majority of existing code paths. |
| **Formula** | `fair(p_i) = implied(p_i) / sum(implied)` |
| **Applies to** | All market types (moneyline, asian handicap, over/under) |
| **Fallback** | Shin's method available as opt-in for liquid markets |

### 2.2 De-Vig Pipeline

```
Raw Odds (provider)
    ↓
Implied Probability = 1 / decimalOdds
    ↓
sumImplied = sum(all implied probabilities)
    ↓
overround = sumImplied - 1
    ↓
margin = overround / sumImplied
    ↓
fairProbability = implied / sumImplied
    ↓
Fair Probability for EV/Edge/CLV calculations
```

### 2.3 Mandate

**ALL** computations of:
- Expected Value (EV)
- Edge
- CLV (when comparing taken vs closing implied probabilities)

**MUST** route through the canonical de-vig layer (`src/lib/settlement-core/devig.ts`).

Any code path that computes EV, Edge, or CLV without de-vigging first is a bug.
See [Adherence & Auditing](#7-adherence--auditing) for flagging procedures.

---

## 3. Metric Display Thresholds

| Metric | Min Sample | Display Rule | Confidence Note |
|--------|-----------|--------------|-----------------|
| ROI | 30 | Show with warning | "sample size below 30, illustrative only" |
| ROI | 100 | Show normally | "sample size below 100, directional only" |
| ROI | 100+ | Show with confidence | "sufficient sample" |
| CLV | 50 | Show with warning | "CLV based on limited closing odds data" |
| CLV | 200+ | Show normally | No note needed |
| Brier | 30 | Show with warning | "calibration estimate, small sample" |
| Brier | 100+ | Show normally | No note needed |
| Strike Rate | 30 | Show with warning | "strike rate volatile at this sample size" |
| Strike Rate | 100+ | Show normally | No note needed |

### 3.1 Confidence Levels

| sample_size | confidence_level | validation_status | warning |
|-------------|-----------------|-------------------|---------|
| < 30 | Low | Experimental | Not statistically significant |
| 30–99 | Moderate | Directional | Sample below 100, directional only |
| 100–999 | High | Established | — |
| 1000+ | Very High | Mature | — |

---

## 4. Dashboard Quality Gate

### 4.1 Zero-Data Display Rules

When production evidence is unavailable (no settled bets, no data):

| ❌ NEVER Display | ✅ ALWAYS Display |
|-----------------|-------------------|
| `0` (as a metric value) | `"No verified data available"` |
| `0%` (as accuracy/ROI) | `"Insufficient data to calculate"` |
| `N/A` | `"Awaiting settlement data"` |
| Placeholder percentage | Descriptive empty state |
| Estimated ROI | Feature-flag-gated placeholder |

### 4.2 Implementation

```tsx
// ✅ Correct
{data ? <Metric value={data.roi} /> : <EmptyState message="No verified data available" />}

// ❌ Incorrect
<Metric value={data?.roi ?? 0} />
```

### 4.3 Feature Flag Gating

Every premium metric display MUST check its corresponding feature flag:

```tsx
// ✅ Correct
const flags = new FeatureFlagRegistry(DEFAULT_PRODUCTION_FLAGS);
if (!flags.isAccessible('clv_calculation', { userId, userTier })) {
  return <UpgradePrompt feature="CLV Analysis" />;
}

// ❌ Incorrect — showing CLV without gate
<CLVChart data={clvData} />
```

---

## 5. Data Provenance Requirements

### 5.1 Audit Trail

Every metric displayed in the UI must have a resolvable provenance trail:

```
Current View (e.g., Dashboard)
    ↓
Metric (e.g., ROI: +12.5%)
    ↓
Ledger Entry (computed_at, filter_label)
    ↓
Trades (prediction_id, settled_at, profit_units)
    ↓
Predictions (model_version, odds_at_time)
    ↓
Odds Snapshots (provider, captured_at, price)
    ↓
Provider (name, api_endpoint)
```

### 5.2 Implementation

- Provenance records are stored in the `data_provenance` table
- Each record includes a SHA-256 hash of its source data for integrity verification
- The audit panel (Epic 31C) will render the full provenance chain

---

## 6. Feature Flag Gating

### 6.1 Flag Inventory

| Flag | Default | Min Tier | Description |
|------|---------|----------|-------------|
| `de_vig_engine` | ON | free | De-vig margin removal |
| `clv_calculation` | OFF | pro | CLV metrics & chart |
| `performance_ledger` | OFF | starter | ROI, yield, drawdown |
| `odds_ingestion_live` | OFF | free | Live odds ingestion |
| `odds_ingestion_historical` | OFF | free | Historical odds import |
| `settlement_automation` | OFF | free | Auto-settlement cron |
| `model_calibration_ui` | OFF | pro | Calibration curves |
| `premium_predictions` | OFF | pro | Premium insights |
| `market_scanner` | OFF | quant | Real-time edge scanner |
| `audit_panel` | OFF | free | Admin audit UI |
| `paper_trading_v2` | OFF | pro | Paper trading v2 |
| `edge_analysis` | OFF | starter | Edge analysis tools |

### 6.2 Flag Policy

1. Every new feature MUST have a corresponding flag registered in
   `DEFAULT_PRODUCTION_FLAGS` before deployment.
2. Flags default to DISABLED (`false`) in production.
3. Tier-gated flags MUST block access for users below the minimum tier.
4. Rollout percentage flags support gradual enablement via deterministic hash.

---

## 7. Adherence & Auditing

### 7.1 Compliance Check

Before each release, run:

```
npx tsx src/scripts/audit-statistical-governance.ts
```

This script checks:
1. All metrics in the codebase conform to definitions in this document.
2. No EV/Edge/CLV computation bypasses the de-vig layer.
3. All dashboard components check feature flags before displaying premium metrics.
4. Zero-data states use `"No verified data available"` not `0`.

### 7.2 Violation Procedure

1. Any deviation from this document is filed as a **P1 bug**.
2. The offending code is either fixed or reverted before the next release.
3. The audit script output is attached to the release checklist.

### 7.3 Change Process

Changes to this document require:
1. An Architecture Decision Record (ADR) explaining the change.
2. Review by at least one other engineer.
3. Updated implementation across all code paths.
4. Updated audit script assertions.

---

*This document is maintained as part of the HandicapLab Engineering Principles.*
*Violations should be reported to #engineering on Slack.*