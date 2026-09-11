# AH PROBABILITY & EDGE VALIDATION REPORT

- **Engine**: ah-edge-v1
- **Generated**: 2026-09-11T17:38:03.552Z
- **Primary cohort**: pinnacle_closing — Genuine Pinnacle closing AH quotes (EPL 2019-20..2025-26 + La Liga 2019-20)

## 1. DATA USED

| Cohort | Matches | With ML | With OU | With AH open | Seasons | Leagues |
| --- | --- | --- | --- | --- | --- | --- |
| pinnacle_closing | 3040 | 3040 | 3040 | 3037 | 2019-2020 → 2025-2026 | ENG-PL, ESP-LALIGA |
| pinnacle_opening | 3037 | 3037 | 3037 | 0 | 2019-2020 → 2025-2026 | ENG-PL, ESP-LALIGA |
| betbrain_single | 5858 | 5856 | 0 | 0 | 2015-2016 → 2018-2019 | DEU-BUNDESLIGA, ENG-PL, ESP-LALIGA, FRA-LIGUE1, ITA-SERIEA |

## 2. FEATURE INVENTORY

| Feature | Group | Source | Timestamp | Lookback | Leakage risk | Missingness |
| --- | --- | --- | --- | --- | --- | --- |
| AH line / prices (own perspective) | market | market_odds.jsonl (selected cohort snapshot + bookmaker) | pre-match snapshot (opening/closing label; no exact timestamp) | same match | none for the bet priced at that snapshot; closing odds are NOT used as features when evaluating opening | 0% by cohort construction |
| Opening→closing line movement | market | market_odds.jsonl opening vs closing rows | opening observed before closing snapshot | same match | none at closing; excluded automatically when no opening quote exists | 0.0% |
| 1X2 devig probabilities (own/draw/opponent) | market | market_odds.jsonl ML rows, proportional devig | same snapshot as evaluation | same match | none (pre-match) | 0% for the pinnacle cohort (checked in dataset coverage) |
| Over 2.5 devig probability | market | market_odds.jsonl OU rows, proportional devig | same snapshot | same match | none | 0% for the pinnacle cohort |
| Points/goals form last 5 matches | form | canonical_matches.jsonl prior results only | strictly earlier calendar dates | 5 matches | none (same-day matches excluded by date-group processing) | 0.8% home / 0.8% away (first matches of dataset) |
| Rest days | rest | canonical_matches.jsonl prior match dates | strictly earlier calendar dates | last match (cap 30 days) | none | 1.6% (first matches of dataset) |
| Sequential Elo rating | elo | canonical_matches.jsonl prior results only (K=20, HA=60) | updated only after a match is played | all prior matches in dataset | none (matches updated in date order after prediction) | 0.8% home / 0.8% away default 1500 |
| Season-to-date points/goals per match | form | canonical_matches.jsonl prior matches in same season | strictly earlier dates | current season only | none (no future season aggregates) | first match of each season starts at 0 (explicit neutral value) |
| Expanding league goals environment + home advantage | league | canonical_matches.jsonl prior matches (league, then global fallback) | strictly earlier dates; cross-season expansion | all prior matches | none | 0.1% (first matches of each league fall back to global, then static priors) |

## 3. FEATURE LEAKAGE AUDIT

| Check | Method | Result |
| --- | --- | --- |
| Feature-flip test (future result changed) | tests/ah-edge/leakage.test.ts — mutate a later match result and assert earlier features/predictions are byte-identical | PASS |
| Same-day contamination | features computed per calendar-date group, state updated only after all same-day features are emitted | PASS |
| Walk-forward ordering | train seasons strictly before test season; folds are chronological and never shuffled | PASS |
| Closing odds used at opening evaluation | feature builder uses only the evaluation snapshot for the AH quote; opening evaluation has no closing fields | PASS |
| Target leakage | settlement outcomes used only as labels, never as features | PASS |

## 4. BASELINES & 5. MODELS

| Model | N (decided) | Brier | LogLoss | 5-class LogLoss | ECE | All-bets ROI | EV>0 bets | EV>0 ROI | EV>0 95% CI |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Poisson GLM goals (market+form+rest+elo+league) | 3556 | 0.2507 | 0.6948 | 0.9866 | 0.0308 | -1.80% | 1271 | -0.78% | [-5.76%, +4.20%] |
| Market baseline (Poisson fitted to devigged 1X2) | 3556 | 0.2512 | 0.6958 | 0.9853 | 0.0361 | -1.80% | 295 | -4.63% | [-14.83%, +5.58%] |
| Softmax outcome classifier -> Poisson (market+form+rest+elo+league) | 3556 | 0.2533 | 0.7003 | 0.9948 | 0.0471 | -1.80% | 1576 | -1.27% | [-5.73%, +3.19%] |
| Historical line/side settlement prior (train seasons) | 3556 | 0.2544 | 0.7028 | 1.0216 | 0.0619 | -1.80% | 1572 | -0.89% | [-5.41%, +3.63%] |
| Elo rating baseline (Poisson fitted to Elo outcome probability) | 3556 | 0.2584 | 0.7110 | 1.0065 | 0.0819 | -1.80% | 1744 | -2.25% | [-6.48%, +1.97%] |
| Recent-form Poisson (shrunk team scoring rates) | 3556 | 0.2757 | 0.7552 | 1.0523 | 0.1361 | -1.80% | 1819 | -1.48% | [-5.60%, +2.64%] |

**Market baseline** (devigged two-way AH price, same bets): N=3556, Brier=0.2499, LogLoss=0.6930, ECE=0.0089.

### Secondary cohorts (context only — not used for the verdict)

| Cohort | Market Brier | Best model | Model Brier | EV>0 bets | EV>0 ROI | 95% CI | Folds positive |
| --- | --- | --- | --- | --- | --- | --- | --- |
| pinnacle_opening | 0.2495 | poisson_glm | 0.2499 | 1207 | +3.38% | [-1.67%, +8.44%] | 3/5 |
| betbrain_single | 0.2466 | market_poisson | 0.2478 | 2163 | +2.93% | [-0.71%, +6.56%] | 2/2 |

## 6. CALIBRATION

Calibration curve for best model (Poisson GLM goals (market+form+rest+elo+league)):

| Bucket | N | Predicted | Observed | Gap |
| --- | --- | --- | --- | --- |
| 20–30% | 4 | 29.1% | 50.0% | 20.9pp |
| 30–40% | 697 | 36.9% | 47.5% | 10.6pp |
| 40–50% | 1423 | 45.0% | 46.7% | 1.6pp |
| 50–60% | 1294 | 54.7% | 54.2% | -0.5pp |
| 60–70% | 138 | 61.7% | 58.0% | -3.8pp |

## 7. WALK-FORWARD METHODOLOGY

- **temporal**: Season walk-forward: train on ALL seasons strictly earlier than the test season; no shuffling; features use strictly earlier calendar dates only.
- **target**: Settlement-aware 5-category distribution {FULL_WIN, HALF_WIN, PUSH, HALF_LOSS, FULL_LOSS} derived exactly from a goal-difference PMF using the validated quarter-line split rules.
- **models**: Market Poisson baseline (devigged 1X2 fitted), historical line/side prior, recent-form Poisson, Elo baseline, Poisson GLM goals, softmax outcome classifier mapped to Poisson.
- **threshold**: Thresholds 0/1/2/3/5/7/10% EV are all reported OOS; the "selected" threshold per fold is chosen on an inner train/validation split inside the training window only.
- **marketComparison**: Market probability = proportional two-way devig of the exact AH pair; market EV = p_market·(o−1) − (1−p_market). Paired squared-error difference with 95% CI.
- **evaluation**: Brier, log loss and ECE on the binary profit event (pushes excluded), 5-class log loss on the settlement category, realized ROI with analytic 95% CI, drawdown, per-fold stability.

## 8. OUT-OF-SAMPLE RESULTS

| Fold | Test season | Train seasons | Test matches | Bets | Market Brier |
| --- | --- | --- | --- | --- | --- |
| 1 | 2021-2022 | 2019-2020,2020-2021 | 380 | 760 | 0.2498 |
| 2 | 2022-2023 | 2019-2020,2020-2021,2021-2022 | 380 | 760 | 0.2488 |
| 3 | 2023-2024 | 2019-2020,2020-2021,2021-2022,2022-2023 | 380 | 760 | 0.2497 |
| 4 | 2024-2025 | 2019-2020,2020-2021,2021-2022,2022-2023,2023-2024 | 380 | 760 | 0.2485 |
| 5 | 2025-2026 | 2019-2020,2020-2021,2021-2022,2022-2023,2023-2024,2024-2025 | 380 | 760 | 0.2529 |

- Poisson GLM goals (market+form+rest+elo+league): paired Brier diff vs market = 0.0008 (95% CI [-0.0017, 0.0033], z=0.61).
- Market baseline (Poisson fitted to devigged 1X2): paired Brier diff vs market = 0.0013 (95% CI [-0.0012, 0.0037], z=1.00).
- Softmax outcome classifier -> Poisson (market+form+rest+elo+league): paired Brier diff vs market = 0.0033 (95% CI [0.0004, 0.0063], z=2.25).
- Historical line/side settlement prior (train seasons): paired Brier diff vs market = 0.0045 (95% CI [0.0012, 0.0079], z=2.66).
- Elo rating baseline (Poisson fitted to Elo outcome probability): paired Brier diff vs market = 0.0084 (95% CI [0.0049, 0.0119], z=4.71).
- Recent-form Poisson (shrunk team scoring rates): paired Brier diff vs market = 0.0258 (95% CI [0.0202, 0.0313], z=9.11).

## 9–10. ROI & EV COMPARISON VS MARKET

| Model | EV>0 ROI | EV>0 95% CI | Max DD | Selected-threshold ROI | Positive folds | Thresholds used |
| --- | --- | --- | --- | --- | --- | --- |
| Poisson GLM goals (market+form+rest+elo+league) | -0.78% | [-5.76%, +4.20%] | 39.5 | +1.36% | 4/5 | {"0":1,"0.05":1,"0.02":1,"0.03":2} |
| Market baseline (Poisson fitted to devigged 1X2) | -4.63% | [-14.83%, +5.58%] | 22.2 | -4.63% | 0/5 | {"0":5} |
| Softmax outcome classifier -> Poisson (market+form+rest+elo+league) | -1.27% | [-5.73%, +3.19%] | 43.0 | -2.56% | 1/5 | {"0":1,"0.03":1,"0.1":1,"0.05":2} |
| Historical line/side settlement prior (train seasons) | -0.89% | [-5.41%, +3.63%] | 61.4 | +2.43% | 3/5 | {"0":1,"0.1":2,"0.07":2} |
| Elo rating baseline (Poisson fitted to Elo outcome probability) | -2.25% | [-6.48%, +1.97%] | 64.5 | -1.88% | 2/5 | {"0.03":1,"0.02":1,"0.07":2,"0.1":1} |
| Recent-form Poisson (shrunk team scoring rates) | -1.48% | [-5.60%, +2.64%] | 55.4 | -0.86% | 2/5 | {"0":1,"0.1":2,"0.07":2} |

### EV threshold sweep (all thresholds reported OOS; selected per fold on inner validation only)

| Model | Threshold | N | P&L | ROI | 95% CI | Max DD | Positive folds | Median fold | Worst fold | Best fold |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Poisson GLM goals (market+form+rest+elo+league) | +0% | 1271 | -9.9 | -0.78% | [-5.76%, +4.20%] | 39.5 | 2/5 | -1.07% | -8.18% | +9.38% |
| Poisson GLM goals (market+form+rest+elo+league) | +1% | 986 | -10.5 | -1.07% | [-6.72%, +4.59%] | 37.8 | 2/5 | -0.87% | -12.01% | +6.13% |
| Poisson GLM goals (market+form+rest+elo+league) | +2% | 751 | 0.9 | +0.12% | [-6.36%, +6.60%] | 22.6 | 4/5 | +1.00% | -7.75% | +6.05% |
| Poisson GLM goals (market+form+rest+elo+league) | +3% | 559 | 2.9 | +0.52% | [-6.96%, +8.00%] | 15.3 | 3/5 | +0.82% | -5.94% | +7.98% |
| Poisson GLM goals (market+form+rest+elo+league) | +5% | 301 | 18.7 | +6.23% | [-3.99%, +16.45%] | 9.2 | 3/5 | +6.94% | -2.74% | +19.77% |
| Poisson GLM goals (market+form+rest+elo+league) | +7% | 156 | 4.6 | +2.93% | [-11.59%, +17.46%] | 7.2 | 2/5 | -0.39% | -6.77% | +24.37% |
| Poisson GLM goals (market+form+rest+elo+league) | +10% | 69 | 3.0 | +4.41% | [-17.38%, +26.19%] | 3.7 | 2/5 | +0.00% | -5.64% | +43.43% |
| Market baseline (Poisson fitted to devigged 1X2) | +0% | 295 | -13.6 | -4.63% | [-14.83%, +5.58%] | 22.2 | 0/5 | -1.05% | -16.56% | -0.20% |
| Market baseline (Poisson fitted to devigged 1X2) | +1% | 122 | -10.7 | -8.80% | [-24.95%, +7.35%] | 17.2 | 1/5 | -7.16% | -26.33% | +18.65% |
| Market baseline (Poisson fitted to devigged 1X2) | +2% | 61 | 0.6 | +1.00% | [-21.90%, +23.90%] | 9.0 | 3/5 | +1.19% | -20.00% | +59.20% |
| Market baseline (Poisson fitted to devigged 1X2) | +3% | 41 | -0.6 | -1.40% | [-29.23%, +26.43%] | 8.0 | 1/5 | -5.83% | -16.63% | +99.33% |
| Market baseline (Poisson fitted to devigged 1X2) | +5% | 15 | -3.7 | -24.67% | [-70.49%, +21.15%] | 6.5 | 1/5 | -21.00% | -100.00% | +89.00% |
| Market baseline (Poisson fitted to devigged 1X2) | +7% | 7 | -2.7 | -38.29% | [-105.10%, +28.53%] | 3.6 | 0/5 | -19.00% | -100.00% | +0.00% |
| Market baseline (Poisson fitted to devigged 1X2) | +10% | 3 | 0.8 | +27.33% | [-97.47%, +152.14%] | 1.0 | 1/5 | +0.00% | -3.50% | +89.00% |
| Softmax outcome classifier -> Poisson (market+form+rest+elo+league) | +0% | 1576 | -20.0 | -1.27% | [-5.73%, +3.19%] | 43.0 | 2/5 | -1.59% | -5.97% | +4.84% |
| Softmax outcome classifier -> Poisson (market+form+rest+elo+league) | +1% | 1393 | -15.5 | -1.11% | [-5.86%, +3.63%] | 40.8 | 2/5 | -2.55% | -5.31% | +6.16% |
| Softmax outcome classifier -> Poisson (market+form+rest+elo+league) | +2% | 1211 | -26.9 | -2.22% | [-7.32%, +2.88%] | 41.5 | 2/5 | -3.53% | -6.93% | +3.02% |
| Softmax outcome classifier -> Poisson (market+form+rest+elo+league) | +3% | 1054 | -14.6 | -1.39% | [-6.85%, +4.08%] | 34.2 | 3/5 | +0.20% | -6.25% | +3.65% |
| Softmax outcome classifier -> Poisson (market+form+rest+elo+league) | +5% | 814 | -19.6 | -2.41% | [-8.60%, +3.78%] | 36.5 | 2/5 | -4.19% | -8.23% | +3.94% |
| Softmax outcome classifier -> Poisson (market+form+rest+elo+league) | +7% | 578 | -17.4 | -3.00% | [-10.37%, +4.37%] | 32.5 | 2/5 | -1.26% | -7.84% | +3.32% |
| Softmax outcome classifier -> Poisson (market+form+rest+elo+league) | +10% | 345 | -13.8 | -4.01% | [-13.62%, +5.60%] | 25.7 | 1/5 | -5.43% | -6.55% | +7.38% |
| Historical line/side settlement prior (train seasons) | +0% | 1572 | -14.0 | -0.89% | [-5.41%, +3.63%] | 61.4 | 1/5 | -2.26% | -4.92% | +10.27% |
| Historical line/side settlement prior (train seasons) | +1% | 1422 | -19.8 | -1.39% | [-6.15%, +3.36%] | 59.3 | 1/5 | -3.79% | -6.29% | +11.95% |
| Historical line/side settlement prior (train seasons) | +2% | 1283 | -19.5 | -1.52% | [-6.55%, +3.51%] | 48.4 | 1/5 | -3.21% | -5.70% | +9.38% |
| Historical line/side settlement prior (train seasons) | +3% | 1129 | -18.1 | -1.60% | [-6.96%, +3.75%] | 48.0 | 1/5 | -3.95% | -4.14% | +8.52% |
| Historical line/side settlement prior (train seasons) | +5% | 877 | -2.4 | -0.27% | [-6.37%, +5.82%] | 37.0 | 1/5 | -1.09% | -7.50% | +16.96% |
| Historical line/side settlement prior (train seasons) | +7% | 658 | -5.4 | -0.82% | [-7.84%, +6.21%] | 22.7 | 3/5 | +0.63% | -12.79% | +6.08% |
| Historical line/side settlement prior (train seasons) | +10% | 448 | 6.2 | +1.37% | [-7.11%, +9.86%] | 16.3 | 3/5 | +0.05% | -15.46% | +22.81% |
| Elo rating baseline (Poisson fitted to Elo outcome probability) | +0% | 1744 | -39.3 | -2.25% | [-6.48%, +1.97%] | 64.5 | 2/5 | -0.31% | -11.92% | +4.85% |
| Elo rating baseline (Poisson fitted to Elo outcome probability) | +1% | 1650 | -40.3 | -2.44% | [-6.79%, +1.91%] | 64.9 | 3/5 | +0.34% | -13.58% | +4.38% |
| Elo rating baseline (Poisson fitted to Elo outcome probability) | +2% | 1546 | -41.1 | -2.66% | [-7.15%, +1.84%] | 65.8 | 2/5 | -0.39% | -15.09% | +5.32% |
| Elo rating baseline (Poisson fitted to Elo outcome probability) | +3% | 1463 | -49.8 | -3.40% | [-8.02%, +1.21%] | 71.8 | 2/5 | -1.06% | -16.33% | +3.95% |
| Elo rating baseline (Poisson fitted to Elo outcome probability) | +5% | 1270 | -32.3 | -2.54% | [-7.51%, +2.43%] | 58.5 | 2/5 | -0.31% | -17.24% | +7.48% |
| Elo rating baseline (Poisson fitted to Elo outcome probability) | +7% | 1109 | -14.5 | -1.31% | [-6.61%, +3.99%] | 41.0 | 3/5 | +0.76% | -15.17% | +6.93% |
| Elo rating baseline (Poisson fitted to Elo outcome probability) | +10% | 878 | -11.7 | -1.33% | [-7.31%, +4.65%] | 28.7 | 2/5 | -0.59% | -11.54% | +5.74% |
| Recent-form Poisson (shrunk team scoring rates) | +0% | 1819 | -26.9 | -1.48% | [-5.60%, +2.64%] | 55.4 | 2/5 | -1.14% | -7.73% | +2.82% |
| Recent-form Poisson (shrunk team scoring rates) | +1% | 1761 | -22.8 | -1.29% | [-5.48%, +2.90%] | 52.9 | 2/5 | -0.97% | -8.01% | +3.24% |
| Recent-form Poisson (shrunk team scoring rates) | +2% | 1715 | -35.1 | -2.05% | [-6.29%, +2.20%] | 57.5 | 2/5 | -1.57% | -8.44% | +2.33% |
| Recent-form Poisson (shrunk team scoring rates) | +3% | 1662 | -27.6 | -1.66% | [-5.97%, +2.65%] | 56.9 | 2/5 | -2.19% | -8.21% | +4.31% |
| Recent-form Poisson (shrunk team scoring rates) | +5% | 1576 | -20.2 | -1.28% | [-5.71%, +3.15%] | 52.0 | 2/5 | -0.45% | -9.05% | +5.09% |
| Recent-form Poisson (shrunk team scoring rates) | +7% | 1473 | -3.5 | -0.24% | [-4.83%, +4.35%] | 44.4 | 3/5 | +0.29% | -8.54% | +5.65% |
| Recent-form Poisson (shrunk team scoring rates) | +10% | 1363 | 0.3 | +0.02% | [-4.74%, +4.78%] | 39.5 | 2/5 | -0.35% | -6.68% | +7.15% |

## 11. AH-LINE BREAKDOWN (primary cohort, EV>0 selection)

| Line | Model | Bets | Brier | Market Brier | EV>0 bets | EV>0 ROI | 95% CI |
| --- | --- | --- | --- | --- | --- | --- | --- |
| -3 | market_poisson | 6 | 0.2720 | 0.2419 | 3 | -37.00% | [-160.48%, +86.48%] |
| -2.75 | market_poisson | 14 | 0.2459 | 0.2437 | 3 | +33.00% | [-97.34%, +163.34%] |
| -2.5 | market_poisson | 28 | 0.2443 | 0.2449 | 10 | -1.70% | [-66.00%, +62.60%] |
| -2.25 | market_poisson | 40 | 0.2349 | 0.2473 | 8 | -43.81% | [-97.26%, +9.63%] |
| -2 | market_poisson | 60 | 0.2570 | 0.2424 | 24 | -18.13% | [-50.00%, +13.75%] |
| -1.75 | market_poisson | 124 | 0.2532 | 0.2497 | 30 | +18.77% | [-13.64%, +51.18%] |
| -1.5 | market_poisson | 148 | 0.2534 | 0.2544 | 26 | -1.65% | [-40.32%, +37.02%] |
| -1.25 | market_poisson | 194 | 0.2417 | 0.2512 | 26 | +10.81% | [-22.97%, +44.58%] |
| -1 | market_poisson | 210 | 0.2679 | 0.2521 | 68 | -1.81% | [-21.87%, +18.25%] |
| -0.75 | market_poisson | 346 | 0.2443 | 0.2521 | 11 | -32.45% | [-83.53%, +18.62%] |
| -0.5 | market_poisson | 390 | 0.2512 | 0.2513 | 2 | +3.50% | [-199.36%, +206.36%] |
| -0.25 | market_poisson | 510 | 0.2444 | 0.2482 | 3 | -34.33% | [-163.04%, +94.37%] |
| 0 | market_poisson | 290 | 0.2696 | 0.2490 | 1 | +110.00% | [+110.00%, +110.00%] |
| +0.25 | market_poisson | 394 | 0.2497 | 0.2492 | 4 | -48.75% | [-149.20%, +51.70%] |
| +0.5 | market_poisson | 278 | 0.2499 | 0.2502 | 2 | +92.00% | [+70.44%, +113.56%] |
| +0.75 | market_poisson | 204 | 0.2412 | 0.2483 | 2 | -75.00% | [-124.00%, -26.00%] |
| +1 | market_poisson | 110 | 0.2637 | 0.2474 | 32 | +0.91% | [-29.39%, +31.20%] |
| +1.25 | market_poisson | 76 | 0.2476 | 0.2503 | 10 | -7.40% | [-68.80%, +54.00%] |
| +1.5 | market_poisson | 82 | 0.2516 | 0.2504 | 13 | -23.31% | [-78.34%, +31.72%] |
| +1.75 | market_poisson | 30 | 0.2675 | 0.2573 | 9 | +0.78% | [-63.14%, +64.69%] |
| +2 | market_poisson | 16 | 0.2651 | 0.2426 | 7 | -40.43% | [-102.59%, +21.73%] |
| +2.25 | market_poisson | 4 | 0.1875 | 0.2241 | 1 | -100.00% | [-100.00%, -100.00%] |
| +2.5 | market_poisson | 2 | 0.2795 | 0.2872 | 0 | +0.00% | [+0.00%, +0.00%] |
| -3 | poisson_glm | 6 | 0.2151 | 0.2419 | 3 | +91.00% | [+88.01%, +93.99%] |
| -2.75 | poisson_glm | 14 | 0.2516 | 0.2437 | 5 | -22.60% | [-115.59%, +70.39%] |
| -2.5 | poisson_glm | 28 | 0.2652 | 0.2449 | 13 | -25.15% | [-78.81%, +28.50%] |
| -2.25 | poisson_glm | 40 | 0.2132 | 0.2473 | 19 | +27.87% | [-8.57%, +64.30%] |
| -2 | poisson_glm | 60 | 0.2443 | 0.2424 | 38 | +14.92% | [-10.58%, +40.42%] |
| -1.75 | poisson_glm | 124 | 0.2546 | 0.2497 | 50 | +4.79% | [-20.14%, +29.72%] |
| -1.5 | poisson_glm | 148 | 0.2545 | 0.2544 | 56 | +1.88% | [-24.15%, +27.90%] |
| -1.25 | poisson_glm | 194 | 0.2397 | 0.2512 | 72 | +1.67% | [-19.07%, +22.41%] |
| -1 | poisson_glm | 210 | 0.2662 | 0.2521 | 101 | +7.74% | [-9.20%, +24.68%] |
| -0.75 | poisson_glm | 346 | 0.2441 | 0.2521 | 124 | +3.52% | [-12.15%, +19.20%] |
| -0.5 | poisson_glm | 390 | 0.2498 | 0.2513 | 125 | +7.43% | [-9.92%, +24.78%] |
| -0.25 | poisson_glm | 510 | 0.2438 | 0.2482 | 133 | -3.27% | [-18.34%, +11.80%] |
| 0 | poisson_glm | 290 | 0.2710 | 0.2490 | 117 | -23.22% | [-38.14%, -8.31%] |
| +0.25 | poisson_glm | 394 | 0.2502 | 0.2492 | 128 | -4.76% | [-20.14%, +10.63%] |
| +0.5 | poisson_glm | 278 | 0.2516 | 0.2502 | 85 | -4.89% | [-26.00%, +16.22%] |
| +0.75 | poisson_glm | 204 | 0.2425 | 0.2483 | 66 | -12.87% | [-34.46%, +8.72%] |
| +1 | poisson_glm | 110 | 0.2631 | 0.2474 | 53 | -1.55% | [-25.64%, +22.54%] |
| +1.25 | poisson_glm | 76 | 0.2516 | 0.2503 | 30 | -12.73% | [-45.23%, +19.76%] |
| +1.5 | poisson_glm | 82 | 0.2476 | 0.2504 | 27 | +16.56% | [-20.69%, +53.80%] |
| +1.75 | poisson_glm | 30 | 0.2584 | 0.2573 | 14 | +26.50% | [-18.49%, +71.49%] |
| +2 | poisson_glm | 16 | 0.2640 | 0.2426 | 9 | +8.33% | [-50.68%, +67.34%] |
| +2.25 | poisson_glm | 4 | 0.1283 | 0.2241 | 2 | +84.00% | [+66.36%, +101.64%] |
| +2.5 | poisson_glm | 2 | 0.3889 | 0.2872 | 1 | -100.00% | [-100.00%, -100.00%] |
| -3 | softmax_glm | 6 | 0.2766 | 0.2419 | 3 | -37.00% | [-160.48%, +86.48%] |
| -2.75 | softmax_glm | 14 | 0.2959 | 0.2437 | 7 | -71.57% | [-127.29%, -15.85%] |
| -2.5 | softmax_glm | 28 | 0.2540 | 0.2449 | 13 | -39.92% | [-90.96%, +11.11%] |
| -2.25 | softmax_glm | 40 | 0.2518 | 0.2473 | 20 | -26.20% | [-63.41%, +11.01%] |
| -2 | softmax_glm | 60 | 0.2814 | 0.2424 | 40 | -26.05% | [-50.64%, -1.46%] |
| -1.75 | softmax_glm | 124 | 0.2666 | 0.2497 | 58 | -16.04% | [-39.36%, +7.27%] |
| -1.5 | softmax_glm | 148 | 0.2507 | 0.2544 | 67 | +0.97% | [-23.06%, +25.00%] |
| -1.25 | softmax_glm | 194 | 0.2518 | 0.2512 | 83 | -5.78% | [-24.89%, +13.33%] |
| -1 | softmax_glm | 210 | 0.2701 | 0.2521 | 129 | -3.17% | [-17.90%, +11.56%] |
| -0.75 | softmax_glm | 346 | 0.2445 | 0.2521 | 139 | +4.50% | [-10.29%, +19.28%] |
| -0.5 | softmax_glm | 390 | 0.2482 | 0.2513 | 144 | +13.35% | [-2.61%, +29.31%] |
| -0.25 | softmax_glm | 510 | 0.2448 | 0.2482 | 201 | -0.21% | [-12.34%, +11.91%] |
| 0 | softmax_glm | 290 | 0.2722 | 0.2490 | 164 | -1.07% | [-14.16%, +12.02%] |
| +0.25 | softmax_glm | 394 | 0.2471 | 0.2492 | 155 | +14.13% | [+0.25%, +28.02%] |
| +0.5 | softmax_glm | 278 | 0.2539 | 0.2502 | 115 | -7.61% | [-25.66%, +10.45%] |
| +0.75 | softmax_glm | 204 | 0.2376 | 0.2483 | 85 | +0.21% | [-18.58%, +19.01%] |
| +1 | softmax_glm | 110 | 0.2685 | 0.2474 | 57 | -9.79% | [-32.15%, +12.57%] |
| +1.25 | softmax_glm | 76 | 0.2452 | 0.2503 | 32 | +17.67% | [-14.31%, +49.65%] |
| +1.5 | softmax_glm | 82 | 0.2525 | 0.2504 | 37 | -15.19% | [-46.99%, +16.61%] |
| +1.75 | softmax_glm | 30 | 0.2680 | 0.2573 | 14 | -1.43% | [-48.99%, +46.13%] |
| +2 | softmax_glm | 16 | 0.3145 | 0.2426 | 10 | -51.70% | [-93.10%, -10.30%] |
| +2.25 | softmax_glm | 4 | 0.1710 | 0.2241 | 2 | -12.50% | [-184.00%, +159.00%] |
| +2.5 | softmax_glm | 2 | 0.3808 | 0.2872 | 1 | -100.00% | [-100.00%, -100.00%] |

## 12. FAVORITE / UNDERDOG

| Direction | Model | Bets | Brier | Market Brier | EV>0 bets | EV>0 ROI |
| --- | --- | --- | --- | --- | --- | --- |
| favorite | poisson_glm | 1633 | 0.2483 | 0.2500 | 552 | +1.28% |
| market_neutral | poisson_glm | 290 | 0.2710 | 0.2490 | 117 | -23.22% |
| underdog | poisson_glm | 1633 | 0.2495 | 0.2500 | 602 | +1.70% |

## 13. LEAGUE BREAKDOWN & GENERALIZATION

| League | Model | Bets | Brier | Market Brier | EV>0 bets | EV>0 ROI |
| --- | --- | --- | --- | --- | --- | --- |
| ENG-PL | poisson_glm | 3556 | 0.2507 | 0.2499 | 1271 | -0.78% |

**Leave-one-league-out** (train on other leagues strictly earlier, test on held-out league):

| Held-out league | Seasons tested | Bets | Model Brier | Market Brier | EV>0 bets | EV>0 ROI |
| --- | --- | --- | --- | --- | --- | --- |
| DEU-BUNDESLIGA | 2017-2018,2018-2019 | 1120 | 0.2479 | 0.2471 | 376 | +6.15% |
| ENG-PL | 2017-2018,2018-2019 | 1422 | 0.2501 | 0.2476 | 515 | -1.90% |
| ESP-LALIGA | 2017-2018,2018-2019 | 1418 | 0.2439 | 0.2452 | 493 | +3.85% |
| FRA-LIGUE1 | 2017-2018,2018-2019 | 1376 | 0.2499 | 0.2476 | 434 | +0.12% |
| ITA-SERIEA | 2017-2018,2018-2019 | 1318 | 0.2520 | 0.2457 | 517 | -3.23% |

## 14. FEATURE ABLATION (Poisson GLM, OOS)

| Feature groups | Brier | LogLoss | 5-class LL | Market Brier | Paired diff 95% CI | EV>0 bets | EV>0 ROI |
| --- | --- | --- | --- | --- | --- | --- | --- |
| market | 0.2506 | 0.6945 | 0.9856 | 0.2499 | [-0.0017, 0.0031] | 896 | +1.78% |
| market+form | 0.2505 | 0.6945 | 0.9861 | 0.2499 | [-0.0018, 0.0031] | 1193 | -1.78% |
| market+form+rest | 0.2504 | 0.6943 | 0.9859 | 0.2499 | [-0.0020, 0.0030] | 1203 | -0.68% |
| market+form+rest+elo | 0.2507 | 0.6947 | 0.9864 | 0.2499 | [-0.0018, 0.0032] | 1201 | -0.59% |
| market+form+rest+elo+league | 0.2507 | 0.6948 | 0.9866 | 0.2499 | [-0.0017, 0.0033] | 1271 | -0.78% |

## 15. DRAWDOWN

| Model | EV>0 Max DD | Selected-threshold Max DD |
| --- | --- | --- |
| Poisson GLM goals (market+form+rest+elo+league) | 39.5 | 20.7 |
| Market baseline (Poisson fitted to devigged 1X2) | 22.2 | 18.1 |
| Softmax outcome classifier -> Poisson (market+form+rest+elo+league) | 43.0 | 20.1 |
| Historical line/side settlement prior (train seasons) | 61.4 | 14.7 |
| Elo rating baseline (Poisson fitted to Elo outcome probability) | 64.5 | 39.5 |
| Recent-form Poisson (shrunk team scoring rates) | 55.4 | 30.3 |

## 16. STATISTICAL UNCERTAINTY

All ROI figures carry analytic 95% confidence intervals on per-bet returns. Model-vs-market comparisons use the paired squared-error difference with normal-approximation CI. Small-sample line/side cells are not used for any verdict and are marked by N.

## 17. FAILURE CASES

- poisson_glm: worst fold 2022-2023 ROI -7.75% on 167 selected bets.
- poisson_glm: EV>0 selection loses -0.78% OOS over 1271 bets (market is efficient in aggregate).
- market_poisson: worst fold 2023-2024 ROI -16.56% on 64 selected bets.
- market_poisson: EV>0 selection loses -4.63% OOS over 295 bets (market is efficient in aggregate).
- softmax_glm: worst fold 2022-2023 ROI -6.55% on 86 selected bets.
- softmax_glm: EV>0 selection loses -1.27% OOS over 1576 bets (market is efficient in aggregate).
- league_line_prior: worst fold 2024-2025 ROI -12.79% on 95 selected bets.
- league_line_prior: EV>0 selection loses -0.89% OOS over 1572 bets (market is efficient in aggregate).
- elo_poisson: worst fold 2024-2025 ROI -15.17% on 224 selected bets.
- elo_poisson: EV>0 selection loses -2.25% OOS over 1744 bets (market is efficient in aggregate).
- form_poisson: worst fold 2022-2023 ROI -8.54% on 307 selected bets.
- form_poisson: EV>0 selection loses -1.48% OOS over 1819 bets (market is efficient in aggregate).

## 18. RESEARCH LIMITATIONS

- No exact odds timestamps exist; opening/closing labels are the only snapshot information (T-24h/T-6h/T-1h unavailable).
- Features are limited to the frozen canonical dataset (results, dates, league, market prices). No xG/shots/possession/lineups were used in v1; external sources would require identity mapping and kickoff-aligned timestamps.
- The market baseline is the devigged two-way AH price for the exact bet (proportional devig, binary approximation); a full five-category market distribution is not identifiable from two prices.
- Pinnacle genuine quotes start in 2019-20 (EPL + one La Liga season); earlier leagues are BetBrain consensus aggregates.
- Model selection was kept minimal (Poisson GLM / softmax on 19 features) to avoid data mining; no hyperparameter search was performed.
- Threshold selection uses one inner train/validation split per fold; a single inner split is weaker than nested cross-validation.
- Context only (pinnacle_opening, NOT part of the verdict): best model poisson_glm Brier 0.2499 vs market 0.2495, EV>0 selection 1207 bets at 3.38% (95% CI [-1.67%, 8.44%]).
- Context only (betbrain_single, NOT part of the verdict): best model market_poisson Brier 0.2478 vs market 0.2466, EV>0 selection 2163 bets at 2.93% (95% CI [-0.71%, 6.56%]).

## 19. FINAL VERDICT

### C. NO DEMONSTRATED EDGE

**Decision rule (pre-registered)**: D if OOS decided bets < 500 or folds < 3. A requires ALL: (1) paired squared-error difference vs market significantly negative (95% CI upper < 0), (2) EV>0 selection OOS ROI > 0 with lower 95% CI > 0 and >= 200 selected bets, (3) train-selected-threshold fold stability >= 2/3. B if at least one of (1) or (2) holds directionally but A is not met. C otherwise.

- Best distribution model: Poisson GLM goals (market+form+rest+elo+league) (N=3556).
- Brier: model 0.2507 vs market 0.2499 (not better).
- Paired squared-error difference 95% CI: [-0.0017, 0.0033] (not significant).
- EV>0 selection: 1271 bets, ROI -0.78%, 95% CI [-5.76%, 4.20%].
- Train-selected-threshold positive folds: 4/5 (need 4).

**Evidence summary**: OOS bets 3556, folds 5, best model poisson_glm, Brier 0.2507 vs market 0.2499, selection positive=false, fold-stable=true.

## RESEARCH LOG

| ID | Description | Model | Train | Validation | OOS | Key results |
| --- | --- | --- | --- | --- | --- | --- |
| E1 | Baselines + models on genuine Pinnacle closing AH (primary) | market_poisson, league_line_prior, form_poisson, elo_poisson, poisson_glm, softmax_glm | 2019-20..2024-25 (expanding) | inner last train season | 2021-22..2025-26 | {"marketBrier":0.249923,"models":[{"id":"poisson_glm","brier":0.250709,"marketBrier":0.249923,"evPositiveRoi":-0.007773,"bets":3556},{"id":"market_poisson","brier":0.251188,"marketBrier":0.249923,"evPositiveRoi":-0.046254,"bets":3556},{"id":"softmax_glm","brier":0.253262,"marketBrier":0.249923,"evPositiveRoi":-0.012719,"bets":3556},{"id":"league_line_prior","brier":0.254441,"marketBrier":0.249923,"evPositiveRoi":-0.00888,"bets":3556},{"id":"elo_poisson","brier":0.258351,"marketBrier":0.249923,"evPositiveRoi":-0.022509,"bets":3556},{"id":"form_poisson","brier":0.275679,"marketBrier":0.249923,"evPositiveRoi":-0.014783,"bets":3556}]} |
| E2 | Opening snapshot evaluation (same protocol) | market_poisson, league_line_prior, form_poisson, elo_poisson, poisson_glm, softmax_glm | 2019-20..2024-25 (expanding) | inner last train season | 2021-22..2025-26 | {"marketBrier":0.249505,"bestModel":"poisson_glm","bestBrier":0.249865} |
| E3 | BetBrain consensus cohort (top-5 leagues, wider but higher-margin market) | market_poisson, league_line_prior, form_poisson, elo_poisson, poisson_glm, softmax_glm | 2016-17..2018-19 (expanding) | inner last train season | 2018-19..2019-20 | {"marketBrier":0.246628,"bestModel":"market_poisson","bestBrier":0.247751} |
| E4 | EV threshold sweep (all thresholds reported; selected on inner validation) | market_poisson, league_line_prior, form_poisson, elo_poisson, poisson_glm, softmax_glm | expanding seasons | inner last train season | primary test seasons | {"evPositiveRoiByModel":{"poisson_glm":-0.007773,"market_poisson":-0.046254,"softmax_glm":-0.012719,"league_line_prior":-0.00888,"elo_poisson":-0.022509,"form_poisson":-0.014783}} |
| E5 | Cumulative feature-group ablation (Poisson GLM, primary cohort) | poisson_glm | expanding seasons | inner last train season | primary test seasons | {"rows":[{"groups":["market"],"brier":0.250603,"evPositiveRoi":0.017846},{"groups":["market","form"],"brier":0.250546,"evPositiveRoi":-0.017833},{"groups":["market","form","rest"],"brier":0.250439,"evPositiveRoi":-0.006841},{"groups":["market","form","rest","elo"],"brier":0.250653,"evPositiveRoi":-0.005908},{"groups":["market","form","rest","elo","league"],"brier":0.250709,"evPositiveRoi":-0.007773}]} |
| E6 | Leave-one-league-out generalization (train other leagues earlier, test held-out league) | poisson_glm | other leagues strictly earlier | none (direct OOS) | held-out league seasons | {"rows":[{"league":"DEU-BUNDESLIGA","bets":1120,"brier":0.247892,"market":0.247096},{"league":"ENG-PL","bets":1422,"brier":0.250134,"market":0.247577},{"league":"ESP-LALIGA","bets":1418,"brier":0.243919,"market":0.245177},{"league":"FRA-LIGUE1","bets":1376,"brier":0.249917,"market":0.247628},{"league":"ITA-SERIEA","bets":1318,"brier":0.25201,"market":0.245721}]} |
| E7 | Line and favorite/underdog breakdowns from primary OOS predictions | market_poisson, league_line_prior, form_poisson, elo_poisson, poisson_glm, softmax_glm | expanding seasons | inner last train season | primary test seasons | {"lineCount":138,"favoriteRows":18} |
