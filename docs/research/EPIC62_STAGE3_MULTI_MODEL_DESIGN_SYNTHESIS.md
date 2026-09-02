# EPIC 62 — STAGE 3: MULTI-MODEL FOUNDATION DESIGN SYNTHESIS
### Independent Architectural Framework for Over/Under & Both Teams To Score Models
**Document ID:** `DOC-EPIC62-STAGE3-SYNTHESIS`  
**Date:** 2026-09-02  
**Governance Scope:** Stage 3 Design Only — Gated Before Implementation  
**Status:** **STAGE 3 DESIGN COMPLETE — AWAITING JURAGAN SIGN-OFF**

---

## 1. Executive Summary & Governance Compliance

In accordance with the HandicapLab Product Philosophy and the Stage 3 mandate:
1. **Three Independent Models:** Asian Handicap (AH), Over/Under (OU), and Both Teams To Score (BTTS) are designed as three strictly decoupled models with separate targets, independent calibration pipelines, and independent versioning. A single blended model is prohibited.
2. **Zero Production Code / Zero Migrations / Zero Training:** This document and its accompanying model specifications represent architectural designs and hypothesis pre-registrations only. No database schemas were altered, no code was written, and no backtests were executed.
3. **Circularity Shield:** Informed by the empirical ablation in Stage 1 (`CONFIRMED_CIRCULAR` for odds-blended architectures), the OU and BTTS models are strictly designed with zero market odds input features.
4. **Data Reality Alignment:** The designs strictly adhere to the empirical constraints proven in Stage 2 (OU Line 2.5 only has historical odds; BTTS has zero historical odds).

---

## 2. Decoupled Model Specifications Overview

| Dimension | Model 1: Asian Handicap | Model 2: Over/Under | Model 3: Both Teams To Score |
|---|---|---|---|
| **Model Identifier** | `AH-dixoncoles-v1.0.0` | `OU-poisson-v1.0.0` | `BTTS-jointscore-v1.0.0` |
| **Specification Doc** | Maintained in EPIC 56 / EPIC 60 | [`docs/research/OU_MODEL_SPECIFICATION.md`](file:///c:/Users/RYZEN/.antigravity-ide/HandicapLab/docs/research/OU_MODEL_SPECIFICATION.md) | [`docs/research/BTTS_MODEL_SPECIFICATION.md`](file:///c:/Users/RYZEN/.antigravity-ide/HandicapLab/docs/research/BTTS_MODEL_SPECIFICATION.md) |
| **Target Variable** | Goal Difference: $\Delta = H - A + \text{Line}$ | Total Goals: $G = H + A$ vs Line $L$ | Joint Scoring: $Y = \mathbb{I}(H \ge 1 \land A \ge 1)$ |
| **Loss Function** | Ranked Probability Score (RPS) / Cross-Entropy | Binary Brier Score / Log Loss | Binary Brier Score / Log Loss |
| **Input Features** | $\lambda_H, \lambda_A, \text{EloDiff}$, Home Advantage | $\lambda_H, \lambda_A, \mu_H, \mu_A, \alpha_{\text{league}}$, Rest Days | $\lambda_H, \lambda_A, \text{CleanSheetRates}, \tau(0,0)$ |
| **Market Odds Inputs** | **NONE** (Zero odds features) | **NONE** (Zero odds features) | **NONE** (Zero odds features) |
| **Historical Odds Depth** | 23,864 rows across 8,895 matches | 23,875 rows (100% on line 2.5) | **0 rows** ($N=0$) |
| **Permitted Output Metrics** | Probability, Brier, CLV, EV, ROI | Line 2.5: Full CLV/EV/ROI<br>Other Lines: Probability only | **Probability, Brier, LogLoss, ECE only**<br>*(NO EV / NO CLV / NO ROI)* |
| **Pre-Registered Hypotheses** | EPIC 60 Track | 6 Hypotheses (`H0-OU-1` to `6`) | 5 Hypotheses (`H0-BTTS-1` to `5`) |

---

## 3. Impact Analysis of Stage 1 Ablation (Circularity Shield)

### Background from Stage 1:
In EPIC 62 Stage 1, ablation testing of EPIC 54 `model_2_market_ensemble` confirmed that its calibration gain was 100% borrowed from sharp market odds ($w=0.0 \to 0.6421$ Brier; $w=1.0 \to 0.5618$ Brier). The model did not possess independent predictive alpha.

### Architectural Constraint Applied to OU & BTTS:
1. **Odds Feature Ban:** Neither `OU-poisson-v1.0.0` nor `BTTS-jointscore-v1.0.0` may ingest market odds (Moneyline, AH, or OU) into their feature sets.
2. **True Structural Alpha:** Both models derive probabilities solely from structural football variables (expected goal generation, defensive concession rates, clean-sheet parameters, and bivariate scoreline adjustments).
3. **Downstream Price Verification:** Market odds appear exclusively downstream as the benchmark price for calculating Closing Line Value (CLV) and Expected Value (EV).

---

## 4. Key Findings from Specific Model Designs

### 4A. Over/Under Model (`OU_MODEL_SPECIFICATION.md`)
- **Base-Rate Trap Addressed:** Raw historical frequencies (e.g. 54% Over in recent seasons) are exploratory hypothesis generators, NOT edges. Sharp bookmakers price lines dynamically. True edge exists only when $P_{\text{model}}(\text{Over}) - P_{\text{market}}^{\text{devig}}(\text{Over}) > 0$.
- **Line 2.5 Isolation:** All economic backtesting (CLV, EV, Kelly, simulated ROI) is strictly confined to Line 2.5. Alternate and quarter lines are output as pure mathematical distributions without economic claims.

### 4B. BTTS Model (`BTTS_MODEL_SPECIFICATION.md`)
- **Zero Odds Reality:** The gold dataset contains 0 historical BTTS odds rows.
- **Calibration-Only Mode:** The model is formally restricted to probability estimation and calibration metrics (Brier score against actual match scores, Log Loss, and Reliability Curves).
- **Hard Gate on Economics:** EV, CLV, ROI, and Kelly stakes are locked to `null`. EdgeScanner is programmatically prevented from generating BTTS value picks until real historical BTTS odds are ingested with verified provenance.
- **Prohibition on Synthetic Odds:** No inverted margins or synthetic prices may be constructed.

---

## 5. Asian Handicap Note for EPIC 60 Track (3C)

While EPIC 62 Stage 3 does not redesign Asian Handicap (which is reserved for EPIC 60), the Stage 2 data audit surfaced key empirical characteristics regarding **Line AH -1.5**:

1. **Volume & Density:** In the canonical gold dataset, Line `AH -1.5` has **1,116 historical odds rows** across the 5 European leagues.
2. **Sample Depth Verdict:** With $N = 1,116$, AH -1.5 comfortably exceeds the minimum empirical threshold for statistical evaluation ($N \ge 250$). It is NOT sparse like extreme lines ($|line| \ge 2.25$, which have $<250$ rows and are gated as `INSUFFICIENT_DATA`).
3. **League Distribution Caveat:** 601 of the 1,116 rows (53.8%) originate from the English Premier League (which spans 2015–2026). The non-EPL leagues (La Liga, Bundesliga, Serie A, Ligue 1) each have ~120–140 rows for AH -1.5 and stop at 2019–2020.
4. **Recommendation for EPIC 60:** When EPIC 60 evaluates untested standard lines such as AH -1.5, backtesting must account for the cross-league temporal disparity or evaluate on EPL walk-forward folds first to avoid small-sample bias in continental leagues.

---

## 6. Master Pre-Registration Table for Benjamini-Hochberg (FDR) Testing

To maintain strict scientific integrity and eliminate p-hacking, the following $M = 11$ hypotheses are pre-registered prior to running any backtest:

| # | Hypothesis ID | Target Market | Null Hypothesis ($H_0$) | Evaluation Metric & Standard |
|---|---|---|---|---|
| 1 | `H0-OU-1` | EPL Line 2.5 | Mean CLV against Pinnacle closing $\le 0.0\%$ | One-tailed Z-test, $p < \alpha_{\text{FDR}}$ |
| 2 | `H0-OU-2` | Top 5 European Leagues Line 2.5 | Out-of-sample Brier Score $\ge 0.2450$ (Naive Climatology) | Permutation test (10,000 runs) |
| 3 | `H0-OU-3` | High-Scoring Regime ($\lambda_H + \lambda_A > 3.10$) | Realized ROI on Over 2.5 $\le 0.0\%$ | Bootstrap 95% CI lower bound $> 0.0\%$ |
| 4 | `H0-OU-4` | Low-Scoring Regime ($\lambda_H + \lambda_A < 2.20$) | Realized ROI on Under 2.5 $\le 0.0\%$ | Bootstrap 95% CI lower bound $> 0.0\%$ |
| 5 | `H0-OU-5` | Base-Rate Divergence Signal | Edge vs de-vigged market odds $\le 0.0\%$ | Paired t-test vs sharp price |
| 6 | `H0-OU-6` | Cross-League Calibration Stability | Expected Calibration Error (ECE) $> 0.035$ | 10-decile reliability binning |
| 7 | `H0-BTTS-1` | Top 5 European Leagues | Out-of-sample Brier Score $\ge 0.2465$ (Naive Climatology) | Paired Wilcoxon signed-rank test |
| 8 | `H0-BTTS-2` | Top 5 European Leagues | Bivariate Dixon-Coles Log Loss $\ge$ Independent Poisson Log Loss | Likelihood Ratio Test |
| 9 | `H0-BTTS-3` | High Clean Sheet Regime ($\text{CS}_H + \text{CS}_A > 0.45$) | Calibration curve error on "No" $> 0.040$ | Decile Reliability Error |
| 10 | `H0-BTTS-4` | Heavy Favorite Asymmetry ($\lambda_H > 2.5, \lambda_A < 0.8$) | Overconfidence bias: ECE $\ge 0.050$ | Bin-wise ECE |
| 11 | `H0-BTTS-5` | Temporal Parameter Stability | Season-to-season Brier drift $> 0.015$ | Kolmogorov-Smirnov test |

### Pre-Registered FDR Correction Procedure:
When empirical backtests are performed in subsequent EPICs:
1. Rank all $M = 11$ p-values: $p_{(1)} \le p_{(2)} \le \dots \le p_{(11)}$.
2. Compute critical values: $c_k = \frac{k}{11} \times 0.05$.
3. Find maximum $k$ where $p_{(k)} \le c_k$.
4. Reject $H_0$ only for $i \le k$. All other results are formally reported as **NOT STATISTICALLY SIGNIFICANT**.

---

## 7. Next Steps & Stage 3 Gate

**STAGE 3 DESIGN IS COMPLETE.**  
**NO PRODUCTION IMPLEMENTATION HAS COMMENCED.**

Awaiting Juragan's review and sign-off on:
1. The decoupled model designs for Over/Under and Both Teams To Score.
2. The Line 2.5 restriction and BTTS calibration-only mode.
3. The 11 pre-registered hypotheses for Benjamini-Hochberg multiple-testing control.
4. The note for EPIC 60 regarding AH -1.5 volume and temporal distribution.
