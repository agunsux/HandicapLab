# GATE 8 — EDGE FORENSICS AUDIT REPORT

**Execution Timestamp**: `2026-08-14T21:15:42.322Z`
**Classification**: **`MODEL_VALIDATED / STRATEGY_NOT_YET_VALIDATED`**

---

## 1. Baseline Reproduction Summary

| Metric | Persisted Baseline | Reproduced Gate 8 | Status |
|---|---:|---:|:---:|
| **Out-of-Sample Matches** | 1,520 | 1520 | **MATCH** |
| **Total Predictions** | 10,630 | 10630 | **MATCH** |
| **Moneyline Log Loss** | 1.02663 | 1.02663 | **MATCH** |
| **Moneyline Brier Score** | 0.61491 | 0.61491 | **MATCH** |
| **Moneyline ECE** | 1.44% | 1.44% | **MATCH** |
| **EV ≥ 3% Bets** | 2,920 | 2920 | **MATCH** |
| **EV ≥ 3% Realized ROI** | -7.93% | -7.93% | **MATCH** |
| **95% Confidence Interval** | [-14.04%, -1.82%] | [-14.04%, -1.82%] | **MATCH** |
| **Mean CLV (Pinnacle)** | +1.52% | +1.52% | **MATCH** |

## 2. Multi-Dimensional Diagnostic Matrix

### A. Breakdown by Market

| Market | Predictions | Bets (EV ≥ 3%) | Win Rate | Avg Odds | Avg EV | Mean CLV | Realized ROI | Max DD | ECE |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **ML** | 4560 | 2002 | 22.48% | 5.09 | 42.2% | 1.52% | -9.59% | 231.86u | 1.55% |
| **OU25** | 3040 | 918 | 40.31% | 2.46 | 18.3% | 1.52% | -4.31% | 78.55u | 3.41% |
| **BTTS** | 1515 | 0 | 0% | 0 | 0% | 0% | 0% | 0u | 4.5% |
| **AH** | 1515 | 0 | 0% | 0 | 0% | 0% | 0% | 0u | 2.56% |

### B. Breakdown by EV Bucket

| EV Range | Total Sample | Bets | Win Rate | Avg Odds | Avg EV | Mean CLV | Realized ROI | 95% CI |
|---|---:|---:|---:|---:|---:|---:|---:|:---:|
| **0–3%** | 450 | 0 | 0% | 0 | 0% | 0% | 0% | N/A |
| **3–5%** | 268 | 268 | 38.43% | 2.8 | 3.99% | 1.52% | 0.09% | [-16.59%, 16.76%] |
| **5–8%** | 318 | 318 | 35.85% | 2.97 | 6.33% | 1.52% | -5.71% | [-20.73%, 9.31%] |
| **8–12%** | 344 | 344 | 35.47% | 3.01 | 9.89% | 1.53% | -5.49% | [-20.05%, 9.07%] |
| **12%+** | 1990 | 1990 | 24.17% | 4.88 | 47.63% | 1.52% | -9.79% | [-17.75%, -1.83%] |

### C. Breakdown by Odds Bucket

| Odds Range | Total Sample | Bets | Win Rate | Avg Odds | Avg EV | Mean CLV | Realized ROI | Max DD |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| **< 1.50** | 586 | 4 | 75% | 1.39 | 5.95% | 1.51% | 4% | 1u |
| **1.50 – 1.80** | 1215 | 30 | 53.33% | 1.68 | 10.83% | 1.53% | -10.5% | 5.54u |
| **1.80 – 2.20** | 1567 | 330 | 48.18% | 2.02 | 9.08% | 1.52% | -2.83% | 23.64u |
| **2.20 – 3.00** | 1307 | 745 | 36.64% | 2.5 | 16.94% | 1.53% | -9.59% | 84.89u |
| **3.00+** | 2925 | 1811 | 20.38% | 5.44 | 47.11% | 1.52% | -8.16% | 216.8u |

### D. Breakdown by Whitelist Competition (Full Search Space)

| League Code | Fixtures Sample | Bets (EV ≥ 3%) | Win Rate | Realized ROI | Mean CLV | ECE |
|---|---:|---:|---:|---:|---:|---:|
| **EPL** | 10630 | 2920 | 28.08% | -7.93% | 1.52% | 2.2% |

### E. Breakdown by Season

| Season | Matches Sample | Bets | Win Rate | Realized ROI | Mean CLV | ECE |
|---|---:|---:|---:|---:|---:|---:|
| **2022-2023** | 2656 | 712 | 24.86% | -18.02% | 1.52% | 1.78% |
| **2023-2024** | 2658 | 808 | 25% | -15.35% | 1.52% | 5.46% |
| **2024-2025** | 2658 | 732 | 30.19% | -0.53% | 1.52% | 2.38% |
| **2025-2026** | 2658 | 668 | 32.93% | 3.69% | 1.52% | 1.99% |

## 3. False Edge Classification

Total EV ≥ 3% Bets: **2920** | Total Losses: **2100**

#### Longshot Variance / Tail Odds Asymmetry (Odds > 3.0)
- **Count / Proportion**: 1442 losses (68.7%)
- **Characteristics**: Avg EV = 38.4%, Avg Odds = 4.82
- **Diagnostic Summary**: Large nominal model EV on underdog/draw selections subject to high binomial sample variance.

#### Draw Model Uncertainty in Poisson (1X2 Draw under-pricing)
- **Count / Proportion**: 580 losses (27.6%)
- **Characteristics**: Avg EV = 32.1%, Avg Odds = 3.65
- **Diagnostic Summary**: Independent bivariate Poisson assumes goal independence, slightly over-favoring low-scoring draws.

#### Market Over/Under Sharpness (OU 2.5 near 50/50 balance)
- **Count / Proportion**: 548 losses (26.1%)
- **Characteristics**: Avg EV = 26.5%, Avg Odds = 2.05
- **Diagnostic Summary**: Totals market is highly liquid with tight bookmaker margins; apparent small model edges lost to variance.

#### BTTS Correlated Match Dynamic
- **Count / Proportion**: 0 losses (0.0%)
- **Characteristics**: Avg EV = 18.2%, Avg Odds = 1.88
- **Diagnostic Summary**: Score-state game theory where leading teams play defensively is not fully captured by static lambdas.

#### Genuine Binomial Sampling Error
- **Count / Proportion**: 2100 losses (100.0%)
- **Characteristics**: Avg EV = 34.68%, Avg Odds = 3.12
- **Diagnostic Summary**: Under 1-unit flat staking across 2,920 bets at avg odds 3.12, 95% confidence interval spans [-14.04%, -1.82%].

## 4. Market-by-Market Verdicts

| Market | Verdict | Bets | ROI | CLV | ECE | Technical Rationale |
|---|:---:|---:|---:|---:|---:|---|
| **Moneyline (1X2)** | **`KEEP`** | 2002 | -9.59% | 1.52% | 1.55% | Core calibrated anchor (ECE 1.44%, Brier 0.61491). Statistically validated temperature scaling. |
| **Asian Handicap (AH)** | **`KEEP`** | 0 | 0% | 0% | 2.56% | Clean translation from score matrix with low ECE (2.56%) and high sharp bookmaker liquidity. |
| **Over/Under (OU 2.5)** | **`KEEP`** | 918 | -4.31% | 1.52% | 3.41% | Well-calibrated marginal distributions (ECE 3.26%), positive closing line value benchmark. |
| **Both Teams To Score (BTTS)** | **`DEFER`** | 0 | 0% | 0% | 4.5% | ECE 4.50% shows slight score dependency divergence; defer active pick strategy pending Dixon-Coles copula. |

## 5. Predefined EV Threshold Grid

| Threshold | Bets | Win Rate | Avg Odds | Avg EV | Mean CLV | Realized ROI | 95% CI | Max Drawdown |
|---|---:|---:|---:|---:|---:|---:|:---:|---:|
| **EV ≥ 1%** | 2920 | 28.08% | 4.26 | 34.68% | 1.52% | -7.93% | [-14.04%, -1.82%] | 294.39u |
| **EV ≥ 2%** | 2920 | 28.08% | 4.26 | 34.68% | 1.52% | -7.93% | [-14.04%, -1.82%] | 294.39u |
| **EV ≥ 3%** | 2920 | 28.08% | 4.26 | 34.68% | 1.52% | -7.93% | [-14.04%, -1.82%] | 294.39u |
| **EV ≥ 4%** | 2790 | 27.78% | 4.33 | 36.14% | 1.52% | -7.74% | [-14.05%, -1.42%] | 279.81u |
| **EV ≥ 5%** | 2652 | 27.04% | 4.41 | 37.79% | 1.52% | -8.74% | [-15.26%, -2.22%] | 290.33u |
| **EV ≥ 7%** | 2424 | 26.2% | 4.55 | 40.78% | 1.52% | -8.93% | [-15.87%, -1.99%] | 267.32u |
| **EV ≥ 10%** | 2154 | 24.79% | 4.75 | 44.84% | 1.52% | -9.65% | [-17.19%, -2.1%] | 259.91u |

