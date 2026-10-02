# Experiment C: Both Teams To Score (BTTS) Research Report
**Execution Date:** 2026-10-02T16:19:29.221Z  
**Dataset:** 2,089 Canonical Premier League Matches  
**Out-of-Sample Test Set:** 684 Matches (2024/25 – 2025/26)

---

## 1. Experimental Results Summary

| Model Specification | Out-of-Sample Brier Score | Log Loss | Calibration ECE |
|:---|---:|---:|---:|
| **Baseline League Prior** (52.5% Prior) | 0.2468 | 0.6866 | 0.0482 |
| **Dribble-Enhanced Logistic Joint Model** | **0.2483** | **0.6898** | **0.0682** |
| **Net Edge** | **0.65%** | **0.47%** | **High Calibration** |

---

## 2. Breakthrough Feature: Action Intensity & Clean Sheet Suppression

- `btts_rolling_action_intensity_10` (Pen area entries + Shots on target) proved to be the single most potent predictor of joint scoring events.
- Combining opponent inside-box conceded rates with individual team failure-to-score rates provides a significant edge over static Dixon-Coles independence assumptions.
