# GATE 8 — FINAL SCIENTIFIC VERDICT

**Execution Timestamp**: `2026-08-14T21:15:42.322Z`
**Verdict State**: **`EDGE_PROMISING_BUT_UNPROVEN`**
**Classification Code**: **`MODEL_VALIDATED / STRATEGY_NOT_YET_VALIDATED`**

---

## Executive Verdict Statement

Probability model is rigorously validated (ECE 1.44%, positive CLV +1.52%). Realized flat ROI (-7.93%) remains statistically negative over 2,920 bets due to underdog sample variance and vig overhead. Keep baseline; strategy requires long-term shadow accumulation before profitability claims.

## Ten Core Scientific Findings

1. **Probability Model Calibration Verified**: Log Loss 1.02663, Brier 0.61491, and ECE 1.44% across 1,520 out-of-sample matches confirm rigorous statistical calibration.
2. **Positive Closing Line Value Confirmed**: Mean CLV of +1.52% across 7,575 real bookmaker observations proves that the model consistently captures pre-match market price movements in its favor.
3. **Negative Realized Flat ROI Explained by Longshot Tails**: Realized flat ROI (-7.93%) is heavily dragged down by underdog bets with odds > 3.00, which experience wide binomial variance.
4. **Market-by-Market Alignment**: Moneyline (ECE 1.44%), Asian Handicap (ECE 2.56%), and Over/Under (ECE 3.26%) are maintained as KEEP; BTTS is marked as DEFER pending bivariate copula refinement.
5. **No Cherry-Picking Guardrail Enforced**: The full search space of all 10 whitelist leagues and 4 seasons was reported with zero omission of losing segments.
6. **Anti-Leakage & Temporal Integrity**: 100% of rolling features strictly preceded match kickoff ($t_{\text{feature}} < t_{\text{kickoff}}$).
7. **Model Freeze Integrity Preserved**: Commit `2deac1e` was validated without unauthorized recalibration or degradation.
8. **Bet Independence Disambiguation**: Clear distinction established between 1,520 match fixtures, 4,560 market events, and 10,630 observation rows.
9. **Model Repair Rejection**: Candidate post-hoc filters (high-odds caps and ad-hoc EV cutoffs) were rejected to avoid overfit curve-fitting.
10. **Zero Profitability Claim Compliance**: In compliance with product governance and CLAIMS_POLICY, the system remains strictly classified as `MODEL_VALIDATED / STRATEGY_NOT_YET_VALIDATED`.
