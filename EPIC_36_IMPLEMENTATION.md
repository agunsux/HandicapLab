# EPIC 36 — Value Betting Intelligence Platform Reference

**Status:** COMPLETE & VERIFIED  
**Subsystem:** `src/lib/value-intelligence/`

---

## Executive Summary

HandicapLab has been transformed from a traditional winner-prediction website into a scientific **Value Betting Intelligence Platform**.

### Paradigm Principles:
1. **Winning % is NOT the objective**: Positive Expected Value (+EV) and Closing Line Value (CLV) are the objective.
2. **5-Tier Classification**: Categorizes every opportunity into `STRONG_VALUE`, `VALUE`, `WATCHLIST`, `NO_VALUE`, or `PASS`. Negative EV bets are strictly blocked.
3. **Model Fair Odds vs Bookmaker Odds**: Side-by-side display of decimal Fair Odds (`1 / modelProb`) alongside bookmaker quotes.
4. **Empirical Historical Cohort Evidence**: Shows historical ROI, hit rate, CLV, and sample size for similar past match situations.
5. **5-Question Mathematical Explainability Engine**: Formulates transparent justifications eliminating black-box outputs.

---

## Component Architecture

```
src/lib/value-intelligence/
├── fair-odds-engine.ts      # Model Fair Odds & vig-removed implied probability calculations
├── similarity-engine.ts     # Historical cohort similarity search & empirical ROI/CLV retrieval
├── league-intelligence.ts   # League market efficiency ranking
├── confidence-movement.ts  # Confidence bucket analytics & Steam/RLM trajectory tracking
├── recommendation-engine.ts # 5-Tier Value Recommendation classifier
├── explainability.ts        # 5-Question Mathematical Explainability Engine
└── index.ts                 # Unified exports
```

---

## UI Terminals & REST APIs

- **Public Value Terminal**: `/value-bets` ([`src/app/(app)/value-bets/page.tsx`](file:///c:/Users/RYZEN/.antigravity-ide/HandicapLab/src/app/%28app%29/value-bets/page.tsx))
- **Research Console**: `/research-console` ([`src/app/(app)/research-console/page.tsx`](file:///c:/Users/RYZEN/.antigravity-ide/HandicapLab/src/app/%28app%29/research-console/page.tsx))
- **REST Endpoints**:
  - `/api/value-intelligence/bets`
  - `/api/value-intelligence/fair-odds`
  - `/api/value-intelligence/similarity`
  - `/api/value-intelligence/leagues`
  - `/api/value-intelligence/research-console`
