# SPECIFICATION: BOTH TEAMS TO SCORE (BTTS) INDEPENDENT MODEL
### Joint Scoring Probability Formulation, Calibration-Only Mode & Pre-Registration
**Document ID:** `SPEC-MODEL-BTTS-v1`  
**Model Identifier:** `BTTS-jointscore-v1.0.0`  
**Market Scope:** Both Teams To Score (`BTTS`)  
**Status:** DESIGN ONLY — GOVERNANCE-GATED — NO CODE / NO TRAINING  
**Authoritative Input Data:** Historical Gold Dataset (`data/golden/europe/`)

---

## 1. Architectural Philosophy & Decoupled Engine

### 1.1 Non-Blended Independence
Under the HandicapLab Three-Model Architecture, Both Teams To Score (BTTS) is treated as a **fundamentally distinct binary classification problem**. It models the joint likelihood of both opponents finding the net, which has completely different sensitivities than goal difference (AH) or total sum (OU):

```
                   ┌────────────────────────────────────────────────────────┐
                   │    Upstream Team Attacking & Defensive Primitives      │
                   │           (λ_home, λ_away, Clean Sheet Factors)         │
                   └──────────────────────────┬─────────────────────────────┘
                                              │
                                              ▼
                   ┌────────────────────────────────────────────────────────┐
                   │                 Model B3: BttsModel                    │
                   │             Identifier: BTTS-jointscore-v1.0.0         │
                   │        Target: Joint Goal Binary Indicator             │
                   │           Y_btts = 1 if (H >= 1 and A >= 1)            │
                   └──────────────────────────┬─────────────────────────────┘
                                              │
                                              ▼
                   ┌────────────────────────────────────────────────────────┐
                   │        CRITICAL GOVERNANCE CEILING (STAGE 2)           │
                   │             Historical BTTS Odds: ZERO                 │
                   │                                                        │
                   │   ALLOWED:                                             │
                   │   ✅ Calibrated Probabilities P(Yes), P(No)            │
                   │   ✅ Brier Score & Log Loss Tracking vs Match Results  │
                   │   ✅ Expected Calibration Error (ECE)                  │
                   │   ✅ Platt / Isotonic Reliability Curves               │
                   │                                                        │
                   │   PROHIBITED:                                          │
                   │   ❌ NO Expected Value (EV)                            │
                   │   ❌ NO Closing Line Value (CLV)                       │
                   │   ❌ NO Simulated ROI / Backtest Returns               │
                   │   ❌ NO Kelly Staking Recommendations                  │
                   │   ❌ NO Synthetic / Inverse-Margin Odds                │
                   └────────────────────────────────────────────────────────┘
```

### 1.2 Anti-Circularity Guarantee
Consistent with the findings of EPIC 60 Stage A:
- `BTTS-jointscore-v1.0.0` uses **zero market odds as input features**.
- Model parameters are derived solely from fundamental pre-match scoring rates, defensive clean sheet frequencies, and inter-team attacking dynamics.

---

## 2. Mathematical Formulation

### 2.1 Target Variable Definition
Given final score $(H, A)$, the binary ground truth is:

$$Y_{\text{BTTS}} = \begin{cases} 1 & \text{if } H \ge 1 \text{ and } A \ge 1 \\ 0 & \text{if } H = 0 \text{ or } A = 0 \end{cases}$$

### 2.2 Primary Probability Approaches

#### Approach 1: Bivariate Goal Integration (Score Matrix Derivative)
Integrating the joint distribution $P(H=h, A=a)$ across all non-zero pairs:

$$P(\text{Yes}) = \sum_{h=1}^{M} \sum_{a=1}^{M} P(H = h, A = a) = 1 - P(H=0) - P(A=0) + P(H=0, A=0)$$
$$P(\text{No}) = 1.0 - P(\text{Yes})$$

Where $P(H=0, A=0)$ incorporates the Dixon-Coles clean sheet correlation factor $\tau(0,0) = 1 - \lambda \mu \rho$.

#### Approach 2: Direct Joint Logistic Binary Classifier
An independent logistic regression modeling log-odds of joint scoring:

$$\text{logit}(P(\text{Yes})) = \beta_0 + \beta_1 \log(\lambda_{\text{home}}) + \beta_2 \log(\lambda_{\text{away}}) + \beta_3 (\text{CS}_{\text{home}} + \text{CS}_{\text{away}}) + \beta_4 (\text{EloDiff})$$

where $\text{CS}$ represents rolling clean sheet rates over the prior 10 matches.

---

## 3. Base-Rate Frequency vs. Economic Edge

### 3.1 Exploratory Frequency vs. Real Market Edge
Juragan floated analyzing two-season BTTS base rates per league (e.g. 52% Yes in Serie A vs 61% in Bundesliga).

**Constitutional Constraint:**
1. **Base-rate is Not Edge:** A 60% historical Yes frequency in the Bundesliga does NOT imply profitability. Sharp bookmakers price high-scoring leagues with heavy juice on Yes (e.g. odds of $1.50$, implying $66.7\%$). Betting Yes on a $60\%$ base-rate would lose $-10\%$ ROI per wager.
2. **Profitability Requires Market Odds:** Because Stage 2 established that historical BTTS odds are **0 rows across the entire golden dataset**, there is NO historical bookmaker price against which EV or CLV can be measured.
3. **Strict Prohibition on Synthetic Odds:** The system MUST NOT calculate synthetic odds from over/under totals or moneyline margins to fabricate an EV backtest. All economic indicators must remain strictly `null`.

---

## 4. What the Model CAN and CANNOT Claim

Following the EPIC 62 Stage 2 data audit, the boundaries of `BTTS-jointscore-v1.0.0` are mathematically locked:

### What the Model CAN Claim:
- **Calibrated Probabilities:** Emit validated probabilities $P(\text{Yes}) \in (0, 1)$ and $P(\text{No}) = 1 - P(\text{Yes})$.
- **Calibration Verification:** Compute multi-season Brier scores against actual match results:
  $$\text{Brier}_{\text{BTTS}} = \frac{1}{N} \sum_{i=1}^N (P(\text{Yes})_i - y_i)^2, \quad y_i \in \{0, 1\}$$
- **Information Discrimination:** Measure Log Loss, Cross-Entropy, and Expected Calibration Error (ECE) across decile reliability bins.
- **Walk-Forward Performance:** Measure calibration stability across 3 chronological folds.

### What the Model CANNOT Claim:
- **NO Expected Value (EV):** `ev: null` (Cannot calculate edge without historical taken price).
- **NO Closing Line Value (CLV):** `clv: null` (Cannot calculate beat-the-closing-line rate without closing odds).
- **NO Historical ROI / Yield:** `roi: null` (Cannot compute financial PnL).
- **NO Kelly Staking:** `kellyStake: null` (Kelly formula requires market odds $b$).
- **NO Value Signals:** `isValueBet: false` (EdgeScanner is strictly blocked from emitting BTTS picks).

---

## 5. Walk-Forward Validation Protocol

Like AH and OU, validation must be executed strictly chronologically:
- **Fold 1:** Train $Y_1, Y_2$ $\to$ Test $Y_3$
- **Fold 2:** Train $Y_2, Y_3$ $\to$ Test $Y_4$
- **Fold 3:** Train $Y_3, Y_4$ $\to$ Test $Y_5$

### Benchmark Comparison Targets
1. **Naive Climatology:** Always predicting historical league mean $\bar{p}$.
2. **Univariate Independent Poisson:** $P(\text{Yes}) = (1 - e^{-\lambda_H})(1 - e^{-\mu_A})$ (assumes zero mutual dependence).
3. **Acceptance Threshold:** `BTTS-jointscore-v1.0.0` must demonstrate statistically significant lower Brier Score and Log Loss than both benchmarks on OOS folds.

---

## 6. Pre-Registered Hypotheses for Benjamini-Hochberg (FDR) Testing

The following $M = 5$ hypotheses are **pre-registered** for empirical evaluation:

| Hypothesis ID | Target Market / Scope | Null Hypothesis ($H_0$) | Test Statistic & Acceptance Threshold |
|---|---|---|---|
| **`H0-BTTS-1`** | Top 5 European Leagues | OOS Brier Score $\ge$ Naive Climatology Baseline ($\text{Brier} \ge 0.2465$) | Paired Wilcoxon signed-rank test, $p < \alpha_{\text{FDR}}$, $N \ge 2,000$ |
| **`H0-BTTS-2`** | Top 5 European Leagues | Bivariate Dixon-Coles Log Loss $\ge$ Independent Poisson Log Loss | Likelihood Ratio Test, $p < \alpha_{\text{FDR}}$ |
| **`H0-BTTS-3`** | High-Defensive Regime ($\text{CS}_{\text{home}} + \text{CS}_{\text{away}} > 0.45$) | Calibration curve error on No $> 0.040$ | Decile Reliability Error $\le 0.040$ |
| **`H0-BTTS-4`** | Asymmetric Matchups (Heavy Favorite $\lambda_H > 2.5, \lambda_A < 0.8$) | Overconfidence bias: ECE $\ge 0.050$ | Bin-wise ECE $< 0.050$ |
| **`H0-BTTS-5`** | Temporal Parameter Stability | Season-to-season Brier drift $> 0.015$ | Kolmogorov-Smirnov test on residual distribution, $p > 0.05$ |

### FDR Correction Procedure
At evaluation time, all 5 p-values will be ranked $p_{(1)} \le \dots \le p_{(5)}$ and tested against Benjamini-Hochberg critical thresholds $\frac{k}{5} \times 0.05$.
