# 95% CONFIDENCE INTERVAL ENGINE SPECIFICATION

**Subsystem:** `src/lib/scientific-validation/confidence-interval-engine.ts`

---

## Formulations

### 1. Wilson Score 95% Interval
$$\tilde{p} = \frac{p + \frac{z^2}{2n}}{1 + \frac{z^2}{n}}$$
$$\text{Margin} = \frac{z}{1 + \frac{z^2}{n}} \sqrt{\frac{p(1-p)}{n} + \frac{z^2}{4n^2}}$$
$$\text{CI}_{95\%} = \tilde{p} \pm \text{Margin}$$

Where $z = 1.96$ for a 95% confidence level.

---

## Policy Constraint

> **Naked probabilities are strictly prohibited.** Every model probability output must present its 95% confidence interval (e.g. `64.0% (60.0% - 68.0%)` or `64% ± 4.0%`).
