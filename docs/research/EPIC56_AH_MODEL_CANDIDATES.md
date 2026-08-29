# EPIC 56 — ASIAN HANDICAP MODEL CANDIDATES

**Execution Timestamp:** 2026-08-29T11:21:09.003Z  

---

## 1. Candidate Architectures

### Candidate A: `AH-poisson-v1` (Independent Poisson)
- Bivariate Goal Matrix: $M[h][a] = \frac{\lambda_h^h e^{-\lambda_h}}{h!} \times \frac{\lambda_a^a e^{-\lambda_a}}{a!}$
- Truncation normalization across $[0, 8] \times [0, 8]$.

### Candidate B: `AH-dixoncoles-v1` (Dixon-Coles with Dynamic MLE $\rho$)
- Low-scoring dependence adjustment:
  $$\tau(0,0) = 1 - \lambda_h \lambda_a \rho, \quad \tau(1,0) = 1 + \lambda_a \rho, \quad \tau(0,1) = 1 + \lambda_h \rho, \quad \tau(1,1) = 1 - \rho$$
- Parameter $\rho$ dynamically fitted via Maximum Likelihood Estimation on the training set of each fold (no hardcoding).

---

## 2. Goal Difference Distribution Engine

The primary model output is the discrete probability distribution of Goal Difference:
$$P(GD = k) = \sum_{h - a = k} M[h][a] \quad \text{for } k \in [-8, +8]$$
