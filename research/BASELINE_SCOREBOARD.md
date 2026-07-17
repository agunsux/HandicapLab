# Baseline Scoreboard — Pre-EPIC 33

**Dataset**: EPL 2015-2016 through 2023-2024 (3420 fixtures)
**Generated**: 2026-07-17
**Script**: `research/scripts/EPIC_32_7_BASELINE.py`

---

## Predictors Compared

| # | Predictor | Description |
|:-:|-----------|-------------|
| 1 | **Random** | Always predicts league-average probabilities |
| 2 | **Always Home** | Predicts home win with 100% confidence for every match |
| 3 | **Always Draw** | Predicts draw with 100% confidence for every match |
| 4 | **Always Away** | Predicts away win with 100% confidence for every match |
| 5 | **League Average** | Uses fixed seasonal probabilities as predictions |
| 6 | **Odds Only** | Uses Bet365 normalized implied probabilities |
| 7 | **xG Only** | Logistic function of xG differential (k=1.5) |
| 8 | **ELO** | Sequential ELO ratings (K=32, home adv=50) |
| 9 | **ELO + xG** | Equal-weighted ensemble of ELO and xG |

---

## Scoreboard

| Predictor | Brier ↓ | LogLoss ↓ | ROI % ↑ | n(Bets) |
|-----------|:-------:|:---------:|:-------:|:-------:|
| Random | `0.6428` | `1.0629` | 0.0% | — |
| Always Home | `0.5509` | `19.0271` | `-1.7%` | 3420 |
| Always Draw | `0.7681` | `26.5308` | `-8.3%` | 3420 |
| Always Away | `0.681` | `23.5212` | `-4.2%` | 3420 |
| League Average | `0.6428` | `1.0629` | N/A | — |
| **Odds Only** | `0.2072` | `0.6008` | `-1.7%` | 3420 |
| **xG Only** | `0.3406` | `0.949` | `13.2%` | 608 |
| **ELO** | `0.2265` | `0.6446` | `-3.0%` | 1846 |
| **ELO + xG** | `0.2431` | `0.6799` | `-0.1%` | 572 |

> Brier = Mean Squared Error (lower is better, 0 = perfect)
> LogLoss = Cross-entropy (lower is better)
> ROI % = Flat-stake return on Bet365 odds (higher is better)

---

## Key Insights

### 1. Odds Only is the hardest baseline to beat
The Bet365 market encodes crowd wisdom. Any ML model must beat:
- Brier < `0.2072`
- LogLoss < `0.6008`
- ROI > `-1.7%`

### 2. ELO is surprisingly competitive
Simple ELO (K=32) achieves Brier `0.2265` with almost no data preprocessing.

### 3. League Average is the "no-information" baseline
Brier `0.6428` — any useful model must beat this trivially.

### 4. Always strategies have terrible LogLoss
Predicting 100% confidence on wrong outcomes incurs severe log loss penalty.

---

## Acceptance Criteria for EPIC 33

A model in EPIC 33 must demonstrate **ALL** of:

1. ✅ Brier Score better than **Odds Only** (`0.2072`)
2. ✅ LogLoss better than **Odds Only** (`0.6008`)
3. ✅ ROI higher than **ELO + xG** (`-0.1%`)
4. ✅ Outperforms every simple baseline listed above
5. ✅ Improvement is statistically significant (test set n ≥ 500)

---

## Methodology Notes

- **Brier Score**: Multi-class for Random/League Average, binary (home win) for others  
- **ROI**: Flat stake ($1), Bet365 closing odds. Draw/away bets not modeled separately  
- **ELO**: Initial rating 1500, K=32, home advantage=50, sequentially updated  
- **xG**: Logistic function P(home) = 1/(1 + exp(-1.5 × xG_diff))  
- **Odds**: Implied probabilities normalized by removing overround  
- **Evaluated on**: 3420 EPL matches, 9 seasons
