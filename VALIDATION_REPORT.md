# Sprint 1.5 Statistical Validation Report

## Execution Summary
- **Dataset Size:** 10000 simulated matches
- **Guard Statuses:** All Systems Nominal
- **Variance Stable:** Yes

## Accuracy & Probabilistic Performance
- **Brier Score (ML Home):** 0.2354 *(lower is better, 0.25 is random guessing)*
- **Overall Calibration Error:** 6.80%

### Market Accuracy
- **Moneyline (Match Winner):** 46.79%
- **Asian Handicap:** 48.41%
- **Over/Under:** 67.08%

## Bias Detection
- **Home Bias:** -9.46%
- **Over Bias:** 4.91%
- **BTTS Rate:** 62.50%

## Market Edge Summary (Average Edge)
- **Moneyline:** -16.10%
- **Asian Handicap:** 0.03%
- **Over/Under:** 16.92%

## Calibration Table

| Bucket | Predicted Mean | Actual Rate | Sample Size | Calibration Error |
|--------|---------------|-------------|-------------|-------------------|
| 0-10% | 0.0% | 0.0% | 0 | 0.00% |
| 10-20% | 19.3% | 13.1% | 61 | 6.14% |
| 20-30% | 26.4% | 27.8% | 3029 | 1.43% |
| 30-40% | 34.6% | 42.6% | 3845 | 8.01% |
| 40-50% | 44.6% | 63.2% | 2310 | 18.56% |
| 50-60% | 53.2% | 76.0% | 737 | 22.79% |
| 60-70% | 61.2% | 72.2% | 18 | 11.04% |
| 70-80% | 0.0% | 0.0% | 0 | 0.00% |
| 80-90% | 0.0% | 0.0% | 0 | 0.00% |
| 90-100% | 0.0% | 0.0% | 0 | 0.00% |

## Known Limitations
- The simulated market implied probabilities for AH and O/U are currently fixed at 50% for edge calculation, which may not reflect real asymmetric markets.
- Goal distribution generation uses a basic Poisson curve which fails to account for late-game state dependencies.
- Match input statistics (shots, form) are uniformly randomized with noise rather than strictly correlated historical curves.
