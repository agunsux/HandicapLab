# FAIR ODDS & EXPECTED VALUE ENGINE SPECIFICATION

**Subsystem:** `src/lib/value-intelligence/fair-odds-engine.ts`

---

## Formulations

### 1. Model Fair Odds
$$\text{Model Fair Odds} = \frac{1}{\text{Model Probability}}$$

### 2. Vig-Removed Implied Probability
$$\text{Margin} = \sum \frac{1}{\text{Bookmaker Odds}_k}$$
$$\text{Implied Probability}_i = \frac{1 / \text{Bookmaker Odds}_i}{\text{Margin}}$$

### 3. Expected Value (EV)
$$\text{EV} = (\text{Model Probability} \times \text{Bookmaker Odds}) - 1$$

### 4. Probability Edge
$$\text{Probability Edge} = \text{Model Probability} - \text{Implied Probability}$$
