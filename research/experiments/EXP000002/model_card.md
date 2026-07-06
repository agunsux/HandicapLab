# Model Card: Poisson Probability Model (v2.0.0)
Generated: 2026-07-06T23:09:21.175Z

## 1. Model Details
* **Description**: Poisson distribution based expected goals model
* **Architecture**: Unknown
* **Hyperparameters**: ```json
{
  "deterministic": true
}
```

## 2. Intended Use & Limitations
* **Intended Use**: Football match outcome prediction for closing line value estimation and betting edge discovery.
* **Limitations**:
  * Static configuration
* **Ethical Considerations**:
  * Do not use for real money betting without human oversight

## 3. Training & Evaluation Data
* **Dataset**: Gold Dataset v1.0 - EPL Historical
* **Training Window**: 2018-2023
* **Testing Window**: 2018-2023
* **Feature Set**: homeAttack, awayAttack, homeDefense, awayDefense

## 4. Quantitative Analysis

### 4.1 Statistical Performance
| Metric | Value |
|--------|-------|
| LogLoss | NaN |
| Brier Score | NaN |
| ROC-AUC | 0.5000 |
| PR-AUC | 0.3337 |
| ECE (Expected Calibration Error) | 0.0000 |
| MCE (Maximum Calibration Error) | 0.0000 |

### 4.2 Business Impact (Simulated)
| Metric | Value |
|--------|-------|
| Flat Stake ROI | 0.00% |
| Kelly Stake ROI | NaN% |
| Max Drawdown | 0.00% |
| Average CLV | 0.00% |
| Bets w/ Positive CLV | 0.00% |

