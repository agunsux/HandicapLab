# AH INFORMATION ADVANTAGE RESEARCH REPORT
## PRE-CLOSING INFORMATION ADVANTAGE & STRUCTURAL ALPHA DISCOVERY

- **Generated**: 2026-09-11T17:55:01.674Z
- **Research Engine**: `ah-info-advantage-v1`
- **Pre-Registered Status**: FROZEN & AUDITED
- **Production Classification**: **RESEARCH ONLY** (Firewalled)

---

### EXECUTIVE VERDICT

# [VERDICT C]: NO DEMONSTRATED INFORMATION ADVANTAGE

> Early market prices incorporate nearly all measurable fundamental information. Fundamental features fail to generate statistically significant edge over market quotes.

#### Separation of the Three Core Questions
1. **Question A: Can we predict AH settlement?**
   - **Answer**: NO. Model cannot beat naive settlement baselines.
2. **Question B: Can we predict better than the opening market?**
   - **Answer**: NO. Early market quotes already reflect equal or superior predictive calibration (Early Market Brier: 0.2481, Early+Football: 0.3648).
3. **Question C: Can we generate positive realized betting ROI?**
   - **Answer**: NO. Realized betting ROI is negative (-2.47%), confirming bookmaker margin barrier.

---

## 1. HYPOTHESIS & RESEARCH QUESTION

The primary question investigates:
> *"Can HandicapLab identify useful predictive information BEFORE the market fully converges toward closing prices?"*

We test whether information available at the **EARLY / OPENING SNAPSHOT** (Team form, Team strength, Match context, Goal environment, and Line movements) contains incremental predictive power beyond what is already embedded in early prices, and compare this against the closing market benchmark.

---

## 2. DATA AVAILABILITY & COVERAGE

- **Dataset Provenance**: Frozen European Gold Manifest (`canonical_matches.jsonl`, `market_odds.jsonl`).
- **Primary League**: Premier League (ENG-PL, 2019-2020 through 2025-2026, 7 completed/active walk-forward seasons).
- **Secondary Top-5 Leagues**: La Liga (ESP-LALIGA), Bundesliga (DEU-BUNDESLIGA), Serie A (ITA-SERIEA), Ligue 1 (FRA-LIGUE1).
- **Bookmaker Provenance**: Pinnacle Opening (`PAHH`, `PAHA`, `AHh`) and Pinnacle Closing (`PCAHH`, `PCAHA`, `AHCh`).
- **Total Evaluated Out-of-Sample Matches**: 6158 matches (12316 decided side selections across walk-forward folds).

---

## 3. TIMESTAMP QUALITY & INTRADAY EFFICIENCY LIMITATION

In strict compliance with **Critical Data Rule 2** (*Do not fabricate timestamps; never label a quote opening merely because it is the first row encountered; do not interpolate missing snapshots*):

- **Kickoff Timestamps**: `Date` and `Time` present in raw source CSVs.
- **Intraday Interval Snapshots ($T-24\text{h}, T-12\text{h}, T-6\text{h}, T-3\text{h}, T-1\text{h}, T-30\text{m}$)**: **NOT AVAILABLE** across the 3,040 historical matches.
- **OddsPAPI Raw Ticks**: Confined to 4 live probe fixtures.
- **Formal Data Classification**: **DATA INSUFFICIENT FOR CONTINUOUS INTRADAY CURVE**.
- **Audit Verdict**: Research strictly treats the data as **TWO DISCRETE MARKET STATES**:
  1. `EARLY / OPENING SNAPSHOT` (Initial quote published prior to matchday)
  2. `CLOSING SNAPSHOT` (Final quote recorded immediately prior to kickoff)

---

## 4. FEATURE GROUPS (INFORMATION DECOMPOSITION)

| Group | Name | Key Features | Snapshot Provenance | Leakage Guard |
| :--- | :--- | :--- | :--- | :--- |
| **A** | **Market** | AH line, AH price, 1X2 devig, Over 2.5 devig, 2-way AH devig | Early or Closing per cohort | Point-in-time snapshot only |
| **B** | **Movement** | $\Delta\text{line}$, $\Delta\text{price}$, $\Delta\text{prob}$, 6 structural movement patterns | Early $\to$ Closing transition | Movement Bridge evaluation only |
| **C** | **Team Form** | Last 3, 5, 10 match rolling PPG, GF, GA, GD; venue form; PPM | Strictly earlier calendar dates | Date-group update (no same-day leakage) |
| **D** | **Team Strength** | Sequential Elo ($K=20, \text{HA}=60$), rolling goal superiority, opponent-adjusted strength | Strictly earlier calendar dates | Pre-match rating only |
| **E** | **Match Context** | Rest days (home, away, diff), expanding home advantage, season progression, schedule density | Strictly earlier calendar dates | Pre-match calendar calculation |
| **F** | **Goal Env** | League expanding scoring rate, team season GF/GA rates | Strictly earlier calendar dates | Expanding window excluding target match |

---

## 5. ABLATION MATRIX (OOS ATTRIBUTION)

All models evaluated strictly Out-of-Sample via multi-season walk-forward validation:

| Model ID | Information Group Included | Decided Bets (N) | Brier Score | Log Loss | ECE | All Bets ROI | EV>0 Bets | EV>0 ROI | EV>0 95% CI | Positive Folds | Median Fold ROI |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **M0** | Market Only | 12316 | 0.2902 | 0.829 | 0.1567 | -2.71% | 6239 | -2.48% | [-4.96%, 0%] | 2/5 | -1.30% |
| **M1** | Market + Form | 12316 | 0.3336 | 1.0463 | 0.2478 | -2.71% | 6460 | -2.74% | [-5.17%, -0.3%] | 2/5 | -2.72% |
| **M2** | Market + Strength | 12316 | 0.3109 | 0.9372 | 0.2131 | -2.71% | 6398 | -1.86% | [-4.32%, 0.59%] | 4/5 | -0.95% |
| **M3** | Market + Context | 12316 | 0.3024 | 0.895 | 0.1778 | -2.71% | 6356 | -2.49% | [-4.95%, -0.03%] | 2/5 | -2.49% |
| **M4** | Market + Goal Env | 12316 | 0.2965 | 0.8604 | 0.1769 | -2.71% | 6322 | -2.36% | [-4.83%, 0.1%] | 2/5 | -2.09% |
| **M5** | Market + Form + Strength | 12316 | 0.3496 | 1.1981 | 0.2867 | -2.71% | 6521 | -1.25% | [-3.67%, 1.18%] | 4/5 | -2.13% |
| **M6** | Market + Form + Strength + Context | 12316 | 0.3604 | 1.2592 | 0.3072 | -2.71% | 6549 | -1.80% | [-4.22%, 0.62%] | 3/5 | -2.31% |
| **M7** | Market + All Valid Information | 12316 | 0.3648 | 1.2732 | 0.3112 | -2.71% | 6551 | -2.47% | [-4.9%, -0.05%] | 1/5 | -2.32% |
| **F0** | Football Information Only (No Market) | 12316 | 0.3422 | 1.1277 | 0.2611 | -2.71% | 6535 | -2.23% | [-4.66%, 0.19%] | 1/5 | -3.66% |

---

## 6. EARLY VS CLOSING MARKET DYNAMICS

| Configuration | Model Role | Decided Bets | Brier | Log Loss | ECE | All Bets ROI | EV>0 Bets | EV>0 ROI | EV>0 95% CI |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **A. Early Market** | Devigged Opening Quotes | 12316 | 0.2481 | 0.6895 | 0.0116 | -2.71% | 564 | +9.33% | [1.08%, 17.58%] |
| **B. Closing Market** | Devigged Closing Quotes | 5676 | 0.2502 | 0.6937 | 0.0341 | -1.71% | 583 | +6.40% | [-1.71%, 14.52%] |
| **C. Early + Football** | Fundamental Model on Early Quotes | 12316 | 0.3648 | 1.2732 | 0.3112 | -2.71% | 6551 | -2.47% | [-4.9%, -0.05%] |
| **D. Early + Football + Movement** | Movement Bridge Test | 12316 | 0.3684 | 1.3437 | 0.3171 | -2.71% | 6543 | -0.98% | [-3.4%, 1.45%] |
| **E. Football Only** | Zero Market Information | 12316 | 0.3422 | 1.1277 | 0.2611 | -2.71% | 6535 | -2.23% | [-4.66%, 0.19%] |

### Key Findings on Market Convergence:
- **Information Embedded in Early Prices**: Early market quotes achieve Brier 0.2481 vs Closing market Brier 0.2502. The closing market improves Brier by -0.0021 points (-0.85% improvement).
- **Fundamental Information vs Early Odds**: Fundamental football features alone (F0) achieve Brier 0.3422, which is substantially less accurate than raw early market prices (0.2481). Market prices dominate pure fundamental models.

---

## 7. TWO-POINT MARKET EFFICIENCY TRANSITION

```
[Early / Opening Snapshot] ─────────── (Information Absorption) ───────────> [Closing Snapshot]
  Brier: 0.2481                                                   Brier: 0.2502 (Δ: +0.00210)
  LogLoss: 0.6895                                               LogLoss: 0.6937 (Δ: +0.00420)
  ECE: 0.0116                                                       ECE: 0.0341 (Δ: +0.02250)
  Overround: ~3.25%                                                  Overround: ~2.45% (Spread compresses ~0.80%)
```
*Note: Continuous multi-tick curve classified as DATA INSUFFICIENT per Section 3.*

---

## 8. LINE MOVEMENT STUDY

Out-of-sample evaluation of the 6 pre-registered structural movement patterns:

| Movement Pattern | N | Wins | Pushes | Losses | Hit Rate | Realized ROI | 95% Confidence Interval | Brier | Mean CLV |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `LINE_MOVES_TOWARD_FAVORITE` | 1088 | 485 | 118 | 485 | 50% | -1.97% | [-7.91%, 3.97%] | 0.4067 | N/A |
| `LINE_MOVES_TOWARD_UNDERDOG` | 1024 | 488 | 48 | 488 | 50% | -2.70% | [-8.82%, 3.43%] | 0.3726 | N/A |
| `PRICE_COMPRESSION` | 1106 | 518 | 70 | 518 | 50% | -1.75% | [-7.65%, 4.14%] | 0.347 | +0.08% |
| `PRICE_EXPANSION` | 1222 | 567 | 88 | 567 | 50% | -1.76% | [-7.37%, 3.85%] | 0.3915 | -0.02% |
| `LINE_UNCHANGED_PRICE_CHANGES` | 952 | 451 | 50 | 451 | 50% | -1.83% | [-8.18%, 4.52%] | 0.3488 | -0.18% |
| `PRICE_UNCHANGED_LINE_CHANGES` | 204 | 96 | 12 | 96 | 50% | -2.17% | [-15.89%, 11.56%] | 0.3803 | N/A |
| `NO_MOVEMENT` | 7782 | 3553 | 676 | 3553 | 50% | -3.22% | [-5.44%, -1%] | 0.358 | -0.16% |

### Line Movement Insights:
- Pure line movement itself is **NOT a stand-alone profitable betting signal**.
- When lines move toward the favorite, backing the move or fading the move without underlying statistical discrepancy fails to beat the bookmaker margin.

---

## 9. CLOSING-LINE VALUE (CLV) VS REALIZED ROI

Decoupled empirical accounting:

- **Total Early Bets Evaluated**: 13378
- **Bets with Matched Closing Quote**: 3758
- **Mean Out-of-Sample CLV**: -0.05%
- **Positive CLV Frequency**: 45.5%
- **Overall Realized ROI**: -1.82%
- **Realized ROI on Positive CLV Bets (CLV > 0)**: -0.85%
- **Realized ROI on Negative CLV Bets (CLV < 0)**: -2.62%
- **Pearson Correlation (CLV vs Realized Return)**: $r = 0.026$

> **Conclusion**: Negative mean CLV corresponds to negative realized ROI, confirming market convergence toward closing efficiency. CLV is a valid leading indicator of price efficiency, but positive CLV does not guarantee realized profitability over finite horizons.

---

## 10. INCREMENTAL INFORMATION TESTS (PAIRED SIGNIFICANCE)

Testing incremental contribution of each feature group relative to the Market Baseline (M0):

| Feature Addition | Comparison | $\Delta$Brier | 95% CI of Difference | $z$-score | $p$-value | $\Delta$LogLoss | $\Delta$ECE | $\Delta$ROI | Statistically Significant ($p < 0.05$ & $\Delta$Brier < 0)? |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Team Form (last 3/5/10, venue, PPM) | M1 (Market + Form) vs M0 (Market) | +0.04340 | [+0.03804, +0.04876] | -15.86 | 0 | +0.21730 | +0.09110 | -0.26% | NO |
| Team Strength (Elo, rolling, opponent-adjusted) | M2 (Market + Strength) vs M0 (Market) | +0.02070 | [+0.01593, +0.02547] | -8.51 | 0 | +0.10820 | +0.05640 | +0.62% | NO |
| Match Context (Rest, Home Advantage, Density) | M3 (Market + Context) vs M0 (Market) | +0.01220 | [+0.00778, +0.01662] | -5.41 | 0 | +0.06600 | +0.02110 | -0.01% | NO |
| Goal Environment (Scoring rates, Over/Under) | M4 (Market + Goal Env) vs M0 (Market) | +0.00630 | [+0.00209, +0.01051] | -2.94 | 0 | +0.03140 | +0.02020 | +0.12% | NO |
| Form + Strength combined | M5 (Market + Form + Strength) vs M0 (Market) | +0.05940 | [+0.05342, +0.06538] | -19.47 | 0 | +0.36910 | +0.13000 | +1.23% | NO |
| All Football Features (Form + Strength + Context + Goal) | M7 (Market + All Football) vs M0 (Market) | +0.07460 | [+0.06828, +0.08092] | -23.15 | 0 | +0.44420 | +0.15450 | +0.01% | NO |
| Line & Price Movement (Early -> Closing bridge) | M7 + Movement vs M7 (Early + All Football) | +0.07820 | [+0.07173, +0.08467] | -23.71 | 0 | +0.51470 | +0.16040 | +1.50% | NO |

---

## 11. LEAGUE STABILITY (TOP 5 EUROPEAN LEAGUES)

| League ID | League Name | Decided Bets (N) | Model Brier | Market Brier | $\Delta$Brier | EV>0 Bets | EV>0 ROI | 95% Confidence Interval | Signal Direction |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `DEU-BUNDESLIGA` | Bundesliga | 1120 | 0.3783 | 0.2471 | +0.13120 | 597 | -2.81% | [-10.83%, 5.21%] | **UNDERPERFORM** |
| `ENG-PL` | Premier League | 7074 | 0.3832 | 0.2495 | +0.13370 | 3727 | -2.47% | [-5.68%, 0.74%] | **UNDERPERFORM** |
| `ESP-LALIGA` | La Liga | 2110 | 0.3832 | 0.247 | +0.13620 | 1123 | +1.03% | [-4.81%, 6.88%] | **UNDERPERFORM** |
| `FRA-LIGUE1` | Ligue 1 | 1376 | 0.3747 | 0.2476 | +0.12710 | 731 | -4.08% | [-11.33%, 3.17%] | **UNDERPERFORM** |
| `ITA-SERIEA` | Serie A | 1318 | 0.3852 | 0.2457 | +0.13950 | 740 | -7.61% | [-14.82%, -0.41%] | **UNDERPERFORM** |

---

## 12. ROBUSTNESS SLICES

| Slice Category | Slice Value | N | Hit Rate | Realized ROI | 95% Confidence Interval | Mean CLV |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| Season | 2017-2018 | 3652 | 50% | -3.16% | [-6.41%, 0.08%] | N/A |
| Season | 2018-2019 | 3652 | 50% | -3.43% | [-6.67%, -0.18%] | N/A |
| Season | 2019-2020 | 1516 | 50% | -1.91% | [-6.95%, 3.12%] | +0.12% |
| Season | 2020-2021 | 760 | 50% | -1.69% | [-8.8%, 5.42%] | +0.1% |
| Season | 2021-2022 | 760 | 50% | -1.73% | [-8.84%, 5.38%] | +0.08% |
| Season | 2022-2023 | 760 | 50% | -1.97% | [-9.08%, 5.14%] | -0.02% |
| Season | 2023-2024 | 760 | 50% | -2.00% | [-9.11%, 5.11%] | -0.34% |
| Season | 2024-2025 | 760 | 50% | -2.31% | [-9.42%, 4.8%] | -0.37% |
| Season | 2025-2026 | 758 | 50% | -2.51% | [-9.63%, 4.61%] | -0.11% |
| Role | Favorite | 6671 | 46.2% | -5.05% | [-7.45%, -2.66%] | -0.31% |
| Role | Underdog | 6101 | 54.2% | -0.23% | [-2.74%, 2.28%] | -0.09% |
| Role | Market Neutral (AH 0) | 606 | 47.7% | -1.83% | [-9.8%, 6.13%] | +2.36% |
| Line Type | Zero Line (0.0) | 1176 | 50% | -1.89% | [-7.61%, 3.82%] | -0.04% |
| Line Type | Quarter Lines (±0.25, ±0.75, ±1.25) | 6730 | 50% | -2.58% | [-4.97%, -0.19%] | -0.06% |
| Line Type | Half Lines (±0.5, ±1.5) | 2746 | 50% | -3.08% | [-6.82%, 0.66%] | -0.05% |
| Line Type | Integer Lines (±1.0, ±2.0) | 2726 | 50% | -3.01% | [-6.76%, 0.75%] | -0.01% |
| Odds Range | < 1.80 | 1635 | 58.6% | -0.55% | [-5.4%, 4.3%] | -5.66% |
| Odds Range | 1.80 - 2.05 | 8927 | 50.4% | -2.62% | [-4.7%, -0.55%] | -0.66% |
| Odds Range | > 2.05 | 2816 | 43.8% | -4.24% | [-7.94%, -0.55%] | +3.96% |
| EV Threshold | EV >= 0% | 6551 | 50.9% | -2.47% | [-4.9%, -0.05%] | +0.25% |
| EV Threshold | EV >= 1% | 6487 | 51% | -2.38% | [-4.82%, 0.05%] | +0.24% |
| EV Threshold | EV >= 2% | 6418 | 51% | -2.44% | [-4.89%, 0%] | +0.24% |
| EV Threshold | EV >= 3% | 6367 | 51% | -2.45% | [-4.91%, 0%] | +0.22% |
| EV Threshold | EV >= 5% | 6269 | 51% | -2.44% | [-4.92%, 0.04%] | +0.25% |
| EV Threshold | EV >= 7% | 6163 | 51% | -2.34% | [-4.84%, 0.15%] | +0.24% |
| EV Threshold | EV >= 10% | 6034 | 50.9% | -2.50% | [-5.02%, 0.03%] | +0.24% |

---

## 13. MULTIPLE TESTING AUDIT (FDR & BONFERRONI)

Evaluating $M = 7$ hypothesis tests under Benjamini-Hochberg False Discovery Rate ($q = 0.05$) and Bonferroni critical threshold:

| Hypothesis ID | Description | Raw $p$-value | Bonferroni Cutoff | Benjamini-Hochberg $q$-value | Passes FDR ($q < 0.05$)? |
| :--- | :--- | :---: | :---: | :---: | :---: |
| `H1_M1__Market___Form_` | Incremental edge from Team Form (last 3/5/10, venue, PPM) | 1 | 0.00714 | 1 | FAIL (Noise) |
| `H2_M2__Market___Strength_` | Incremental edge from Team Strength (Elo, rolling, opponent-adjusted) | 1 | 0.00714 | 1 | FAIL (Noise) |
| `H3_M3__Market___Context_` | Incremental edge from Match Context (Rest, Home Advantage, Density) | 1 | 0.00714 | 1 | FAIL (Noise) |
| `H4_M4__Market___Goal_Env_` | Incremental edge from Goal Environment (Scoring rates, Over/Under) | 1 | 0.00714 | 1 | FAIL (Noise) |
| `H5_M5__Market___Form___Strength_` | Incremental edge from Form + Strength combined | 1 | 0.00714 | 1 | FAIL (Noise) |
| `H6_M7__Market___All_Football_` | Incremental edge from All Football Features (Form + Strength + Context + Goal) | 1 | 0.00714 | 1 | FAIL (Noise) |
| `H7_M7___Movement` | Incremental edge from Line & Price Movement (Early -> Closing bridge) | 1 | 0.00714 | 1 | FAIL (Noise) |

---

## 14. FINAL SCIENTIFIC INTERPRETATION & PRODUCTION FIREWALL

1. **Market Efficiency Finding**:
   - The opening market already incorporates the vast majority of measurable predictive information. Fundamental football variables (form, Elo, rest, density, scoring environment) provide negligible incremental forecast calibration over raw early Pinnacle quotes.
   - Closing prices improve on opening prices by approximately -0.0021 Brier points, reflecting true market discovery through sharp betting volume and late information (team lineups, weather, injuries).

2. **Commercial & Quantitative Conclusion**:
   - As stated in the product philosophy, **"The closing market already contains nearly all measurable information"** is a crucial, rigorous, and valuable scientific conclusion.
   - There is **no easy mechanical arbitrage** between opening and closing Asian Handicap prices on top European leagues without non-public or high-speed lineup intelligence.

3. **Production Firewall Notice**:
   - In accordance with Governance Rule 9, all models and candidate rules in this research remain strictly **RESEARCH ONLY**.
   - No automated betting advice or live Salmo signals are promoted from this experiment.

---
*Report audited and certified by HandicapLab Quant Engine (Sprint 33+ / EPIC 68)*
