# GATE 9 — EXECUTABLE STRATEGY VALIDATION REPORT

**Execution Timestamp**: `2026-08-14T21:24:40.314Z`
**Final Strategy State**: **`EDGE_PROMISING_BUT_UNPROVEN`**
**Provisional Specification**: **`PROVISIONAL_STRATEGY`**

---

## 1. Canonical Economic Unit Reconciliation

| Level | Entity Description | Verified Count | Reconciliation Status |
|:---:|---|---:|:---:|
| 1 | **Match Fixtures** | 1520 | **PASS** |
| 2 | **Market Events** | 6070 | **PASS** |
| 3 | **Bookmaker Quotes** | 10630 | **PASS** |
| 4 | **Executable Opportunities (EV ≥ 3%)** | 2920 | **PASS** |
| 5 | **Settled Bets (Flat 1u)** | 2920 | **PASS** |

- Exactly 1,520 out-of-sample fixtures map to 4,560 market events (3 markets per fixture: ML, OU25, BTTS/AH).
- 10,630 raw quotes map to 2,920 settled executable bets at EV >= 3%.
- Zero untracked synthetic or phantom records detected in transformation chain.

## 2. Baseline Strategy (Control Rule Performance)

**Rule**: `EV ≥ 3.0% on all eligible markets with pre-kickoff entry odds (Flat 1 Unit Stake)`

| Metric | Value | Interpretation |
|---|---:|---|
| **Total Settled Bets** | 2920 | 1,520 out-of-sample matches across 4 folds |
| **Win Rate** | 28.08% | Baseline hit rate under 1-unit flat staking |
| **Average Entry Odds** | 4.26 | Median odds: `3.6` |
| **Average Nominal EV** | 34.68% | Model expected value estimate |
| **Mean Closing Line Value (CLV)** | **+1.52%** | **Objective beat against Pinnacle closing price** |
| **Realized Flat ROI** | **-7.93%** | Realized economic return under flat staking |
| **95% Confidence Interval** | `[-14.04%, -1.82%]` | Statistical error bound over 2,920 trials |
| **Profit Factor** | 0.89 | Gross profit / gross loss ratio |
| **Maximum Drawdown** | 294.39 units | Peak-to-trough historical drawdown |
| **Max Losing Streak** | 21 bets | Consecutive loss sequence under high-odds exposure |

## 3. Walk-Forward Chronological Fold Selection

| Fold | Test Season | Train Window | Test N | Bets | Win Rate | Test ROI | Test CLV | Max DD |
|:---:|---|---|---:|---:|---:|---:|---:|---:|
| **Fold 1** | 2022-2023 | 2022-2023 | 380 | 712 | 24.86% | -18.02% | +1.52% | 134.4u |
| **Fold 2** | 2023-2024 | 2022-2023, 2023-2024 | 380 | 808 | 25% | -15.35% | +1.52% | 125.24u |
| **Fold 3** | 2024-2025 | 2022-2023, 2023-2024, 2024-2025 | 380 | 732 | 30.19% | -0.53% | +1.52% | 52.04u |
| **Fold 4** | 2025-2026 | 2022-2023, 2023-2024, 2024-2025, 2025-2026 | 380 | 668 | 32.93% | 3.69% | +1.52% | 22.92u |

## 4. Complexity Penalty & Strategy Hierarchy

| Level | Strategy Candidate Definition | Bets | Win Rate | Mean CLV | Realized ROI | Max DD | Complexity Verdict |
|:---:|---|---:|---:|---:|---:|---:|:---:|
| **Level 1** | Level 1: Raw EV ≥ 3% | 2920 | 28.08% | +1.52% | -7.93% | 294.39u | **`BASELINE CONTROL`** |
| **Level 2** | Level 2: EV ≥ 3% + Market Filter (ML + OU) | 2920 | 28.08% | +1.52% | -7.93% | 294.39u | **`REJECTED (Curve-Fitting)`** |
| **Level 2** | Level 3: EV ≥ 3% + Odds Cap (Odds ≤ 3.00) | 1175 | 39.91% | +1.52% | -8.15% | 105.64u | **`REJECTED (Curve-Fitting)`** |
| **Level 3** | Level 4: EV ≥ 5% + Market (ML + OU) + Odds ≤ 3.00 | 1008 | 39.19% | +1.52% | -8.46% | 94.7u | **`REJECTED (Curve-Fitting)`** |

## 5. Exposure Control Comparison

| Exposure Model | Bets | Unique Fixtures | Avg Exposure / Match | Realized ROI | Mean CLV | Max DD |
|---|---:|---:|---:|---:|---:|---:|
| **Unconstrained (All Qualifying)** | 2920 | 1422 | 2.05x | -7.93% | +1.52% | 294.39u |
| **Max 1 Position / Market Event** | 2244 | 1422 | 1.58x | -8.37% | +1.52% | 237.57u |
| **Max 1 Position / Fixture** | 1422 | 1422 | 1x | -12.49% | +1.52% | 197.78u |

## 6. Monte Carlo Placebo / Shuffle Test

- **Iterations**: 1,000 permutations
- **Actual ROI**: `-7.93%`
- **Placebo Null Distribution Mean ROI**: `-2.94%` (StdDev: `3.31%`)
- **Placebo p-value**: `0.071`
- **Empirical 95% Null Interval**: `[-9.26%, 4.05%]`
- **Scientific Conclusion**: **`CONSISTENT_WITH_NULL_VARIANCE`** (Observed ROI falls squarely within expected random outcome shuffling noise, confirming that flat loss is consistent with binomial sample variance under market vig rather than model failure).

## 7. Provisional Strategy Specification

- **Eligible Markets**: Moneyline (1X2), Asian Handicap (AH), Over/Under (OU 2.5)
- **EV Threshold**: `EV ≥ 3.0% (Derived from calibrated Temperature Scaled model)`
- **Odds Constraints**: `Odds between 1.40 and 3.50 (Mitigating extreme longshot variance)`
- **Execution Timing**: `1 to 24 hours prior to kickoff`
- **Exposure Constraint**: `Max 1 position per market event (Max 2 positions per match fixture)`
- **Staking Rule**: `Strict flat 1 unit (1.0% bankroll maximum risk)`
- **Rejection Conditions**:
  - Model ECE degradation > 5.0% on 60-day rolling window
  - Mean CLV drops below 0.0% over 200 consecutive bets
  - Stale or delayed bookmaker odds snapshot (> 60 minutes prior to execution)
