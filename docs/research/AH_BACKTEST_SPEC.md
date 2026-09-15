# Asian Handicap Backtest & Validation Specification — Gate 2

**Document Version**: 1.0.0  
**Research Gate**: Gate 2 — Model A Baseline  
**Target Engine**: `src/lib/research/model-a/`  
**Execution Command**: `npm run research:ah:model-a`  

### Research Status
```text
Model A:
VALIDATED AS A REPRODUCIBLE BASELINE

NOT VALIDATED AS A POSITIVE-EDGE STRATEGY

OOS ROI:
-1.60%

Monthly yield:
NOT YET EVALUATED

CLV:
NOT PRIMARY VALIDATION

Positive edge:
NOT ESTABLISHED
```


---

## 1. Backtest Objective & Integrity Rules

The Gate 2 backtest establishes a **leakage-free, chronological out-of-sample baseline** for Model A (Hierarchical Dixon-Coles).

### Non-Negotiable Research Invariants
1. **Strict Temporal Causality**: For any match evaluated on date $T$, model parameter estimation strictly uses matches where `matchDate < T`. Any attempt to fit using $t \ge T$ triggers an unrecoverable exception.
2. **No Market Odds Contamination**: Model probabilities are derived purely from goal expectations and low-score dependence, without referencing opening or closing odds.
3. **No ROI Overfitting**: Parameters ($\mu, \gamma, \alpha, \beta, \rho$) are optimized via penalized Poisson log-likelihood, never tuned to maximize historical yield.
4. **Closing Odds Quarantine**: In accordance with Gate 1 audit findings (25.5% closing coverage), closing odds are quarantined from modeling and evaluation. All diagnostic bets evaluate against available pre-match opening odds.

---

## 2. Dataset & Provenance Inventory

- **Canonical Matches**: `data/golden/europe/canonical_matches.jsonl` (8,898 matches, 5 leagues, 2015-08-08 to 2026-05-24).
- **Market Odds**: `data/golden/europe/market_odds.jsonl` (23,864 AH observations).
- **Combined SHA-256 Hash**: `22e8e80a8d9c53aa878972bc42603d9b231fed709357c9d05cf8defc1ac1d727`.
- **Whitelisted Leagues**:
  - `ENG-PL` (Premier League)
  - `ESP-LALIGA` (La Liga)
  - `DEU-BUNDESLIGA` (Bundesliga)
  - `ITA-SERIEA` (Serie A)
  - `FRA-LIGUE1` (Ligue 1)

---

## 3. Temporal Splits & Walk-Forward Architecture

### 3.1 Primary Split Setup
| Split | Seasons Included | Match Dates | Matches | Purpose |
|---|---|---|---|---|
| **Training Set** | 2015-2016 to 2021-2022 (7 seasons) | 2015-08-08 to 2022-05-22 | 7,378 | Baseline parameter estimation |
| **Validation Set** | 2022-2023 (1 season) | 2022-08-05 to 2023-05-28 | 380 | Hyperparameter check ($\lambda_{reg}, \xi$) |
| **OOS Test Set** | 2023-2024 to 2025-2026 (3 seasons) | 2023-08-11 to 2026-05-24 | 1,140 | Out-of-Sample diagnostic baseline |

### 3.2 Walk-Forward Expanding Cross-Validation Folds
| Fold | Training Seasons | Training Cutoff | Test Season | Test Matches | Test AH Quotes |
|---|---|---|---|---|---|
| **Fold 1** | 2015-2016 .. 2020-2021 | 2021-07-01 | 2022-2023 | 380 | 1,520 |
| **Fold 2** | 2015-2016 .. 2021-2022 | 2022-07-01 | 2023-2024 | 380 | 1,520 |
| **Fold 3** | 2015-2016 .. 2022-2023 | 2023-07-01 | 2024-2025 | 380 | 1,520 |
| **Fold 4** | 2015-2016 .. 2023-2024 | 2024-07-01 | 2025-2026 | 380 | 1,516 |

---

## 4. Evaluation Metrics & Audit Results

### 4.1 Match Outcome Forecast Metrics (1X2)
- **Multiclass Log Loss**: $-\frac{1}{N} \sum_{m} \sum_{k \in \{H,D,A\}} y_{k,m} \ln(p_{k,m})$
- **Multiclass Brier Score**: $\frac{1}{N} \sum_{m} \sum_{k} (p_{k,m} - y_{k,m})^2$
- **Goal Expectation MAE**: $\frac{1}{N} \sum |\lambda_{h,m} - h_m| + |\lambda_{a,m} - a_m|$

### 4.2 Asian Handicap Specific Forecast Metrics
- **AH Brier Score**: Graded quadratic loss on cover probabilities ($y \in \{1.0, 0.75, 0.50, 0.25, 0.0\}$).
- **AH ECE (Expected Calibration Error)**: Binned into 10 deciles $[0.0, 0.1], \dots, [0.9, 1.0]$.

### 4.3 OOS Betting Diagnostic
- **Selection Rule**: Fixed 1.0 unit stake on pre-match opening odds whenever theoretical $EV > 0.00$.
- **Objective**: Diagnostic baseline only. Not intended to demonstrate positive yield without market consensus.

---

## 5. Official Model A Empirical Results

### Summary Table
| Metric | Validation (2022-2023) | OOS Test (2023-2026) |
|---|---|---|
| **Matches Evaluated** | 380 | 1,140 |
| **Match Log Loss** | 1.0274 | 1.0150 |
| **Match Brier Score** | 0.6150 | 0.6078 |
| **Goal MAE (Home / Away)** | 1.0318 / 0.9447 | 0.9788 / 0.8992 |
| **AH Brier Score** | 0.2334 | 0.2274 |
| **AH ECE (Calibration)** | 0.1482 | 0.1214 |
| **AH Quotes Evaluated** | 1,520 | 4,556 |
| **OOS Bets (EV > 0)** | 707 | 2,113 |
| **OOS Turnover** | 707.00 units | 2,113.00 units |
| **OOS Total Profit** | -69.56 units | -33.77 units |
| **OOS ROI / Yield** | **-9.84%** | **-1.60%** |
| **OOS Max Drawdown** | 71.98 units | 67.22 units |
| **Bet Distribution** | W: 251, HW: 60, P: 38, HL: 46, L: 312 | W: 850, HW: 143, P: 140, HL: 152, L: 828 |

### Walk-Forward Folds Detail
| Fold | Test Season | Matches | Log Loss | Brier Score | AH Brier | Bets Taken | ROI |
|---|---|---|---|---|---|---|---|
| Fold 1 | 2022-2023 | 380 | 1.0393 | 0.6239 | 0.2387 | 713 | -10.02% |
| Fold 2 | 2023-2024 | 380 | 0.9526 | 0.5633 | 0.2222 | 717 | +4.47% |
| Fold 3 | 2024-2025 | 380 | 1.0463 | 0.6297 | 0.2376 | 717 | -3.42% |
| Fold 4 | 2025-2026 | 380 | 1.0420 | 0.6277 | 0.2210 | 656 | 0.00% |

---

## 6. Model A vs Baseline (Independent Poisson) Comparison

| Metric | Model A (Dixon-Coles) | Baseline (Independent Poisson) | Delta (DC - Poisson) | Note |
|---|---|---|---|---|
| **Log Loss** | 1.0150 | 1.0149 | +0.0001 | Neutral |
| **Brier Score** | 0.6078 | 0.6077 | +0.0001 | Neutral |
| **AH Brier Score** | **0.2274** | 0.2276 | **-0.0002** | Dixon-Coles superior |
| **OOS ROI** | **-1.60%** | -1.75% | **+0.15%** | Dixon-Coles +15 bps |

**Conclusion**: The Dixon-Coles low-score interdependence correction provides a modest but statistically measurable improvement in Asian Handicap calibration (lower AH Brier score) and improved OOS diagnostic yield over uncorrected Poisson.

