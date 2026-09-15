# Asian Handicap Model Specification — Model A (Hierarchical Dixon-Coles Baseline)

**Document Version**: 1.0.0  
**Research Gate**: Gate 2 — Model A Baseline  
**Dataset Reference**: Golden Europe Dataset (`canonical_matches.jsonl`, `market_odds.jsonl`)  
**Combined Dataset Hash**: `22e8e80a8d9c53aa878972bc42603d9b231fed709357c9d05cf8defc1ac1d727`  

### Research Status
```text
Model A:
VALIDATED AS A REPRODUCIBLE BASELINE

NOT VALIDATED AS A POSITIVE-EDGE STRATEGY

OOS ROI:
-1.60%

Monthly yield:
NOT YET EVALUATED

CLV:
NOT PRIMARY VALIDATION

Positive edge:
NOT ESTABLISHED
```


---

## 1. Executive Summary & Research Positioning

Model A is HandicapLab's foundational **football-only quantitative baseline** for the Asian Handicap (AH) research engine. 

### Core Principles
1. **Football-Only**: The model operates strictly on historical match results, team identities, and league context available prior to kickoff. No betting market odds, opening odds, or closing lines are used as predictive features.
2. **Deterministic Baseline**: The objective is not to maximize historical backtest ROI, but to establish a statistically rigorous, reproducible, leakage-free baseline against which subsequent market-aware (Model B, Model C) architectures can be benchmarked.
3. **Multi-League Hierarchy**: Recognizes that top European leagues have distinct goal-scoring environments and home-advantage dynamics.
4. **Analytical Rigor**: Employs an exact bivariate score probability matrix, Dixon-Coles low-score dependence correction, and canonical Asian Handicap settlement distributions for quarter, half, and full lines.

---

## 2. Mathematical Specification

### 2.1 Hierarchical Goal Expectation
For match $m$ on kickoff date $T_m$ between home team $i$ and away team $j$ in league $L \in \{\text{ENG-PL}, \text{ESP-LALIGA}, \text{DEU-BUNDESLIGA}, \text{ITA-SERIEA}, \text{FRA-LIGUE1}\}$:

$$\ln(\lambda_{h, m}) = \mu_L + \gamma_L + \alpha_i(T_m) + \beta_j(T_m)$$
$$\ln(\lambda_{a, m}) = \mu_L + \alpha_j(T_m) + \beta_i(T_m)$$

Where:
- $\mu_L$: League baseline log goal rate per team.
- $\gamma_L$: League-specific home advantage parameter (empirically bounded $0.02 \le \gamma_L \le 0.60$).
- $\alpha_i(T_m)$: Attack strength parameter of team $i$ at time $T_m$.
- $\beta_i(T_m)$: Defense weakness parameter of team $i$ at time $T_m$ (higher indicates higher propensity to concede).

### 2.2 Time Decay & Recency Weighting
To reflect tactical evolution, manager changes, and squad composition shifts without discarding historical sample stability, each prior match $k$ ($T_k < T_m$) is weighted exponentially by elapsed days $\Delta t_k = T_m - T_k$:

$$w_k = \exp(-\xi \cdot \Delta t_k)$$

- **Decay Parameter**: $\xi = 0.0018$ $\text{day}^{-1}$ (equivalent to a half-life of $t_{1/2} = \frac{\ln(2)}{0.0018} \approx 385$ days $\approx 1.0$ season).

### 2.3 Regularization & Identifiability Constraints
- **Identifiability**: In each league, attack and defense parameters are centered to zero:
  $$\sum_{k \in \text{Teams}_L} \alpha_k = 0 \quad \text{and} \quad \sum_{k \in \text{Teams}_L} \beta_k = 0$$
- **L2 Regularization (Shrinkage)**: To prevent small-sample distortion (e.g. newly promoted teams), an L2 shrinkage penalty ($\lambda_{reg} = 2.0$) is applied to the log-likelihood:
  $$\mathcal{L}_{pen} = \sum_{k} w_k \left[ y_{h,k}\ln(\lambda_{h,k}) - \lambda_{h,k} + y_{a,k}\ln(\lambda_{a,k}) - \lambda_{a,k} \right] - \frac{\lambda_{reg}}{2} \sum_{i} (\alpha_i^2 + \beta_i^2)$$
- **Optimization**: Solved via coordinate Newton-Raphson on the strictly concave penalized log-likelihood. Converges quadratically in $<35$ iterations ($<400$ms for all 5 leagues combined).

### 2.4 Dixon-Coles Low-Score Dependence ($\tau$)
Independent Poisson models systematically underestimate low-scoring draws (0-0, 1-1) and overestimate 1-0 or 0-1 scorelines. The Dixon-Coles (1997) adjustment factor $\tau(x, y)$ modifies probabilities for scores $x \le 1, y \le 1$:

$$\tau(x, y, \lambda_h, \lambda_a, \rho) = \begin{cases} 
1 - \lambda_h \lambda_a \rho & \text{if } x=0, y=0 \\
1 + \lambda_a \rho & \text{if } x=1, y=0 \\
1 + \lambda_h \rho & \text{if } x=0, y=1 \\
1 - \rho & \text{if } x=1, y=1 \\
1.0 & \text{otherwise}
\end{cases}$$

- **Parameter Estimation**: $\rho$ is estimated via profile Maximum Likelihood on training matches subject to $\tau(x,y) \ge 0$ (typically $\rho \in [-0.18, 0.0]$).

---

## 3. Score Distribution & Normalization

The raw bivariate score probability for $h, a \in [0, \dots, 10]$ is:

$$P_{raw}(H=h, A=a) = \tau(h, a, \lambda_h, \lambda_a, \rho) \cdot \frac{\lambda_h^h e^{-\lambda_h}}{h!} \cdot \frac{\lambda_a^a e^{-\lambda_a}}{a!}$$

Because the support is truncated at $M = 10$ goals per side (probability of $>10$ goals is $< 10^{-7}$), tail truncation is explicitly normalized:

$$S = \sum_{h=0}^{10} \sum_{a=0}^{10} P_{raw}(H=h, A=a)$$
$$P(H=h, A=a) = \frac{P_{raw}(H=h, A=a)}{S}$$

**Mathematical Invariants Verified**:
1. Non-negativity: $P(H=h, A=a) \ge 0 \quad \forall h, a$
2. Completeness: $\sum_{h=0}^{10} \sum_{a=0}^{10} P(H=h, A=a) = 1.000000 \pm 10^{-6}$.

---

## 4. Asian Handicap Probability Engine

### 4.1 Goal Difference Distribution
The marginal Goal Difference (GD) probability mass function is derived directly:

$$P(\text{GD} = d) = \sum_{h - a = d} P(H=h, A=a) \quad \text{for } d \in [-10, 10]$$

### 4.2 Settlement Probabilities Across All Lines
For any handicap line $L \in [-2.50, +2.50]$ with quarter-ball increments:
The effective margin relative to the selected side is $eff = (goals_{sel} - goals_{opp}) + L$.

For each line and side ('HOME' or 'AWAY'):
- **Full Win**: $eff \ge +0.50 \implies P(\text{WIN}) = \sum_{eff \ge 0.50} P$
- **Quarter-Ball Half Win**: $eff = +0.25 \implies P(\text{HALF\_WIN}) = \sum_{eff = 0.25} P$
- **Push / Void**: $eff = 0.00 \implies P(\text{PUSH}) = \sum_{eff = 0.0} P$
- **Quarter-Ball Half Loss**: $eff = -0.25 \implies P(\text{HALF\_LOSS}) = \sum_{eff = -0.25} P$
- **Full Loss**: $eff \le -0.50 \implies P(\text{LOSS}) = \sum_{eff \le -0.50} P$

Cover Probability: $P(\text{Cover}) = P(\text{WIN}) + 0.5 \cdot P(\text{HALF\_WIN})$.

### 4.3 Payout Symmetry Invariant
The engine enforces exact symmetry:
Home on line $L$ and Away on line $-L$ satisfy:
- $P_{home}(\text{WIN}) = P_{away}(\text{LOSS})$
- $P_{home}(\text{HALF\_WIN}) = P_{away}(\text{HALF\_LOSS})$
- $P_{home}(\text{PUSH}) = P_{away}(\text{PUSH})$
- $P_{home}(\text{HALF\_LOSS}) = P_{away}(\text{HALF\_WIN})$
- $P_{home}(\text{LOSS}) = P_{away}(\text{WIN})$

---

## 5. Fair Price & Expected Value (EV)

### 5.1 Fair Price (Zero-EV Decimal Odds)
Unlike binary markets where $\text{Odds}_{fair} = \frac{1}{P}$, quarter-ball lines split stakes. The theoretical break-even decimal odds is:

$$\text{Odds}_{fair} = 1 + \frac{0.5 \cdot P(\text{HALF\_LOSS}) + P(\text{LOSS})}{P(\text{WIN}) + 0.5 \cdot P(\text{HALF\_WIN})}$$

### 5.2 Expected Value (EV) per Unit Stake
Given market decimal odds $O_{market}$:

$$EV = P(\text{WIN})(O_{market} - 1) + P(\text{HALF\_WIN})\frac{O_{market} - 1}{2} - 0.5 \cdot P(\text{HALF\_LOSS}) - P(\text{LOSS})$$

---

## 6. Known Model A Limitations
1. **Football-Only Blindness**: Model A does not observe market odds movement, volume, or closing line consensus.
2. **Pre-match Fixed Lineups**: Does not account for sudden injuries, suspensions, or tactical resting announced 60 minutes before kickoff.
3. **Single Low-Score Parameter**: A single $\rho$ is fitted per league, rather than state-dependent bivariate copulas.

