# EPIC 58 — PIVOT DECISION FRAMEWORK & CONTINGENT RESEARCH TRACKS

**Status:** `PREPARED IN ADVANCE — CONTINGENT, NOT YET ACTIVE`  
**Trigger Condition to Open:**
- Recent-2-season protocol verdict = `NO_RECENT_EDGE_DEMONSTRATED`
- OR Recent-2-season protocol verdict = `RECENT_EDGE_PROMISING_BUT_UNPROVEN` and follow-up confirmatory season fails to confirm.

*(If recent-2-season verdict = `RECENT_EDGE_VALIDATED`, this EPIC does NOT open. Proceed instead to scaling/hardening the validated AH model.)*

---

## 1. Why This Document Exists Before the Result Is Known

Pre-registering the pivot priority order prevents two classical failure modes:
1. **Panic-pivoting / P-hacking across pivots**: Rapidly cycling through many small tweaks until one happens to look positive by random chance.
2. **Sunk-cost paralysis**: Endlessly retrying the same ultra-liquid European markets against Pinnacle when the market may simply be structurally efficient.

---

## 2. Fixed Pivot Priority Order

### Track 1 (Highest Priority): League/Market Breadth, Not Model Complexity
- **Structural Rationale**: The top 5 European leagues (EPL, La Liga, Bundesliga, Serie A, Ligue 1) are the most heavily bet, most efficiently priced markets in the world, referenced against Pinnacle (the sharpest bookmaker). Structural market microstructure suggests retail-accessible edge is significantly more plausible in:
  - **Second-tier European leagues**: Championship (ENG-CHAMP), Serie B (ITA-SERIEB), 2. Bundesliga (DEU-2BUNDESLIGA), Ligue 2 (FRA-LIGUE2), Segunda Division (ESP-SEGUNDA).
  - **Mid-tier European leagues**: Eredivisie, Primeira Liga, Belgian Pro League, Scottish Premiership, Nordic leagues (Eliteserien, Allsvenskan).
  - **Asian domestic leagues**: J1 League, K League 1, A-League (where genuine historical odds data exists).
- **Hypothesis**: "Second-tier and mid-tier leagues show non-zero CLV and positive returns where top-5 leagues showed efficiency."
- **Methodology**: Apply identical `AH-dixoncoles-v1` architecture, walk-forward discipline, fixture-level deduplication, calibration-first tournament, and multiple-testing corrections.

### Track 2: Market Choice — Over/Under (OU), Not BTTS First
- **Structural Rationale**: Total-goals distribution is a direct target for Poisson/Dixon-Coles bivariate goal matrices. Quarter-line decomposed OU modeling allows granular settlement exploitation.
- **Hypothesis**: "OU total-goals distribution, calibrated independently of AH, shows CLV distinguishable from zero."

### Track 3: Feature Enrichment (Lowest Priority, Isolated Ablations Only)
- **Structural Rationale**: Adding injuries, lineups, weather, or rivalry introduces high researcher degrees of freedom and data reliability noise. Only evaluated as isolated ablations after Tracks 1 and 2 are exhausted.

### Track 4 (Last Resort): Product Thesis Reconsideration
- **Structural Rationale**: If Tracks 1, 2, and 3 all fail to demonstrate edge, the fundamental product thesis must be evaluated directly with Juragan (e.g., pure analytics/educational terminal without betting EV claims, or narrower non-football niche markets).

---

## 3. Standing Execution Rules

1. **Sequential Order**: Track 1 must complete and report before Track 2 can open.
2. **No Cherry-Picking**: Full leaderboards reported for every tested league/market.
3. **Evidence Standard**: Requires bootstrap CI lower bound $> 0$ and FDR-adjusted significance for any green claim.
4. **Production Gating**: `MONETIZATION_ENABLED` remains false; public value-bet display remains blocked.
