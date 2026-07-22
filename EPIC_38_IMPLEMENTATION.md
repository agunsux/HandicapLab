# EPIC 38 — Quantitative Market Intelligence Platform Reference

**Status:** COMPLETE & VERIFIED  
**Release Tag:** `v1.38.0`  
**Subsystem:** `src/lib/quant-market/`

---

## Architecture Overview

EPIC 38 evaluates market efficiency, trajectory, composite Meta Value, and portfolio risk:

1. **Market Quality Score Engine** (`market-quality-score.ts` - 0-100 score based on overround, volatility, liquidity, consensus)
2. **EV Decay Engine** (`ev-decay-engine.ts` - EV curve, steam & RLM alerts, optimal betting window)
3. **Closing Line Intelligence Engine** (`closing-line-intelligence.ts` - predicted closing odds & CLV)
4. **League Intelligence 2.0** (`league-intelligence-v2.ts` - League Trust Score 0-100)
5. **Meta Value Score Engine** (`meta-value-score.ts` - composite 0-100 score)
6. **Portfolio Intelligence & Risk Engine** (`portfolio-risk-engine.ts` - Quarter-Kelly allocation & bet correlation matrix)

---

## Database Tables (`00000000000039_quantitative_market_intelligence.sql`)

- `market_quality_logs`
- `ev_decay_snapshots`
- `meta_value_scores`
- `portfolio_risk_states`
