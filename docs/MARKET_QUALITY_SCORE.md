# MARKET QUALITY SCORE SPECIFICATION (0 - 100)

**Subsystem:** `src/lib/quant-market/market-quality-score.ts`

---

## Weight Component Breakdown

$$\text{Market Quality Score} = \text{Sub}_{\text{Margin}} + \text{Sub}_{\text{Vol}} + \text{Sub}_{\text{Liq}} + \text{Sub}_{\text{Consensus}}$$

1. **Bookmaker Overround Margin Subscore** (Max 30 pts): Penalizes high overrounds.
2. **Odds Volatility Subscore** (Max 25 pts): Evaluates line stability.
3. **Liquidity / Bookmaker Availability Subscore** (Max 25 pts): Rewards depth of market quotes.
4. **Consensus Deviation Subscore** (Max 20 pts): Measures market agreement.
