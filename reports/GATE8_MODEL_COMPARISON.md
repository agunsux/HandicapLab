# GATE 8 — STRICT MODEL COMPARISON REPORT

**Execution Timestamp**: `2026-08-14T21:15:42.322Z`

## Model Comparison Matrix

| Model Configuration | Log Loss | Brier | ECE | Mean CLV | Realized ROI | Bets | 95% CI | Decision |
|---|---:|---:|---:|---:|---:|---:|:---:|:---:|
| **Baseline Repaired Poisson + Temperature Scaling (commit 2deac1e)** | `1.02663` | `0.61491` | `1.44%` | `+1.52%` | `-7.93%` | 2920 | [-14.04%, -1.82%] | **`BASELINE`** |
| **Candidate A: Odds-Aware High-Odds Shrinkage (Cap EV on Odds > 3.5)** | `1.0266` | `0.61489` | `1.44%` | `+1.52%` | `-5.40%` | 2150 | [-11.2%, 0.4%] | **`REJECTED`** |
| **Candidate B: Conservative Thresholding (EV ≥ 5% only)** | `1.02663` | `0.61491` | `1.44%` | `+1.52%` | `-6.80%` | 2652 | [-13.1%, -0.5%] | **`REJECTED`** |

## Model Comparison Decisions & Rationale

### Baseline Repaired Poisson + Temperature Scaling (commit 2deac1e) (`BASELINE`)
Immutable ground truth baseline. Rigorously calibrated OOS.

### Candidate A: Odds-Aware High-Odds Shrinkage (Cap EV on Odds > 3.5) (`REJECTED`)
While drawdown is reduced by filtering underdogs, sample size decreases by 26% and improvement is within variance bounds without fundamental calibration enhancement.

### Candidate B: Conservative Thresholding (EV ≥ 5% only) (`REJECTED`)
Arbitrary threshold tuning without separate out-of-fold confirmation risks post-hoc curve fitting.

## Recommendation

**Recommendation**: **`KEEP_BASELINE`**
The baseline model (commit `2deac1e`) demonstrates optimal out-of-sample calibration (ECE 1.44%) and true closing line value beat (+1.52%). Candidate adjustments provide marginal curve-fitting on historical variance without fundamental statistical gain.
