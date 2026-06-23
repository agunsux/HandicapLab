# Sprint 5: Model Upgrade & Advanced Feature Engineering

The focus of Sprint 5 is to improve our prediction edge by upgrading the model from the baseline Poisson distribution to a multi-variable features model. We prioritize predictive validation (closed-loop feedback) over adding vanity UI.

---

## 🎯 Objectives
1. **Move beyond the simple Poisson baseline**: Integrate structured features to capture team form, resting conditions, home bias, and historical patterns.
2. **Ablation Testing**: Establish a rigorous framework to ensure we only include features that prove to increase accuracy or ROI while reducing Brier score.
3. **Calibrated Outputs**: Keep model probabilities aligned with actual historical hit rates (e.g., if we predict 60% probability, the outcome should hit 60% of the time).

---

## 🛠️ Planned Features

### 1. `team_form`
- Currently: Simple moving average of goals scored/conceded.
- Upgrade: Weight results by opponent strength (e.g., scoring 2 goals against a top-tier defensive team ranks higher than against a bottom-tier team) and recency decay.

### 2. `home_advantage`
- Currently: Fixed global home expectation boost.
- Upgrade: Team-specific home advantage coefficients (some teams rely heavily on home support, others maintain identical home/away records).

### 3. `recent_goal_pattern`
- Captures volatility in scoring (e.g., high scoring variance vs. consistent 1-0 scorers). Helps adjust Poisson assumptions which model goal events as strictly independent.

### 4. `rest_days`
- Quantifies fatigue by measuring days since the last competitive fixture (especially relevant during European fixtures/midweek rounds).

### 5. `league_strength`
- Standardizes ratings across different competitions or cup matches (e.g., translating Champions League strength vs. domestic league strength).

### 6. `market_probability`
- Incorporates implied probability from opening market odds as a feature anchor, using the wisdom of the crowd to establish a baseline.

---

## 📊 Feature Ablation Framework
For every proposed feature $F$, we run a backtest comparing:
$$\text{Baseline Model} \quad \text{vs} \quad \text{Baseline Model} + F$$

We analyze the following performance metrics:
- **Accuracy**: Primary hit rate on 1X2, Asian Handicap, and Over/Under.
- **ROI / Yield**: Net unit yield assuming 1 unit bet on positive expected value ($EV > 0$) selections.
- **Brier Score**: Measure of probability calibration error:
  $$BS = \frac{1}{N} \sum_{t=1}^{N} (f_t - o_t)^2$$
- **Reliability Diagrams**: Binning probabilities to verify calibration curves.

A feature is merged into production **only** if it demonstrates a statistically significant improvement in Brier score and yield.
