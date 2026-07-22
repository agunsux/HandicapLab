# ROLLING METRICS SPECIFICATION MANUAL

**Subsystem:** `src/live-validation/metrics/rolling-metrics.ts`

---

## Metric Mathematical Specifications

### 1. Return on Investment (ROI)
$$\text{ROI} = \frac{\sum \text{Profit}}{\sum \text{Stake}}$$

### 2. Closing Line Value (CLV)
$$\text{CLV} = \frac{\text{Odds Taken}}{\text{Closing Odds}} - 1$$

### 3. Brier Score
$$\text{Brier} = \frac{1}{N} \sum_{i=1}^N \sum_{j=1}^K (p_{ij} - y_{ij})^2$$

### 4. Sharpe Ratio (Validation Yield)
$$\text{Sharpe} = \frac{\mu_{\text{returns}}}{\sigma_{\text{returns}}} \times \sqrt{N}$$

### 5. Maximum Drawdown
$$\text{Drawdown}_t = \frac{\text{Peak}_t - \text{Equity}_t}{\text{Peak}_t}$$
$$\text{MaxDrawdown} = \max_t (\text{Drawdown}_t)$$

### 6. Kelly Efficiency Metric
$$\text{Kelly Stake} = \frac{p \cdot b - (1 - p)}{b}$$
$$\text{Kelly Efficiency} = \frac{\text{Actual ROI}}{\text{Expected Kelly Growth Rate}}$$
