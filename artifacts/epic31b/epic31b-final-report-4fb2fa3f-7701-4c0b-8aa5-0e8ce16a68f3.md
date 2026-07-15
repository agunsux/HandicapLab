
# EPIC 31B — Historical Validation Laboratory (VAR Era)
**Report ID:** `4fb2fa3f-7701-4c0b-8aa5-0e8ce16a68f3`  
**Generated:** `2026-07-15T12:57:28.380Z`  
**Decision:** `BLOCK EPIC 32`

---

## 1. Prediction Quality & Calibration
- **Brier Score:** `0.2451`
- **Log Loss:** `0.6503`
- **ECE (Expected Calibration Error):** `0.1884%`
- **MCE (Maximum Calibration Error):** `0.7126%`
- **Sharpness:** `0.0448`
- **Prediction Entropy:** `0.8448`
- **Prediction Drift (PSI):** `0.0665`

### Reliability Diagram Bins (10 Probability Bins)
| Bin | Range | Confidence | Realized Accuracy | Count |
| :--- | :--- | :--- | :--- | :--- |
| 1 | [0.0, 0.1) | 8.15% | 79.41% | 34 |
| 2 | [0.1, 0.2) | 15.92% | 55.80% | 138 |
| 3 | [0.2, 0.3) | 25.60% | 54.59% | 327 |
| 4 | [0.3, 0.4) | 34.54% | 53.17% | 300 |
| 5 | [0.4, 0.5) | 45.10% | 46.84% | 206 |
| 6 | [0.5, 0.6) | 54.98% | 51.06% | 188 |
| 7 | [0.6, 0.7) | 64.37% | 57.80% | 109 |
| 8 | [0.7, 0.8) | 74.84% | 60.81% | 111 |
| 9 | [0.8, 0.9) | 84.48% | 65.00% | 70 |
| 10 | [0.9, 1.0) | 93.64% | 68.92% | 37 |

---

## 2. Market Quality & Financial Metrics
- **Total Replayed Predictions:** `1520`
- **Realized ROI:** `69.22%`
- **CLV (Closing Line Value):** `-0.0014%`
- **Max Drawdown:** `0.673 units`
- **Profit Factor:** `3.0376`

### Kelly Stake Risk Audit
- **Avg Kelly Stake:** `3.45%`
- **Stake Volatility (Std Dev):** `0.0306`
- **Expected vs Realized Growth:** Expected `0.0179` vs Realized `0.0206`
- **Risk Status:** `SAFE`

---

## 3. Statistical Significance
- **Permutation Test p-value:** `0.136` (observed Brier improvement: `-0.0065`)
- **Seeded 10,000 Bootstrap ROI mean:** `69.2042%`
- **95% Confidence Interval (ROI):** `[57.0367%, 81.8734%]`
- **Bootstrap Statistical Significance:** `SIGNIFICANT (excludes zero)`

---

## 4. Governance & Dataset Provenance
- **Dataset Version:** `v1.0-football-data-VAR`
- **Git Commit:** `development-checkout`
- **Checksum Audit status:** `Unverified`
