# SPECIFICATION: OVER/UNDER INDEPENDENT PROBABILITY MODEL
### Architecture, Calibration Protocol & Hypothesis Pre-Registration
**Document ID:** `SPEC-MODEL-OU-v1`  
**Model Identifier:** `OU-poisson-v1.0.0`  
**Market Scope:** Total Goals Over/Under (`OU`)  
**Status:** DESIGN ONLY — GOVERNANCE-GATED — NO CODE / NO TRAINING  
**Authoritative Input Data:** Historical Gold Dataset (`data/golden/europe/`)

---

## 1. Architectural Philosophy & Separation of Concerns

### 1.1 Non-Blended, Target-Specific Modeling
Under the HandicapLab Three-Model Architecture, the Over/Under market is modeled as an **independent downstream system** with its own distinct target variables, loss functions, and calibration curves. It is NOT a cosmetic side-output of an Asian Handicap engine, nor is it coupled to Moneyline.

```
                    ┌────────────────────────────────────────────────────────┐
                    │     Independent Upstream Team Goal Expectation         │
                    │         λ_home, λ_away (Pure Football Data)            │
                    └──────────────────────────┬─────────────────────────────┘
                                               │
                                               ▼
                    ┌────────────────────────────────────────────────────────┐
                    │               Model B2: OverUnderModel                 │
                    │               Identifier: OU-poisson-v1.0.0            │
                    │   Target: Total Goals G = (H + A) vs Threshold Line L  │
                    └──────────────────────────┬─────────────────────────────┘
                                               │
                       ┌───────────────────────┴───────────────────────┐
                       ▼                                               ▼
         ┌───────────────────────────┐                   ┌───────────────────────────┐
         │         Line 2.5          │                   │   Non-2.5 Lines (Quarter/ │
         │   (Historical Odds: YES)  │                   │      Half / Alternate)    │
         │  Full Economic Evaluation │                   │   (Historical Odds: ZERO) │
         │   (Brier, LogLoss, ECE,   │                   │  Probability Density Only │
         │     CLV, EV, Simulated)   │                   │   NO EV / NO ROI / NO CLV │
         └───────────────────────────┘                   └───────────────────────────┘
```

### 1.2 Strict Circularity Preclusion (Learnings from EPIC 60 Stage A)
The empirical ablation in EPIC 60 Stage A established that injecting de-vigged market odds as an input feature creates circular dependencies where apparent model skill is merely borrowed bookmaker consensus.
- **Rule:** `OU-poisson-v1.0.0` MUST NOT take market odds (1X2, AH, or OU) as input features.
- **Feature Set:** Strictly restricted to point-in-time football primitives:
  - Rolling offensive goal production (time-decayed $\lambda_{\text{home,att}}$, $\lambda_{\text{away,att}}$)
  - Rolling defensive concession rates (time-decayed $\mu_{\text{home,def}}$, $\mu_{\text{away,def}}$)
  - League baseline scoring parameters ($\alpha_{\text{league}}$)
  - Rest days and fixture congestion indicators ($T_{\text{rest}}$)
- **Role of Market Odds:** De-vigged Pinnacle market odds are used **exclusively downstream** to evaluate Closing Line Value (CLV) and Expected Value (EV).

---

## 2. Mathematical Formulation

### 2.1 Joint Goal Distribution & Marginal Total Goals
The core probability engine models match scorelines $(h, a) \in \mathbb{N}_0 \times \mathbb{N}_0$ via a bivariate Dixon-Coles goal expectation framework:

$$P(H = h, A = a) = \tau_{\rho}(h, a, \lambda, \mu) \cdot \frac{\lambda^h e^{-\lambda}}{h!} \cdot \frac{\mu^a e^{-\mu}}{a!}$$

where $\tau_{\rho}$ adjusts for low-scoring correlation $(0,0), (1,0), (0,1), (1,1)$ parameterized by fitted correlation coefficient $\rho \in [-0.15, 0.00]$.

For any threshold line $L \in \{0.5, 1.5, 2.0, 2.25, 2.5, 2.75, 3.0, 3.5, 4.5\}$, the total goals variable is defined as $G = H + A$.

#### A. Whole & Half Lines ($L \in \{0.5, 1.5, 2.5, 3.5, \dots\}$)
$$P(\text{Over } L) = \sum_{h=0}^{M} \sum_{a=0}^{M} \mathbb{I}(h + a > L) \cdot P(H = h, A = a)$$
$$P(\text{Under } L) = 1.0 - P(\text{Over } L)$$

#### B. Integer Lines ($L \in \{2.0, 3.0, 4.0\}$)
$$P(\text{Over } L) = \sum_{h+a > L} P(H = h, A = a)$$
$$P(\text{Push } L) = \sum_{h+a = L} P(H = h, A = a)$$
$$P(\text{Under } L) = \sum_{h+a < L} P(H = h, A = a)$$

#### C. Quarter Lines ($L \in \{2.25, 2.75, 3.25\}$)
Quarter lines decompose into an equal split between the adjacent lower half/integer line $L_1 = L - 0.25$ and upper half/integer line $L_2 = L + 0.25$:
$$P_{\text{eff}}(\text{Over } L) = \frac{1}{2} \left[ P(\text{Win } L_1) + P(\text{Win } L_2) \right]$$

---

## 3. Base-Rate Frequency vs. Economic Edge (Constitutional Constraint)

### 3.1 Base-Rate Analysis is Exploratory Only
Juragan noted an exploratory concept: observing whether Over or Under is more frequent across recent seasons (e.g. 54% Over in recent seasons) as a potential betting signal.

**Formal Specification Rule:**
1. **Raw Historical Frequency $\neq$ Edge:** A historical base-rate of 54% Over does NOT constitute a positive EV edge. Bookmakers adjust market odds to balance action and account for league scoring trends; if the market odds for Over are priced at $1.80$ (implied probability $55.5\%$), betting Over on a $54.0\%$ base rate yields **negative expected value** ($\text{EV} = 0.54 \times 1.80 - 1 = -2.8\%$).
2. **True Signal Criterion:** An edge exists ONLY when the model's independently estimated probability $P_{\text{model}}$ statistically diverges from the de-vigged sharp closing market probability $P_{\text{market}}^{\text{devig}}$:
   $$\text{Edge} = P_{\text{model}}(\text{Over}) - P_{\text{market}}^{\text{devig}}(\text{Over})$$
   $$\text{EV} = P_{\text{model}}(\text{Over}) \times \text{Odds}_{\text{taken}} - 1.0$$
3. Two-season frequency observations are classified strictly as **exploratory hypotheses**, which must undergo formal pre-registration and False Discovery Rate (FDR) correction before being claimed as actionable.

---

## 4. Line Handling & Stage 2 Data Constraints

Following the EPIC 62 Stage 2 data audit, the following operational ceilings are locked in this specification:

| Line Category | Exact Historical Odds Rows in Gold | Evaluation Capabilities | Gating Status |
|---|---|---|---|
| **Line 2.5** | **23,875 rows** (100% of OU odds) | Full Probability Calibration (Brier, LogLoss, ECE) + Economic Backtest (CLV, EV, ROI, Hit Rate) | **`EVALUATED`** |
| **Quarter Lines (2.25, 2.75, 3.25)** | **0 rows** (0.0%) | Mathematical Distribution Output Only. Zero historical economic validation. | **`NO_HISTORICAL_EVIDENCE`** |
| **Alternative Half/Whole Lines (1.5, 3.5, 2.0, 3.0)** | **0 rows** (0.0%) | Mathematical Distribution Output Only. Zero historical economic validation. | **`NO_HISTORICAL_EVIDENCE`** |

### Code-Enforced Ceilings
Any prediction query targeting a non-2.5 OU line MUST return:
```json
{
  "line": 2.25,
  "evidenceStatus": "NO_HISTORICAL_EVIDENCE",
  "economicMetrics": {
    "status": "NO_HISTORICAL_EVIDENCE",
    "ev": null,
    "clv": null,
    "roi": null,
    "kellyStake": null,
    "reason": "Historical OU odds coverage is 2.5-only (N=0 for line 2.25)"
  }
}
```

---

## 5. Walk-Forward Calibration & Validation Protocol

Calibration must be conducted on strictly **chronological walk-forward folds** (no k-fold random splits):

- **Fold 1:** Train on Seasons $Y_1, Y_2$ $\to$ Out-of-Sample (OOS) Test on Season $Y_3$
- **Fold 2:** Train on Seasons $Y_2, Y_3$ $\to$ Out-of-Sample (OOS) Test on Season $Y_4$
- **Fold 3:** Train on Seasons $Y_3, Y_4$ $\to$ Out-of-Sample (OOS) Test on Season $Y_5$

### Calibration Algorithms
- **Platt Scaling (Sigmoid):** $P_{\text{cal}}(y=1 | s) = \frac{1}{1 + \exp(A s + B)}$
- **Isotonic Regression:** Non-parametric monotonic binning
- **Primary Quality Metric:** Multi-fold Out-of-Sample Brier Score:
  $$\text{Brier}_{\text{OU}} = \frac{1}{N} \sum_{i=1}^N (P_{\text{model}}(\text{Over})_i - y_i)^2, \quad y_i \in \{0, 1\}$$

---

## 6. Pre-Registered Hypotheses for Benjamini-Hochberg (FDR) Testing

To prevent p-hacking and data snooping during future backtests, the following $M = 6$ hypotheses are **pre-registered**:

| Hypothesis ID | Target Market / Scope | Null Hypothesis ($H_0$) | Test Statistic & Acceptance Threshold |
|---|---|---|---|
| **`H0-OU-1`** | EPL Line 2.5 | Mean CLV against Pinnacle closing $\le 0.0\%$ | One-tailed Z-test, $p < \alpha_{\text{FDR}}$, $N \ge 1,000$ |
| **`H0-OU-2`** | Top 5 European Leagues Line 2.5 | Overall OOS Brier Score $\ge 0.2450$ (Naive Climatology benchmark) | Permutation test (10,000 iterations), $p < \alpha_{\text{FDR}}$ |
| **`H0-OU-3`** | High-Scoring Regime Filter ($\lambda_H + \lambda_A > 3.10$) | Realized ROI on Over 2.5 $\le 0.0\%$ | Bootstrap 95% CI lower bound $> 0.0\%$ |
| **`H0-OU-4`** | Low-Scoring Defensive Regime ($\lambda_H + \lambda_A < 2.20$) | Realized ROI on Under 2.5 $\le 0.0\%$ | Bootstrap 95% CI lower bound $> 0.0\%$ |
| **`H0-OU-5`** | Base-rate Trend Bias (Recent 2-season frequency divergence) | Edge against de-vigged market odds $\le 0.0\%$ | Paired t-test vs. sharp price, $p < \alpha_{\text{FDR}}$ |
| **`H0-OU-6`** | Cross-League Calibration Stability | ECE (Expected Calibration Error) $> 0.035$ across all 5 leagues | Bin-wise ECE metric across 10 deciles |

### Benjamini-Hochberg Multiple-Testing Control Protocol
When evaluating the $M = 6$ hypotheses:
1. Sort individual p-values in ascending order: $p_{(1)} \le p_{(2)} \le \dots \le p_{(M)}$.
2. Find largest index $k$ such that $p_{(k)} \le \frac{k}{M} \cdot Q$, with false discovery rate $Q = 0.05$.
3. Reject $H_0$ only for all $i = 1, \dots, k$. Any hypothesis with $p_{(i)} > \frac{i}{M} \cdot Q$ is classified as **NOT STATISTICALLY SIGNIFICANT (NOISE)**.
