# PORTFOLIO INTELLIGENCE & KELLY RISK SPECIFICATION

**Subsystem:** `src/lib/quant-market/portfolio-risk-engine.ts`

---

## Formulations

### 1. Quarter-Kelly Staking Formula
$$f^* = \frac{p \cdot b - (1 - p)}{b}$$
$$\text{Quarter-Kelly Stake \%} = \frac{\max(0, f^*)}{4}$$

Where:
- $p$ = Model Probability
- $b$ = Decimal Odds - 1

---

## Risk Controls
1. **Daily Risk Budget**: Maximum 5.0% of total bankroll at risk per day.
2. **Maximum Single-League Exposure**: Maximum 3.5% of bankroll exposed to any single league.
