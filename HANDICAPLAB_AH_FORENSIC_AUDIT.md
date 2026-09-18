# HANDICAPLAB — AH RESEARCH ENGINE FORENSIC AUDIT

**Author**: Principal Quantitative Sports Researcher & Forensic Auditor  
**Scope**: Asian Handicap (AH) Research Signal & Data Infrastructure  
**Date**: 2026-09-15  
**Audit Standard**: DATA → MODEL → FAIR PRICE → MARKET PRICE → EDGE → DECISION → BACKTEST → CLV → VALIDATION  

---

## 1. GIT FORENSIC STATE

```text
Branch:        main
HEAD:          83a903bf337441ed10ff1275f59284f6cadc7def
Remote:        origin -> https://github.com/agunsux/HandicapLab.git (synced / pushed)
Status:        Working tree contains unstaged Salmo AH UI/API feature files (retained untouched)
```

### Latest Relevant Commits:
* `83a903b`: feat(handicaplab): add controlled api-football egress worker (P0.3)
* `64e655c`: fix(handicaplab): harden api-football provider compliance (P0.2)
* `21bd420`: research(ah): freeze yield edge and information advantage baseline
* `0006a2b`: feat(branding): reposition HandicapLab as football data platform
* `d048c5a`: feat(handicaplab): implement canonical global league registry and intelligent ingestion engine
* `7c630cb`: feat(epic-70): production operating model overhaul & coverage layer forensic hardening
* `7d70258`: feat(epic-65): historical data foundation, candidate league probe, and AH/OU/BTTS validation suite

### Working Tree Isolation:
* **Unstaged Salmo UI/API files**: Kept completely untouched per invariant:
  * `src/app/asian-handicap/page.tsx`
  * `src/app/api/ah/*`
  * `src/components/ah/*`
  * `src/lib/decision/ahDecisionEngine.ts`
  * `src/lib/services/ahHistoryService.ts`
  * `src/lib/services/ahUpcomingService.ts`
  * `tests/salmo-ah/*`

---

## 2. REPOSITORY ARCHITECTURE CLASSIFICATION

| Component Area | Files / Location | Classification | Evidence & Operational Reality |
| :--- | :--- | :--- | :--- |
| **1. Data Ingestion Pipeline** | `src/lib/ingestion/`, `src/lib/providers/orchestrator.ts`, `src/app/api/cron/` | **REAL (Live) / FROZEN (Historical)** | Crons exist for live discovery/enrichment; historical ingestion runs via deterministic offline loaders (`src/lib/research/loader.ts`). |
| **2. Provider Manager** | `src/lib/providers/providerGateway.ts`, `src/lib/providers/providerKey.ts` | **REAL** | Canonical gateway enforcing rate-limits, circuit-breaker, and deduplication. Single API-Football key. |
| **3. Quota Manager** | `src/lib/providers/quotaManagerV4.ts` | **REAL** | Authoritative quota reservation/confirm/rollback mechanism with plan configuration. |
| **4. Match Registry** | `data/golden/europe/canonical_matches.jsonl` | **REAL** | 8,898 matches with verified final scores, canonical IDs, and kickoff dates across 5 leagues. |
| **5. Historical Data Layer** | `data/golden/europe/`, `research/quant/data/bronze/` | **REAL** | Golden manifest and JSONL dataset with checksums, source file paths, and row mappings from football-data.co.uk. |
| **6. Odds Layer (AH)** | `data/golden/europe/market_odds.jsonl` | **REAL (Opening) / PARTIAL (Closing)** | 23,864 AH observations from Pinnacle, Bet365, BetBrain. 17,785 opening odds, 6,079 closing odds (~25.5% closing). |
| **7. Feature Engineering** | `src/lib/research/ratings.ts`, `src/lib/research/ah-edge/edgeFeatures.ts` | **REAL** | Point-in-time Elo ratings and time-decayed goal parameters. No future leakage detected. |
| **8. Prediction Engine** | `src/lib/research/premierLeagueAhEngine.ts`, `services/probability.engine.ts` | **REAL (Statistical Baseline)** | Bivariate Poisson / Dixon-Coles model generating full bivariate score distribution matrix $P(H=h, A=a)$. |
| **9. Backtesting** | `src/lib/research/ah-solo/ahTournamentRunner.ts`, `premierLeagueAhEngine.ts` | **REAL** | Expanding-window temporal walk-forward backtests. No random train/test splits. |
| **10. Calibration** | `src/lib/calibration/`, `src/lib/settlement/brier-calculator.ts` | **REAL** | Brier score calculation, Log Loss, Platt scaling, and temperature scaling utilities. |
| **11. CLV Computation** | `src/lib/settlement/clv-calculator.ts` | **REAL** | Expectation-based line/price CLV for Asian Handicap; constrained by available closing odds. |
| **12. Research UI** | `src/app/research/`, `src/app/research-console/` | **ARCHITECTURAL ONLY / PARTIALLY REAL** | Research console routes exist; standalone offline reports in markdown/JSON are currently authoritative. |

---

## 3. AH DATA FORENSIC AUDIT

### A. Match Data Inventory (`canonical_matches.jsonl`)
* **Total Matches**: **8,898**
* **Time Range**: 2015-08-08 to 2026-05-24 (11 seasons: 2015/16 through 2025/26)
* **Results Verified**: 100% (all rows have `homeGoals`, `awayGoals`, `result` $\in \{'H','D','A'\}$)
* **League Breakdown**:
  * `ENG-PL` (Premier League): **4,180 matches**
  * `ESP-LALIGA` (La Liga): **1,520 matches**
  * `FRA-LIGUE1` (Ligue 1): **1,140 matches**
  * `ITA-SERIEA` (Serie A): **1,140 matches**
  * `DEU-BUNDESLIGA` (Bundesliga): **918 matches**

### B. Asian Handicap Odds Coverage (`market_odds.jsonl`)
* **Total Odds Observations**: **77,471**
  * Moneyline (ML): 29,732
  * Over/Under (OU): 23,875
  * Asian Handicap (AH): **23,864**
* **AH Observation Types**:
  * Opening odds: **17,785** (74.5%)
  * Closing odds: **6,079** (25.5%)
* **AH Bookmaker Distribution**:
  * `pinnacle`: **11,937** (50.0%) — Ground Truth
  * `bet365`: **6,069** (25.4%)
  * `betbrain`: **5,858** (24.6%)
* **AH Lines Present**:
  * 0.00 (Draw No Bet / Level ball)
  * $\pm 0.25, \pm 0.50, \pm 0.75$ (Quarter and Half balls)
  * $\pm 1.00, \pm 1.25, \pm 1.50, \pm 1.75, \pm 2.00, \pm 2.25, \pm 2.50$
* **Closing Odds Finding**:
  * Closing AH odds exist for 6,079 observations.
  * **Rule Enforced**: Closing odds are strictly preserved as `null` when unavailable. No synthetic estimation or interpolation of closing odds is permitted.

---

## 4. API-FOOTBALL PROVIDER AUDIT

* **Provider Status**: `ACTIVE` (Legitimate single account on Pro plan $19/mo).
* **Execution Mode**: `serverless` (default in Vercel); dedicated Fly.io egress worker code committed in P0.3 but not yet deployed.
* **Key Handling**: Handled via `APIFOOTBALL_KEY` server-side only. Zero client exposure.
* **Historical Endpoint**: API-Football is used for live fixture synchronization and current data; historical research dataset is sourced independently from football-data.co.uk bronze archives to ensure zero API quota burn and 100% deterministic reproducibility.
* **Data Provenance**: Live fixtures are tagged with provider provenance; historical records are tagged with bronze archive source and line numbers.

---

## 5. ODDSPAPI PROVIDER AUDIT

* **Provider Status**: `PARTIALLY REAL` (Active for live odds queries).
* **Historical AH Reconstruction Capability**: **NO**.
  * OddsPAPI does not support historical Asian Handicap tick-level or opening/closing reconstruction for past seasons.
  * Attempting to backtest historical seasons using OddsPAPI alone would yield `INSUFFICIENT_DATA`.
* **Ground Truth for Historical AH**: Handled via Pinnacle historical lines preserved in the golden dataset.

---

## 6. SETTLEMENT ENGINE FORENSIC STATUS

* **Implementation**: [ahSettlementEngine.ts](file:///c:/Users/RYZEN/.antigravity-ide/HandicapLab/src/lib/research/ahSettlementEngine.ts)
* **Lines Supported**: Arbitrary quarter-ball lines ($0, \pm 0.25, \pm 0.50, \pm 0.75, \pm 1.00, \dots$).
* **Outcomes Supported**:
  * `WIN`: Full stake profit $= \text{stake} \times (\text{odds} - 1)$
  * `HALF_WIN`: Half stake profit $= (\text{stake} / 2) \times (\text{odds} - 1)$
  * `PUSH`: Stake returned, profit $= 0$
  * `HALF_LOSS`: Half stake loss, profit $= -(\text{stake} / 2)$
  * `LOSS`: Full stake loss, profit $= -\text{stake}$
* **Expected Value Math**:
  $$\text{EV} = P(\text{Win}) \cdot (\text{odds} - 1) + P(\text{HalfWin}) \cdot \frac{\text{odds} - 1}{2} + P(\text{HalfLoss}) \cdot (-0.5) + P(\text{Loss}) \cdot (-1.0)$$
  * Quarter-line EV correctly splits outcomes across the 5 possible payoffs rather than assuming binary $P \cdot \text{odds} - 1$.
* **Fair Odds Math**:
  $$\text{Fair Odds} = 1 + \frac{0.5 \cdot P(\text{HalfLoss}) + P(\text{Loss})}{P(\text{Win}) + 0.5 \cdot P(\text{HalfWin})}$$

---

## 7. EXISTING BASELINE MODEL AUDIT

* **Engine**: [premierLeagueAhEngine.ts](file:///c:/Users/RYZEN/.antigravity-ide/HandicapLab/src/lib/research/premierLeagueAhEngine.ts)
* **Model Type**: Dixon-Coles bivariate Poisson with parameter decay ($0.95$) and correlation adjustment $\rho = -0.05$ on low scores.
* **Temporal Discipline**:
  * Predictions generated strictly point-in-time ($t_{\text{pred}} < t_{\text{kickoff}}$).
  * Team statistics updated only after full-time results are verified.
* **Current Baseline Verdict on Unfiltered Home AH 0**:
  * **Status**: **LOSS** ($-4.37\%$ ROI, $-1.22\%$ CLV across 760 matches in 2024/25 + 2025/26).
  * **Significance**: Confirms the integrity of the research framework. No fake winning results were fabricated.
  * **Out-of-Sample Holdout Survival**: 2 of 7 candidate rules survived OOS (Away +0.50 and Home +0.25), while 4 rules failed due to data-mining decay and 1 suffered regime shift.

---

## 8. GAPS & MANDATE FOR PHASE 1 EXECUTION

1. **Multi-League Expansion**: Transition from EPL-only to Hierarchical (Global Model + League Parameters + Team Strength) across all 5 leagues (8,898 matches).
2. **Four-Model Incremental Benchmark**:
   * Model A: Football-only
   * Model B: Market-only
   * Model C: Football + Market
   * Model D: ML Challenger (LightGBM/GBDT)
3. **Closing Odds Policy**: Strictly preserve available closing odds (~25.5%); mark missing as `null`. CLV is diagnostic, not institutional proof.
4. **Hurdle Policy**: $+0.5\%$ monthly yield treated strictly as an **acceptance hurdle**, never an optimization objective.
5. **New Deliverable**: `AH EDGE MAP` decomposing performance across League, Line, Odds Band, Favorite/Underdog, Sample Size, CI, and Consistency.

