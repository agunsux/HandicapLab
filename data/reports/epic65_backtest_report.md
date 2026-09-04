# EPIC 65: Comprehensive Model Validation & Segment Profitability Report

**Execution Timestamp**: `2026-09-04T16:14:56.972Z`  
**Target Scope**: 2 Completed Seasons (`2024-2025` & `2025-2026`) across Top 5 European Leagues  
**Ground Truth Benchmark**: Pinnacle Closing Odds (`100% Verified`)  
**Anti-p-Hacking Status**: **Pre-Locked Hypotheses Enforced** (Benjamini-Hochberg FDR $q = 0.05$, $N \ge 30$)  

## 1. Stage B: Asian Handicap Segment Profitability Audit

The audit examines model performance across pre-locked handicap line segments without pooling leagues.

| League | Segment | N | Hit Rate | Total Profit (Units) | Yield % | Avg Odds | Avg CLV % | p-value | BH Critical p | Significant? |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `ENG-PL` | **Deep Favorite** | 63 | 25.0% | -29.51 | -46.84% | 1.97 | +23.68% | 0.0000 | 0.0117 | NO |
| `ENG-PL` | **Clear Favorite** | 166 | 24.8% | -71.72 | -43.20% | 1.96 | +23.95% | 0.0000 | 0.0017 | NO |
| `ENG-PL` | **Slight Favorite** | 152 | 38.8% | -27.56 | -18.13% | 1.95 | +18.72% | 0.0168 | 0.0350 | NO |
| `ENG-PL` | **Pick'em / Level Ball** | 75 | 29.6% | -23.02 | -30.69% | 1.96 | +22.77% | 0.0011 | 0.0200 | NO |
| `ENG-PL` | **Slight Underdog** | 112 | 49.6% | +4.36 | +3.90% | 1.94 | +21.20% | 0.6549 | 0.0500 | NO |
| `ENG-PL` | **Clear Underdog** | 79 | 73.7% | +37.25 | +47.15% | 1.96 | +26.41% | 0.0000 | 0.0067 | **YES** (p < 0.0067) |
| `ENG-PL` | **Deep Underdog** | 11 | 81.8% | +6.75 | +61.36% | 1.97 | +18.63% | 0.0294 | - | *N < 30* |
| `ESP-LALIGA` | **Deep Favorite** | 64 | 39.0% | -11.57 | -18.07% | 1.96 | +20.22% | 0.1141 | 0.0433 | NO |
| `ESP-LALIGA` | **Clear Favorite** | 130 | 33.6% | -30.99 | -23.84% | 1.96 | +20.64% | 0.0021 | 0.0217 | NO |
| `ESP-LALIGA` | **Slight Favorite** | 228 | 35.5% | -47.68 | -20.91% | 1.95 | +19.85% | 0.0004 | 0.0150 | NO |
| `ESP-LALIGA` | **Pick'em / Level Ball** | 80 | 37.0% | -14.24 | -17.80% | 1.97 | +25.71% | 0.0517 | 0.0400 | NO |
| `ESP-LALIGA` | **Slight Underdog** | 86 | 55.8% | +16.88 | +19.62% | 1.94 | +23.45% | 0.0419 | 0.0383 | NO |
| `ESP-LALIGA` | **Clear Underdog** | 60 | 81.8% | +37.34 | +62.23% | 1.97 | +35.31% | 0.0000 | 0.0050 | **YES** (p < 0.0050) |
| `ESP-LALIGA` | **Deep Underdog** | 10 | 90.0% | +8.36 | +83.60% | 2.03 | +25.18% | 0.0064 | - | *N < 30* |
| `ITA-SERIEA` | **Deep Favorite** | 50 | 27.7% | -19.21 | -38.43% | 1.97 | +23.16% | 0.0028 | 0.0250 | NO |
| `ITA-SERIEA` | **Clear Favorite** | 144 | 33.1% | -35.60 | -24.72% | 1.95 | +26.79% | 0.0006 | 0.0183 | NO |
| `ITA-SERIEA` | **Slight Favorite** | 171 | 36.3% | -35.79 | -20.93% | 1.95 | +24.47% | 0.0023 | 0.0233 | NO |
| `ITA-SERIEA` | **Pick'em / Level Ball** | 76 | 68.0% | +15.49 | +20.38% | 1.92 | +28.96% | 0.0208 | 0.0367 | **YES** (p < 0.0367) |
| `ITA-SERIEA` | **Slight Underdog** | 113 | 58.0% | +26.16 | +23.15% | 1.97 | +29.09% | 0.0062 | 0.0317 | **YES** (p < 0.0317) |
| `ITA-SERIEA` | **Clear Underdog** | 92 | 77.8% | +51.55 | +56.03% | 1.97 | +34.02% | 0.0000 | 0.0033 | **YES** (p < 0.0033) |
| `ITA-SERIEA` | **Deep Underdog** | 8 | 87.5% | +5.96 | +74.50% | 1.99 | +29.45% | 0.0209 | - | *N < 30* |
| `DEU-BUNDESLIGA` | **Deep Favorite** | 36 | 36.1% | -9.24 | -25.67% | 2.04 | +23.27% | 0.1055 | 0.0417 | NO |
| `DEU-BUNDESLIGA` | **Clear Favorite** | 115 | 30.8% | -34.83 | -30.29% | 1.94 | +24.50% | 0.0002 | 0.0133 | NO |
| `DEU-BUNDESLIGA` | **Slight Favorite** | 142 | 30.3% | -46.61 | -32.82% | 1.94 | +23.23% | 0.0000 | 0.0100 | NO |
| `DEU-BUNDESLIGA` | **Pick'em / Level Ball** | 60 | 45.0% | -4.56 | -7.60% | 1.97 | +25.83% | 0.4701 | 0.0483 | NO |
| `DEU-BUNDESLIGA` | **Slight Underdog** | 91 | 63.2% | +29.62 | +32.54% | 1.96 | +27.97% | 0.0005 | 0.0167 | **YES** (p < 0.0167) |
| `DEU-BUNDESLIGA` | **Clear Underdog** | 40 | 80.8% | +23.60 | +59.00% | 1.93 | +34.70% | 0.0000 | 0.0083 | **YES** (p < 0.0083) |
| `DEU-BUNDESLIGA` | **Deep Underdog** | 13 | 100.0% | +12.73 | +97.92% | 1.98 | +22.01% | 0.0000 | - | *N < 30* |
| `FRA-LIGUE1` | **Deep Favorite** | 46 | 42.2% | -5.61 | -12.20% | 1.95 | +20.91% | 0.3871 | 0.0467 | NO |
| `FRA-LIGUE1` | **Clear Favorite** | 113 | 33.8% | -26.72 | -23.65% | 1.96 | +27.55% | 0.0041 | 0.0300 | NO |
| `FRA-LIGUE1` | **Slight Favorite** | 134 | 35.8% | -32.14 | -23.99% | 1.95 | +20.55% | 0.0028 | 0.0267 | NO |
| `FRA-LIGUE1` | **Pick'em / Level Ball** | 47 | 39.4% | -7.62 | -16.21% | 1.96 | +29.00% | 0.1799 | 0.0450 | NO |
| `FRA-LIGUE1` | **Slight Underdog** | 100 | 61.0% | +26.12 | +26.12% | 1.95 | +24.40% | 0.0040 | 0.0283 | **YES** (p < 0.0283) |
| `FRA-LIGUE1` | **Clear Underdog** | 52 | 68.8% | +17.04 | +32.77% | 1.93 | +27.67% | 0.0067 | 0.0333 | **YES** (p < 0.0333) |
| `FRA-LIGUE1` | **Deep Underdog** | 14 | 85.7% | +9.42 | +67.29% | 1.94 | +19.58% | 0.0036 | - | *N < 30* |

### Benjamini-Hochberg FDR Summary (Stage B)

- **Cells Tested**: 35 segment × league combinations
- **Cells Meeting $N \ge 30$**: 30
- **Cells Demonstrating Statistically Significant Alpha**: **9**

## 2. Stage C: Both Teams To Score (BTTS) Outcome Calibration

> [!IMPORTANT]
> **Data Availability Disclosure**: As forensic audit confirmed, non-EPL historical CSV sources contain no market odds for BTTS. Consequently, this model is evaluated purely on **probability calibration (Brier Score & Expected Calibration Error)** against actual match outcomes. No financial ROI claims are made.

| League | Matches | Actual BTTS % | Avg Model Prob | Model Brier | Naive Base Brier | Brier Imprv % | ECE (10 Bins) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `ENG-PL` | 750 | 56.5% | 52.2% | 0.2487 | 0.2457 | -1.20% | 4.76% |
| `ESP-LALIGA` | 741 | 55.6% | 46.3% | 0.2483 | 0.2469 | -0.59% | 9.31% |
| `ITA-SERIEA` | 701 | 48.5% | 45.0% | 0.2576 | 0.2498 | -3.13% | 8.35% |
| `DEU-BUNDESLIGA` | 567 | 60.1% | 52.3% | 0.2488 | 0.2397 | -3.80% | 7.86% |
| `FRA-LIGUE1` | 566 | 54.1% | 50.8% | 0.2585 | 0.2483 | -4.08% | 7.71% |

## 3. Stage D: Over/Under 2.5 Pinnacle Closing Line Backtest

> [!NOTE]
> Evaluated on the 2.5 line only, where verified Pinnacle closing lines exist for 100% of historical matches.

| League | Matches | Bets Placed | Hit Rate | Profit (Units) | Yield % | Avg Odds | Avg CLV % |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `ENG-PL` | 760 | 575 | 50.3% | +22.74 | +3.95% | 2.14 | +13.81% |
| `ESP-LALIGA` | 760 | 599 | 51.4% | -2.64 | -0.44% | 2.04 | +16.99% |
| `ITA-SERIEA` | 760 | 589 | 46.5% | -28.84 | -4.90% | 2.07 | +20.55% |
| `DEU-BUNDESLIGA` | 612 | 459 | 46.6% | -41.77 | -9.10% | 2.11 | +16.72% |
| `FRA-LIGUE1` | 612 | 458 | 50.4% | -17.34 | -3.79% | 1.97 | +18.33% |
| **TOTAL POOLED** | **3504** | **2680** | **49.1%** | **-67.85** | **-2.53%** | **2.07** | **+17.27%** |

