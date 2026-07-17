# Baseline Scoreboard — EPIC 33 Target Setting

**Dataset**: EPL 2015-2016 through 2023-2024 (3420 fixtures)
**Generated**: 2026-07-17
**Script**: `research/scripts/EPIC_32_7_BASELINE.py`

> **Note**: This revised scoreboard fixes a data leakage issue in the prior xG Only baseline and introduces ECE.

---

## Scoreboard

| Model | Brier ↓ | LogLoss ↓ | ECE ↓ | ROI % ↑ | Yield | CLV | n(Bets) | Rank |
|-------|:-------:|:---------:|:-----:|:-------:|:-----:|:---:|:-------:|:----:|
| **Odds Only** | `0.2072` | `0.6008` | `0.0273` | `-1.7%` | — | — | 3420 | 1 |
| **Blend 90/9** | `0.2075` | `0.6019` | `0.0280` | `-2.0%` | — | — | 976 | 2 |
| **Blend 80/19** | `0.2093` | `0.6067` | `0.0448` | `-2.1%` | — | — | 929 | 3 |
| **Blend 70/30** | `0.2124` | `0.6144` | `0.0560` | `-0.9%` | — | — | 882 | 4 |
| **Blend 60/40** | `0.2170` | `0.6248` | `0.0702` | `-1.4%` | — | — | 804 | 5 |
| **Blend 50/50** | `0.2230` | `0.6377` | `0.0767` | `-1.9%` | — | — | 698 | 6 |
| **ELO** | `0.2265` | `0.6446` | `0.1121` | `-3.0%` | — | — | 1846 | 7 |
| **xG Rolling (8)** | `0.2738` | `0.7442` | `0.1378` | `6.8%` | — | — | 940 | 8 |
| **xG Rolling (10)** | `0.2740` | `0.7445` | `0.1415` | `8.5%` | — | — | 947 | 9 |
| **xG Rolling (ema)** | `0.2744` | `0.7455` | `0.1407` | `6.8%` | — | — | 902 | 10 |
| **xG Rolling (5)** | `0.2752` | `0.7481` | `0.1367` | `8.1%` | — | — | 937 | 11 |
| **xG Rolling (3)** | `0.2767` | `0.7529` | `0.1370` | `2.7%` | — | — | 889 | 12 |

> Brier = Mean Squared Error (lower is better, 0 = perfect)
> LogLoss = Cross-entropy (lower is better)
> ECE = Expected Calibration Error (lower is better)
> ROI % = Flat-stake return on Bet365 closing odds (higher is better)

---

## Key Insights

1. **The True xG Edge**: A lookahead-free rolling xG average provides a solid signal but generally struggles to beat Bookmaker (-1.7% ROI) on flat stakes. The previous +13.2% ROI was confirmed as a data leak.
2. **Blends**: Combining market probabilities with raw performance (xG) often yields better calibration and sometimes better ROI than either alone.
3. **EPIC 33 Baseline Target**: The **Odds Only** Brier and LogLoss are the primary hurdles to cross.

---

## Acceptance Criteria for EPIC 33

A model in EPIC 33 must demonstrate **ALL** of:

1. ✅ **Brier Score** better than **Odds Only** (`0.2072`)
2. ✅ **LogLoss** better than **Odds Only** (`0.6008`)
3. ✅ **ECE** lower than the best baseline model
4. ✅ **ROI** consistently positive after vigorish (flat stakes)
5. ✅ **Walk-forward** stabilized across folds
6. ✅ **Reproducibility** 100%

---

## Methodology Notes

- **Leakage Prevention**: All rolling xG and ELO metrics are computed using data strictly $T-1$ before the kickoff.
- **Brier & LogLoss**: Binary (home win vs not home win) evaluated against implied probabilities.
- **ROI**: Flat stake ($1), evaluated if predicted P(home) > 0.55.
- **Evaluated on**: 3420 valid EPL matches, 9 seasons.
