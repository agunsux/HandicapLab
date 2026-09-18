# Master Research Plan: Positive-Yield Handicap Research Engine

**Document Version:** 1.0.0  
**Status:** APPROVED FOR EXECUTION  
**Location:** `docs/POSITIVE_YIELD_RESEARCH_PLAN.md`  
**Governing Role:** Senior Quantitative Engineer  

---

## 1. Primary Research Target & Market Hierarchy

The sole quantitative objective of HandicapLab is to discover whether the platform can produce a **repeatable, out-of-sample positive-yield signal** surviving Closing Line Value (CLV) evaluation across real historical betting markets.

### Market Hierarchy
$$\text{Asian Handicap (AH)} \succ \text{Over/Under (O/U)} \succ \text{Both Teams To Score (BTTS)} \succ \text{Moneyline (1X2)}$$

All markets are derived from a unified, coherent goal-distribution model wherever mathematically possible. Uncoupled ad-hoc classifiers are strictly forbidden unless research proves genuine out-of-sample value.

---

## 2. Research Invariants & Data Governance

1. **Point-in-Time Correctness**: A prediction for match $M$ at time $T$ may only use information stamped strictly before $T$ ($t < T$).
2. **Zero Lookahead Leakage**: Never use future odds, closing odds, post-match statistics, future lineups, or parameters fitted on future data.
3. **No Forced Profitability**: Never optimize thresholds on test sets, cherry-pick dates, or manipulate holdout splits. If no edge exists, report `NO EDGE`.
4. **Single Source of Truth**:
   - **OddsPapi**: Historical odds ticks (unmetered since 2026-01).
   - **API-Football**: Football-state provider (fixtures, results, standings, lineups).
   - **Pinnacle**: Ground truth reference for Closing Line Value.
5. **League Whitelist**: Evaluation is focused on Top European Leagues (Premier League, Bundesliga, La Liga, Serie A, Ligue 1).

---

## 3. Engineering Phases & Milestones

```text
Phase 1: Historical Odds Forensic Audit & Replay Engine (COMPLETE - GO)
Phase 2: Coherent Probability Engine (Dixon-Coles vs Poisson)
Phase 3: Multi-Market Exact Settlement & EV Derivation Engine
Phase 4: Pre-Registered Hypothesis Families & Walk-Forward Validation Protocol
Phase 5: Pinnacle Closing Line Value (CLV) Engine
Phase 6: Multi-League Research Execution & Results Matrix
Phase 7: Production Decision Gate Evaluation
```

---

## 4. Evidence Classification Gates

Every evaluated strategy is assigned an objective evidence class:

- **`NO EDGE`**: Expected value $\le 0$, negative CLV, or test ROI $\le 0$.
- **`INSUFFICIENT SAMPLE`**: Sample size $N < 200$ bets in the out-of-sample test window.
- **`PROVISIONAL EDGE`**: Positive CLV ($> 0$), positive out-of-sample ROI, but bootstrap 95% CI lower bound crosses 0 or $200 \le N < 500$.
- **`VALIDATED EDGE`**: $N \ge 500$ bets, bootstrap 95% CI lower bound $> 0$, statistically significant positive CLV ($p < 0.05$), Benjamini-Hochberg FDR $q \le 0.10$, and monotonically positive yield across rolling walk-forward folds.

---

## 5. Output Deliverables & Research Table

The final research synthesis will emit `docs/POSITIVE_YIELD_RESULTS.md` featuring the standard performance ledger:

| Market | Bets | ROI | Yield | CLV | Brier | Avg Odds | Drawdown | Status |
|---|---:|---:|---:|---:|---:|---:|---:|:---:|
| **AH** | — | — | — | — | — | — | — | Pending |
| **O/U** | — | — | — | — | — | — | — | Pending |
| **BTTS** | — | — | — | — | — | — | — | Pending |
| **ML** | — | — | — | — | — | — | — | Pending |

