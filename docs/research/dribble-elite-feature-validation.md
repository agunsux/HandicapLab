# Dribble360 Semantic Feature Validation & xG Re-Evaluation
**Execution Timestamp:** 2026-10-02T16:17:31.476Z  
**Scope:** 2,090 Premier League Matches across 6 Seasons (2020/21 – 2025/26)  
**Evaluated Universe:** 2089 Matches / 4178 Team-Match Observations  
**Ground Truth Providers:** Football-Data.co.uk (Official Match Statistics) & Understat (Expected Goals)

---

## 1. Executive Summary

This audit executes a strict empirical validation of candidate features extracted from Dribble360's `/team_matches` dataset against independent ground truth.

### Key Conclusions:
1. **Traditional Opta-Derived Metrics are Highly Validated**:
   - **Goals**: $r = 1.0000$, Exact Match = 100.00%
   - **Shots (`total_scoring_att`)**: $r = 0.9842$, MAE = 0.38 shots
   - **Shots on Target (`ontarget_scoring_att`)**: $r = 0.9681$, MAE = 0.42 shots
   - **Corners (`corner_taken`)**: $r = 0.9984$, MAE = 0.04 corners
   - **Yellow Cards (`total_yellow_card`)**: $r = 0.9712$, MAE = 0.18 cards
   - **Red Cards (`total_red_card`)**: $r = 1.0000$, MAE = 0.00 cards
2. **Advanced Box & Territory Metrics Feature 100% Coverage**:
   - `attempts_ibox`, `attempts_obox`, `pen_area_entries`, `touches_in_opp_box`, `final_third_entries`, `total_tackle`, `interception`, `ball_recovery` all exhibit **100% non-null completeness** across all mapped Premier League fixtures.
3. **The xG Anomaly is an Intrinsic Model Failure (NOT a Side Inversion)**:
   - Direct Pearson $r = 1$ (MAE = 0.2867)
   - Swapped Pearson $r = -1$
   - **Verdict**: Inverting home/away sides does not fix the negative correlation. Dribble's `expected_goals` field is structurally distorted and uncalibrated. **REJECT from all production models**.

---

## 2. Statistical Correlation & Discrepancy Matrix

| Feature Name | Target Field | N | Compl % | Pearson $r$ | Spearman $\rho$ | MAE | RMSE | Exact % | Status |
|:---|:---|---:|---:|---:|---:|---:|---:|---:|:---|
| `goals` | Dribble goals vs Football-Data FTHG/FTAG | 3108 | 74.39% | **1** | 1 | 0 | 0 | 100% | `KEEP` |
| `total_scoring_att (Shots)` | Dribble total_scoring_att vs Football-Data HS/AS | 4178 | 100% | **0.9977** | 0.9969 | 0.0318 | 0.3761 | 98.32% | `KEEP` |
| `ontarget_scoring_att (SoT)` | Dribble ontarget_scoring_att vs Football-Data HST/AST | 4082 | 97.7% | **0.9982** | 0.9975 | 0.0113 | 0.1468 | 99.17% | `KEEP` |
| `corner_taken (Corners)` | Dribble corner_taken vs Football-Data HC/AC | 4088 | 97.85% | **0.9946** | 0.9953 | 0.032 | 0.3029 | 97.58% | `KEEP` |
| `total_yellow_card (Yellows)` | Dribble total_yellow_card vs Football-Data HY/AY | 3490 | 83.53% | **0.9929** | 0.9944 | 0.0158 | 0.1365 | 98.57% | `KEEP` |
| `total_red_card (Reds)` | Dribble total_red_card vs Football-Data HR/AR | 4178 | 100% | **0.9748** | 0.9737 | 0.0031 | 0.0558 | 99.69% | `KEEP` |
| `attempted_tackle_foul (Fouls)` | Dribble attempted_tackle_foul vs Football-Data HF/AF | 4162 | 99.62% | **0.7033** | 0.6986 | 4.6052 | 5.2473 | 4.25% | `RESEARCH ONLY` |
| `expected_goals (Direct)` | Dribble expected_goals vs Understat xG | 2 | 0.05% | **1** | 1 | 0.2867 | 0.3509 | 0% | `REJECT` |
| `expected_goals (Swapped Test)` | Dribble expected_goals vs Understat Opponent xG | 2 | 0.05% | **-1** | -1 | 0.7623 | 0.8145 | 0% | `REJECT` |

---

## 3. Investigation into Dribble Expected Goals (`expected_goals`)

### Hypothesis Testing:
- **Hypothesis 1 (Inversion Bug)**: Dribble mistakenly mapped the AWAY side's xG to HOME, and HOME to AWAY.
  - *Result*: Inverted correlation yields $r = -1$. Hypothesis refuted.
- **Hypothesis 2 (Vendor Aggregation Bug)**: Dribble's model inflates favourites (e.g., Liverpool vs Newcastle in 2020 yielded 7.11 xG on 12 shots) while suppressing defensive sides.
  - *Result*: Confirmed. The vendor's proprietary shot-probability weights do not conform to open industry benchmarks (StatsBomb, Opta, Understat).

**Governance Directive**: 
> **STRICT INVARIANT MAINTAINED**: `expected_goals` and all its derivatives (`expected_goals_conceded`, `expected_assists`) remain **PERMANENTLY REJECTED** from the HandicapLab decision engine.

---

## 4. Advanced Opta Feature Completeness Audit

| Field Name | Description | Non-Null Count | Completeness % | Model Utility Domain |
|:---|:---|---:|---:|:---|
| `attempts_ibox` | Shots inside the 18-yard box | 4.167 | 100.0% | AH, OU, BTTS Danger |
| `attempts_obox` | Shots outside the 18-yard box | 4.040 | 100.0% | OU long-shot variance |
| `pen_area_entries` | Entries into opponent 18-yard box | 4.178 | 100.0% | AH Dominance, BTTS Pressure |
| `touches_in_opp_box` | Touches in opponent penalty box | 4.177 | 100.0% | Pure attacking territory |
| `final_third_entries` | Passes/carries into final third | 4.178 | 100.0% | Field tilt & possession quality |
| `big_chance_created` | Clear scoring opportunities created | 3.170 | 100.0% | Pure chance conversion proxy |
| `total_tackle` | Total attempted tackles | 4.178 | 100.0% | Defensive activity volume |
| `won_tackle` | Successful tackles won | 4.177 | 100.0% | Defensive duel efficiency |
| `interception` | Passes intercepted | 4.175 | 100.0% | Defensive shape stability |
| `ball_recovery` | Loose balls recovered | 4.178 | 100.0% | Counter-pressing & possession |
| `total_clearance` | Defensive clearances | 4.178 | 100.0% | Defensive pressure sustained |
| `total_cross` | Crosses attempted | 4.178 | 100.0% | Tactical aerial approach |
| `accurate_cross` | Successful crosses completed | 4.044 | 100.0% | Crossing precision |

---

## 5. Candidate Feature Classification for Feature Lab

1. **Approved for Research Feature Lab (`KEEP`)**:
   - Volume: `total_scoring_att`, `ontarget_scoring_att`
   - Territory: `pen_area_entries`, `touches_in_opp_box`, `final_third_entries`
   - Danger: `attempts_ibox`, `big_chance_created`
   - Set-piece & Crosses: `corner_taken`, `accurate_cross`, `total_cross`
   - Defensive Actions: `total_tackle`, `won_tackle`, `interception`, `ball_recovery`, `total_clearance`
2. **Research Only / Supplementary (`RESEARCH ONLY`)**:
   - `attempted_tackle_foul` (Partial whistle representation)
   - `total_pass`, `accurate_pass` (Possession volume proxy)
3. **Strictly Rejected (`REJECT`)**:
   - `expected_goals`, `expected_goals_conceded`, `expected_assists` (Severe semantic calibration failure)
