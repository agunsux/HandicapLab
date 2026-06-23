# Sprint 1.5 Statistical Validation Report

## Execution Summary
- **Dataset Size:** 10000 simulated matches
- **Guard Statuses:** All Systems Nominal
- **Red Flags / System Flags:** MARKET_BEATEN
- **Variance Stable:** Yes

## Accuracy & Probabilistic Performance
- **Model Brier Score (ML Home):** 0.2362 
- **Market Brier Score:** 0.2254
- **Naive Fav Brier Score:** 0.3852
- **Overall Calibration Error:** 7.66%

## Market ROI (Accounting for Vig)
- **Model ML ROI:** -4.64%
- **Model AH ROI:** -7.40%
- **Model OU ROI:** 26.82%
- **Second Half Under ROI:** -0.86%

## Baseline ML ROI Comparisons
- **Market Efficiency Baseline ROI:** -8.45%
- **Random Baseline ROI:** -16.30%
- **Naive Favorite Baseline ROI:** -8.45%

## Market Edge Summary (Average Edge)
- **Moneyline:** -15.99%
- **Asian Handicap:** 0.01%
- **Over/Under:** 17.01%

## Calibration Table

| Bucket | Predicted Mean | Actual Rate | Sample Size | Calibration Error |
|--------|---------------|-------------|-------------|-------------------|
| 0-10% | 0.0% | 0.0% | 0 | 0.00% |
| 10-20% | 19.2% | 16.3% | 86 | 2.92% |
| 20-30% | 26.4% | 28.1% | 3088 | 1.72% |
| 30-40% | 34.6% | 44.2% | 3660 | 9.54% |
| 40-50% | 44.5% | 61.5% | 2387 | 16.97% |
| 50-60% | 53.2% | 75.4% | 760 | 22.20% |
| 60-70% | 61.0% | 84.2% | 19 | 23.23% |
| 70-80% | 0.0% | 0.0% | 0 | 0.00% |
| 80-90% | 0.0% | 0.0% | 0 | 0.00% |
| 90-100% | 0.0% | 0.0% | 0 | 0.00% |
