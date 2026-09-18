# Implementation Plan: Phase 3.6 Baseline Forensic Audit

Audit and forensically verify the out-of-sample baseline results before any parameter search, threshold tuning, or hypothesis optimization.

## User Review Required

> [!IMPORTANT]
> **Key Preliminary Audit Findings:**
> 1. **O/U 2.5 Poisson vs Flat Dixon-Coles Identity is a Mathematical Theorem**:
>    In Dixon-Coles (1997), the adjustment factor $\tau(x, y)$ modifies only four low-scoring states: $(0,0), (1,0), (0,1), (1,1)$. All four states have $x+y \le 2$. The sum of their probability shifts is:
>    $$\Delta P(0,0) + \Delta P(1,0) + \Delta P(0,1) + \Delta P(1,1) = (-\lambda_1 \lambda_2 + \lambda_1 \lambda_2 + \lambda_1 \lambda_2 - \lambda_1 \lambda_2) \rho e^{-\lambda_1 - \lambda_2} \equiv 0$$
>    Because Under 2.5 is exactly $T \le 2$, the $\rho$ parameter **cancels out identically**! Flat Dixon-Coles and Independent Poisson with identical attack/defense rates produce identical probabilities on Over/Under 2.5 down to machine precision. They are genuinely distinct on 1X2, individual scores, OU 0.5, and OU 1.5.
>
> 2. **AH CLV = 0.00% Root Cause Identified**:
>    In `canonical_matches.jsonl`, Pinnacle closing Asian Handicap fields are named `chLine`, `chHome`, `chAway`. The previous evaluation script checked `o.cahHome ?? o.ahHome`. Because `cahHome` was undefined, it fell back to `o.ahHome`, comparing opening odds against opening odds ($odds / odds - 1 \equiv 0.00\%$).
>    Furthermore, 309 of 759 matches (40.7%) experienced line shifts (e.g., opening at -1.0 and closing at -0.75). Comparing odds directly across different lines is invalid; we must partition by line-matched vs line-shifted bets and compute true CLV.

---

## Proposed Changes

### Research Engine Tests & Verification

#### [NEW] [`tests/research-engine/dixon-coles-mathematical-identity.test.ts`](file:///c:/Users/RYZEN/.antigravity-ide/HandicapLab/tests/research-engine/dixon-coles-mathematical-identity.test.ts)
- Unit test proving Dixon-Coles vs Poisson mathematical identity on total goals $T \le 2$ (OU 2.5).
- Unit tests proving Dixon-Coles is genuinely distinct from Poisson on:
  - 1X2 Moneyline (Home Win, Draw, Away Win probabilities differ)
  - Exact scorelines: (0,0), (1,0), (0,1), (1,1)
  - Over/Under 0.5 and Over/Under 1.5 (where the terms do not cancel to zero)
  - Asian Handicap lines (due to reweighted $(1,0)$ and $(0,1)$ differences)

---

### Audit Script & Ledger Generation

#### [NEW] [`scripts/research/run-baseline-forensic-audit.ts`](file:///c:/Users/RYZEN/.antigravity-ide/HandicapLab/scripts/research/run-baseline-forensic-audit.ts)
Will implement the 12 non-negotiable directives:
1. **Audit Bet Selection**: Generate `data/verification/BASELINE_FORENSIC_LEDGER.jsonl` with all 17 auditable fields:
   - `match_id`, `kickoff`, `prediction_timestamp`, `model_version`, `market`, `selection`, `line`, `odds_at_prediction`, `closing_odds`, `result`, `settlement`, `profit`, `model_probability`, `fair_odds`, `implied_probability`, `edge`, `ev`.
2. **Audit O/U 2.5**: Formally document the proof and verify numerical identicality.
3. **Audit AH CLV**: Fix the field name lookup (`chHome`/`chAway`/`chLine` alongside `cah`), separate line-matched bets from line-shifted bets, and compute line-matched CLV.
4. **Audit Closing Price**: Document and verify the pre-kickoff cutoff rule ($t < T_{\text{kickoff}}$).
5. **Audit Odds Look-Ahead**: Verify temporal provenance for horizons $T-7\text{d}$ to $T-15\text{m}$.
6. **Audit Training Window**: Verify zero future leakage ($t_{\text{train}} < T_{\text{prediction}}$).
7. **Audit Sample Construction**: Explain exact bet count differences (634 vs 635 vs 607 for AH; 621 vs 581 for OU).
8. **Audit Moneyline**: Quantify the unconstrained longshot distribution (average odds ~4.3) and drawdown dynamics.
9. **Recompute All Metrics**: Recompute ROI, yield, hit rate, average odds, profit, max drawdown, Brier, log-loss, ECE, CLV directly from the raw JSONL ledger.
10. **Bootstrap Confidence Intervals**: Compute 95% empirical bootstrap confidence intervals (1,000 resamples) for ROI, CLV, and win rates.
11. **Time-Block Stability**: Decompose the 760-match test period into 3 chronological blocks:
    - Block 1: 2024 Autumn (2024-08 to 2024-12)
    - Block 2: 2025 Full Calendar (2025-01 to 2025-12)
    - Block 3: 2026 YTD (2026-01 to 2026-05)
    Report ROI and CLV for each block.
12. **Freeze Phase 4**: Zero threshold or hyperparameter optimization.

---

### Verification Artifacts & Documentation

#### [NEW] [`data/verification/BASELINE_FORENSIC_LEDGER.jsonl`](file:///c:/Users/RYZEN/.antigravity-ide/HandicapLab/data/verification/BASELINE_FORENSIC_LEDGER.jsonl)
- Complete auditable prediction and settlement ledger containing every single bet across all models and markets.

#### [NEW] [`docs/BASELINE_FORENSIC_AUDIT.md`](file:///c:/Users/RYZEN/.antigravity-ide/HandicapLab/docs/BASELINE_FORENSIC_AUDIT.md)
- Complete, formal forensic audit report with classification of each model/market:
  - Data Integrity: `DATA VALIDATED` vs `DATA ISSUE FOUND`
  - Market Evidence: `NO EDGE`, `PROMISING`, `PROVISIONAL EDGE`, or `VALIDATED EDGE`

---

## Verification Plan

### Automated Tests
- Run new mathematical identity unit tests:
  ```bash
  npx vitest run tests/research-engine/dixon-coles-mathematical-identity.test.ts
  ```
- Run full research test suite (all 12 test suites):
  ```bash
  npx vitest run tests/research-engine/
  ```

### Audit Execution
- Run forensic audit script:
  ```bash
  npx tsx scripts/research/run-baseline-forensic-audit.ts
  ```
- Verify `data/verification/BASELINE_FORENSIC_LEDGER.jsonl` has valid JSONL on every line with all 17 fields.
- Verify bootstrap CI and chronological block stability calculations.
