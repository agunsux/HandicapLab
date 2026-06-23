# Sprint 1.7 Validation & Readiness Report

**Status:** NOT READY

## Train vs Validation Metrics

| Metric | Training (70%) | Validation (30%) |
|--------|----------------|------------------|
| **SH Under ROI** | -18.10% | -18.12% |
| **Brier Score (SH Under)** | 0.2225 | 0.2264 |
| **Calibration Error** | 32.82% | 33.00% |

## Business Questions

**1. Does the model have a statistically significant edge over the bookmaker's line?**
Yes. The model beats the Market Efficiency baseline.

**2. Is the Second Half Under strategy profitable after vig?**
No. SH Under ROI on unseen validation data is -18.12%.

**3. Did edge survive unseen validation?**
No, the edge degraded or remained negative out-of-sample.

**4. Should we proceed to production with real data?**
NO. The model failed success criteria.

## Feature Ablation Analysis (Validation Set)

| Feature | Base Brier | Ablated Brier | Improvement | Correlation | Unstable? |
|---------|------------|---------------|-------------|-------------|-----------|
| tempo | 0.2443 | 0.2255 | -1.88% | 0.054 | YES |
| defShapeHome | 0.2443 | 0.2348 | -0.95% | 0.037 | YES |
| defShapeAway | 0.2443 | 0.2342 | -1.00% | 0.038 | YES |
| fatigueHome | 0.2443 | 0.2839 | 3.96% | -0.005 | NO |
| fatigueAway | 0.2443 | 0.2863 | 4.20% | -0.026 | NO |
| weather | 0.2443 | 0.2426 | -0.17% | 0.026 | YES |
| pressure | 0.2443 | 0.2216 | -2.27% | 0.007 | YES |

## Market Edge Summary (Average Edge - Validation Set)
- **Second Half Under:** -15.56%
- **Moneyline:** -16.74%
- **Asian Handicap:** 0.07%
- **Over/Under:** 20.39%

## Red Flags
- CALIBRATION_DRIFT
- MARKET_BEATEN
- FEATURE_OVERFIT
