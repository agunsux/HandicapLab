# DRIBBLE360 FEATURE CATALOG
## Engineered Statistical Feature Vectors for Prematch Market Modeling
### HandicapLab / SALMO Quantitative Intelligence — October 2026

---

## 1. Architecture & Design Principles

All features in this catalog are generated strictly point-in-time from raw Opta-grade counting and spatial metrics in Dribble360 `/team_matches` records via `DribbleMultiWindowFeatureLab` and `DribbleEliteFeatureLab`.

```
Raw Team Match (303 Opta fields)
             ↓
Chronological Pipeline (Prior matches where date < kickoff)
             ↓
Rolling Windows (3, 5, 8, 10 matches) × Splits (Overall, Home-only, Away-only)
             ↓
Feature Engineering:
   ├─ Asian Handicap Differentials (Home - Away)
   ├─ Over/Under Combined Match Intensities (Home + Away)
   ├─ BTTS Joint Scoring Indicators (Joint probabilities & box penetrations)
   └─ League-Relative Normalizations: (Feature - League_Mean) / League_Std
             ↓
Quarantine Filter (Zero vendor xG, Zero future leakage)
             ↓
Production Model Inputs
```

---

## 2. Core Statistical Base Metrics (Per Team Pipeline)

Computed over rolling windows $W \in \{3, 5, 8, 10\}$ and venue splits $S \in \{\text{overall}, \text{home}, \text{away}\}$:

| Metric Identifier | Raw Opta Fields | Mathematical Definition | Completeness | Semantic Validity |
|---|---|---|---|---|
| `avg_shots` | `total_scoring_att` | $\frac{1}{N}\sum \text{shots}$ | 80.5% (100% in T1) | High ($r = 0.9977$) |
| `avg_sot` | `ontarget_scoring_att` | $\frac{1}{N}\sum \text{shots on target}$ | 78.5% (100% in T1) | High ($r = 0.9982$) |
| `avg_box_entries` | `pen_area_entries` | $\frac{1}{N}\sum \text{penalty area entries}$ | 75.8% (100% in T1) | High (Opta standard) |
| `avg_touches_in_box` | `touches_in_opp_box` | $\frac{1}{N}\sum \text{box touches}$ | 79.8% (100% in T1) | High (Opta standard) |
| `avg_final_third_entries` | `final_third_entries` | $\frac{1}{N}\sum \text{final third entries}$ | 75.8% (100% in T1) | High (Field tilt proxy) |
| `avg_ibox_attempts` | `attempts_ibox` | $\frac{1}{N}\sum \text{shots inside box}$ | 79.0% (99.7% in T1) | High (High xG proxy) |
| `avg_defensive_actions` | `total_tackle + interception + ball_recovery` | $\frac{1}{N}\sum (\text{tackles} + \text{ints} + \text{recoveries})$ | 74.9% (100% in T1) | High (Defensive disruption) |
| `avg_corners` | `corner_taken` | $\frac{1}{N}\sum \text{corners}$ | 74.0% (100% in T1) | High ($r = 0.9946$) |
| `avg_goals_scored` | `goals` (coalesced null $\to 0$) | $\frac{1}{N}\sum \text{goals}$ | 100.0% | Ground truth ($r = 1.000$) |
| `avg_goals_conceded` | `goals_conceded` | $\frac{1}{N}\sum \text{conceded}$ | 100.0% | Ground truth ($r = 1.000$) |
| `clean_sheet_rate` | `goals_conceded == 0` | $\frac{1}{N}\sum \mathbb{I}(\text{conceded} = 0)$ | 100.0% | High |
| `failed_to_score_rate` | `goals == 0` | $\frac{1}{N}\sum \mathbb{I}(\text{goals} = 0)$ | 100.0% | High |
| `pass_accuracy` | `accurate_pass / total_pass` | $\frac{\sum \text{accurate}}{\sum \text{total passes}}$ | 76.1% (100% in T1) | High |
| `cross_accuracy` | `accurate_cross / total_cross` | $\frac{\sum \text{accurate crosses}}{\sum \text{total crosses}}$ | 72.8% (100% in T1) | High |

---

## 3. Market-Specific Engineered Features

### 3.1 Asian Handicap (AH) Feature Suite

Designed to capture directional team superiority and field tilt independent of noisy historical goal outcomes:

| Feature Name | Formula | Economic Mechanism | Value Rating | Status |
|---|---|---|---|---|
| `ah_shot_diff_{W}` | $\text{HomeShots}_W - \text{AwayShots}_W$ | Net shot generation capability | **Critical** (+0.54% Brier) | **KEEP (Gold)** |
| `ah_box_entry_diff_{W}` | $\text{HomeBoxEntries}_W - \text{AwayBoxEntries}_W$ | Dangerous territory dominance | **Secondary** (+0.12% Brier) | **KEEP (Gold)** |
| `ah_territorial_diff_{W}` | $\text{HomeFTEntries}_W - \text{AwayFTEntries}_W$ | Field tilt and possession pressure | **Secondary** (+0.08% Brier) | **KEEP (Gold)** |
| `ah_defensive_diff_{W}` | $\frac{\text{HomeDefActions}}{\text{AwayIboxAtt}+1} - \frac{\text{AwayDefActions}}{\text{HomeIboxAtt}+1}$ | Defensive disruption vs. box threat | Secondary | **KEEP (Gold)** |

### 3.2 Over / Under (OU) Feature Suite

Designed to measure match pace, conversion likelihood, and danger intensity across lines 1.5 to 3.5:

| Feature Name | Formula | Economic Mechanism | Backtest Finding | Status |
|---|---|---|---|---|
| `ou_total_ibox_{W}` | $\text{HomeIboxAtt}_W + \text{AwayIboxAtt}_W$ | High-probability chance frequency | Market already prices volume | **RESEARCH ONLY** |
| `ou_total_shots_{W}` | $\text{HomeShots}_W + \text{AwayShots}_W$ | Baseline shooting tempo | Degrades calibration (+0.44% Brier) | **RESEARCH ONLY** |
| `ou_box_danger_{W}` | $(\text{TouchesBox} + \text{BoxEntries})_{\text{Home}+\text{Away}}$ | Sustained box chaos & variance | Market lines absorb volume | **RESEARCH ONLY** |
| `ou_setpiece_frequency_{W}` | $(\text{Corners} + \text{AccCrosses})_{\text{Home}+\text{Away}}$ | Dead-ball chance cadence | Negligible edge vs. Pinnacle | **RESEARCH ONLY** |

### 3.3 Both Teams to Score (BTTS) Feature Suite

Measures the joint likelihood of both sides breaching the other's defensive structure:

| Feature Name | Formula | Economic Mechanism | Backtest Finding | Status |
|---|---|---|---|---|
| `btts_joint_scoring_rate_{W}` | $(1 - \text{FTSR}_{\text{Home}}) \times (1 - \text{FTSR}_{\text{Away}})$ | Joint non-shutout probability | Brier degrades (+0.65%) | **RESEARCH ONLY** |
| `btts_action_intensity_{W}` | $\text{HomeBoxEntries}_W + \text{AwayBoxEntries}_W$ | Mutual penalty box penetration | Low incremental signal | **RESEARCH ONLY** |
| `btts_ibox_conceded_rate_{W}` | $\frac{\text{HomeIboxConceded}_W + \text{AwayIboxConceded}_W}{2}$ | Mutual defensive vulnerability | Absorbed by market line | **RESEARCH ONLY** |

---

## 4. League-Relative Standardized Features

To allow cross-league generalizability without league bias, all base metrics are normalized against the contemporaneous league-season distribution:

$$\tilde{x}_{i,t} = \frac{x_{i,t} - \mu_{L,S,t}}{\sigma_{L,S,t} + \epsilon}$$

Where:
- $x_{i,t}$ is team $i$'s rolling metric at match date $t$.
- $\mu_{L,S,t}$ is the mean of that metric across all teams in league $L$ and season $S$ prior to date $t$.
- $\sigma_{L,S,t}$ is the standard deviation.

**Key Standardized Features**:
1. `rel_ah_shot_diff_{W}`: League-standardized shot differential.
2. `rel_ah_box_entry_diff_{W}`: League-standardized penalty box penetration superiority.
3. `rel_ah_territorial_diff_{W}`: League-standardized field tilt.

---

## 5. Quarantined & Rejected Features

| Feature Name | Reason for Quarantine | Correlation / Evidence | Verdict |
|---|---|---|---|
| `expected_goals` | Negative correlation with ground truth | $r = -0.2030, \text{MAE} = 1.2375$ vs. Understat | **REJECTED** |
| `expected_goals_conceded` | Direct derivative of vendor xG | Inherits corrupted weighting | **REJECTED** |
| `expected_assists` | Inconsistent shot-chain attribution | Unreliable across non-T1 leagues | **REJECTED** |
| `ppda` | 98.7% null across corpus | Incomplete coverage | **REJECTED** |
| `possession_percentage` | 92.4% null in raw records | Unpopulated outside top fixtures | **REJECTED** |
| `attempted_tackle_foul` | Captures only tackle-related fouls | $r = 0.7033$ vs. total whistled fouls | **RESEARCH ONLY** |
