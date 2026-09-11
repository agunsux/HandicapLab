# AH ENGINE VALIDATION REPORT

- **Engine**: ah-yield-v1
- **Generated**: 2026-09-11T17:18:24.187Z
- **Canonical matches**: 8,898
- **Market odds rows**: 77,471 (AH: 23,864)

## DATA

| Metric | Value |
| --- | --- |
| Canonical matches | 8,898 |
| Result verified | 8,898 (100.00%) |
| Duplicate canonical ids | 0 |
| AH odds rows | 23,864 |
| Canonical join rate (odds rows) | 100.00% |
| Unmatched odds rows | 0 |
| AH match coverage | 8,898 / 8,898 (100.00%) |
| Valid observations (1-unit bets) | 36,006 |
| Duplicates collapsed | 5858 |
| Missing price rows | 2 |
| Invalid line rows | 1 |
| Odds timestamps available | NO — match_date + snapshot label only |

**Integrity flags**: DUPLICATE_OBSERVATIONS_COLLAPSED:5858, MISSING_PRICE_ROWS:2, INVALID_LINE_ROWS:1, PROVENANCE_MISLABEL_DETECTED:16_SOURCES_EMIT_BETBRAIN_AS_PINNACLE

### Provenance layouts (resolved from source CSV headers)

| Source file | Open branch | Close branch | AH rows |
| --- | --- | --- | --- |
| D1_1617.csv | betbrain_avg | none | 612 |
| D1_1718.csv | betbrain_avg | none | 612 |
| D1_1819.csv | betbrain_avg | none | 612 |
| 2015-2016.csv | betbrain_avg | none | 760 |
| 2016-2017.csv | betbrain_avg | none | 760 |
| 2017-2018.csv | betbrain_avg | none | 760 |
| 2018-2019.csv | betbrain_avg | none | 760 |
| 2019-2020.csv | pinnacle | pinnacle | 1520 |
| 2020-2021.csv | pinnacle | pinnacle | 1520 |
| 2021-2022.csv | pinnacle | pinnacle | 1519 |
| 2022-2023.csv | pinnacle | pinnacle | 1520 |
| 2023-2024.csv | pinnacle | pinnacle | 1520 |
| 2024-2025.csv | pinnacle | pinnacle | 1520 |
| 2025-2026.csv | pinnacle | pinnacle | 1519 |
| SP1_1617.csv | betbrain_avg | none | 760 |
| SP1_1718.csv | betbrain_avg | none | 760 |
| SP1_1819.csv | betbrain_avg | none | 760 |
| SP1_1920.csv | pinnacle | pinnacle | 1510 |
| F1_1617.csv | betbrain_avg | none | 760 |
| F1_1718.csv | betbrain_avg | none | 760 |
| F1_1819.csv | betbrain_avg | none | 760 |
| I1_1617.csv | betbrain_avg | none | 760 |
| I1_1718.csv | betbrain_avg | none | 760 |
| I1_1819.csv | betbrain_avg | none | 760 |

### Coverage by season (valid AH matches)

| Season | AH rows | Matches | Coverage |
| --- | --- | --- | --- |
| 2015-2016 | 760 | 380 | 100.0% |
| 2016-2017 | 3652 | 1826 | 100.0% |
| 2017-2018 | 3652 | 1826 | 100.0% |
| 2018-2019 | 3652 | 1826 | 100.0% |
| 2019-2020 | 3030 | 760 | 100.0% |
| 2020-2021 | 1520 | 380 | 100.0% |
| 2021-2022 | 1519 | 380 | 100.0% |
| 2022-2023 | 1520 | 380 | 100.0% |
| 2023-2024 | 1520 | 380 | 100.0% |
| 2024-2025 | 1520 | 380 | 100.0% |
| 2025-2026 | 1519 | 380 | 100.0% |

## SETTLEMENT

Independent brute-force invariants: **2377/2377 passed**, 0 failed. Unit suite: see `tests/ah-yield/`.

## YIELD / ROI

| Cohort (provenance/snapshot) | Bets | Stake | P&L | Yield% | ROI 95% CI | Sample |
| --- | --- | --- | --- | --- | --- | --- |
| best_available|closing | 6078 | 6078 | -88.1 | -1.45% | [-3.71%, +0.81%] | STRONG_SAMPLE |
| best_available|opening | 6058 | 6058 | -107.1 | -1.77% | [-4.02%, +0.48%] | STRONG_SAMPLE |
| bet365|closing | 6078 | 6078 | -133.0 | -2.19% | [-4.43%, +0.05%] | STRONG_SAMPLE |
| bet365|opening | 6058 | 6058 | -143.2 | -2.36% | [-4.60%, -0.13%] | STRONG_SAMPLE |
| betbrain_avg|single_quote | 11716 | 11716 | -376.4 | -3.21% | [-4.79%, -1.63%] | STRONG_SAMPLE |
| pinnacle|closing | 6080 | 6080 | -104.0 | -1.71% | [-3.96%, +0.54%] | STRONG_SAMPLE |
| pinnacle|opening | 6074 | 6074 | -121.8 | -2.01% | [-4.25%, +0.24%] | STRONG_SAMPLE |

**Headline cohort**: `pinnacle|closing` — Pinned headline cohort: genuine Pinnacle closing odds.

### Cohort: pinnacle / closing

| Bets | Matches | Leagues | Seasons | Sample | FullW | HalfW | Push | HalfL | FullL |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 6080 | 3040 | 2 | 7 | 2019-08-09 → 2026-05-24 | 2423 | 415 | 404 | 415 | 2423 |

| Total Stake | Total P&L | Yield% | ROI 95% CI | HitRate (weighted) | Avg Odds | Max DD | Worst Streak | Profit Factor |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 6080.0 | -104.0 | -1.71% | [-3.96%, +0.54%] | 46.3% | 1.962 | 105.80 | 2 | 0.961 |

#### By line and side (sample-size protected ranking)

| AH Line | Side | Bets | HitRate | AvgOdds | P&L | Yield% | ROI 95% CI | Model P(profit) | FairOdds | ModelEV | Edge | Sample | State |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| -2 | away | 61 | 68.9% | 1.924 | 13.98 | +22.92% | [+3.37%, +42.46%] | 68.1% | 1.477 | +22.03% | +24.47% | LOW_SAMPLE | POSITIVE_VALUE |
| -2 | home | 61 | 31.1% | 1.990 | -17.29 | -28.34% | [-48.74%, -7.95%] | 31.9% | 3.097 | -26.00% | -23.55% | LOW_SAMPLE | NEGATIVE_VALUE |
| -1.75 | away | 79 | 54.4% | 1.952 | 11.44 | +14.48% | [-5.47%, +34.43%] | 54.3% | 1.697 | +13.56% | +15.92% | LOW_SAMPLE | NEUTRAL |
| -1.75 | home | 79 | 37.3% | 1.960 | -14.83 | -18.77% | [-38.79%, +1.25%] | 45.7% | 2.435 | -17.56% | -15.20% | LOW_SAMPLE | NEUTRAL |
| -1.5 | away | 122 | 53.3% | 1.942 | 5.18 | +4.25% | [-13.19%, +21.68%] | 53.2% | 1.880 | +3.28% | +5.49% | MODERATE_SAMPLE | NEUTRAL |
| -1.5 | home | 122 | 46.7% | 1.978 | -8.49 | -6.96% | [-24.69%, +10.77%] | 46.8% | 2.137 | -7.33% | -5.13% | MODERATE_SAMPLE | NEUTRAL |
| -1.25 | away | 150 | 44.0% | 1.949 | -2.68 | -1.79% | [-15.87%, +12.29%] | 56.6% | 1.985 | -1.58% | +0.53% | MODERATE_SAMPLE | NEUTRAL |
| -1.25 | home | 150 | 43.3% | 1.974 | -2.64 | -1.76% | [-16.04%, +12.52%] | 43.4% | 2.015 | -1.76% | +0.35% | MODERATE_SAMPLE | NEUTRAL |
| -1 | away | 218 | 49.1% | 1.946 | -7.13 | -3.27% | [-14.37%, +7.83%] | 49.1% | 2.038 | -3.26% | -1.06% | MODERATE_SAMPLE | NEUTRAL |
| -1 | home | 218 | 50.9% | 1.978 | 0.98 | +0.45% | [-10.80%, +11.70%] | 50.9% | 1.964 | +0.54% | +2.74% | MODERATE_SAMPLE | NEUTRAL |
| -0.75 | away | 279 | 39.4% | 1.967 | -23.76 | -8.52% | [-18.89%, +1.86%] | 39.5% | 2.193 | -8.85% | -6.72% | MODERATE_SAMPLE | NEUTRAL |
| -0.75 | home | 279 | 47.1% | 1.957 | 16.48 | +5.91% | [-4.38%, +16.19%] | 60.5% | 1.838 | +5.54% | +7.66% | MODERATE_SAMPLE | NEUTRAL |
| -0.5 | away | 325 | 53.2% | 1.953 | 12.67 | +3.90% | [-6.73%, +14.52%] | 53.2% | 1.880 | +3.88% | +6.05% | STRONG_SAMPLE | NEUTRAL |
| -0.5 | home | 325 | 46.8% | 1.968 | -26.16 | -8.05% | [-18.75%, +2.65%] | 46.8% | 2.137 | -7.87% | -5.70% | STRONG_SAMPLE | NEUTRAL |
| -0.25 | away | 441 | 44.7% | 1.942 | 3.79 | +0.86% | [-7.20%, +8.92%] | 58.9% | 1.919 | +1.02% | +3.17% | STRONG_SAMPLE | NEUTRAL |
| -0.25 | home | 441 | 41.0% | 1.984 | -19.43 | -4.41% | [-12.62%, +3.81%] | 41.1% | 2.088 | -4.25% | -2.10% | STRONG_SAMPLE | NEUTRAL |
| 0 | away | 315 | 47.8% | 1.972 | -13.34 | -4.23% | [-13.52%, +5.05%] | 47.8% | 2.090 | -4.09% | -1.97% | STRONG_SAMPLE | NEUTRAL |
| 0 | home | 315 | 52.2% | 1.953 | 3.57 | +1.13% | [-8.04%, +10.30%] | 52.2% | 1.917 | +1.36% | +3.48% | STRONG_SAMPLE | NEUTRAL |
| +0.25 | away | 325 | 42.8% | 2.005 | 3.20 | +0.98% | [-8.70%, +10.67%] | 42.8% | 1.989 | +0.66% | +2.75% | STRONG_SAMPLE | NEUTRAL |
| +0.25 | home | 325 | 42.3% | 1.923 | -11.79 | -3.63% | [-12.91%, +5.65%] | 57.2% | 2.011 | -3.68% | -1.59% | STRONG_SAMPLE | NEUTRAL |
| +0.5 | away | 210 | 49.0% | 1.992 | -4.06 | -1.93% | [-15.50%, +11.64%] | 49.1% | 2.038 | -2.25% | -0.12% | MODERATE_SAMPLE | NEUTRAL |
| +0.5 | home | 210 | 51.0% | 1.932 | -2.40 | -1.14% | [-14.33%, +12.04%] | 50.9% | 1.963 | -1.58% | +0.55% | MODERATE_SAMPLE | NEUTRAL |
| +0.75 | away | 152 | 41.1% | 1.957 | -12.72 | -8.37% | [-22.53%, +5.79%] | 52.6% | 2.148 | -7.82% | -5.64% | MODERATE_SAMPLE | NEUTRAL |
| +0.75 | home | 152 | 47.4% | 1.964 | 5.83 | +3.84% | [-10.27%, +17.94%] | 47.4% | 1.871 | +4.35% | +6.52% | MODERATE_SAMPLE | NEUTRAL |
| +1 | away | 119 | 54.8% | 2.010 | 9.07 | +7.62% | [-7.73%, +22.97%] | 54.7% | 1.832 | +6.85% | +9.02% | MODERATE_SAMPLE | NEUTRAL |
| +1 | home | 119 | 45.2% | 1.918 | -11.30 | -9.50% | [-24.02%, +5.03%] | 45.3% | 2.203 | -9.07% | -6.90% | MODERATE_SAMPLE | NEUTRAL |
| +1.25 | away | 65 | 33.8% | 2.017 | -12.47 | -19.18% | [-41.08%, +2.71%] | 34.3% | 2.553 | -18.01% | -15.90% | LOW_SAMPLE | NEUTRAL |
| +1.25 | home | 65 | 53.8% | 1.909 | 9.85 | +15.15% | [-5.53%, +35.82%] | 65.7% | 1.644 | +13.81% | +15.92% | LOW_SAMPLE | NEUTRAL |
| +1.5 | away | 61 | 54.1% | 2.005 | 5.04 | +8.26% | [-17.03%, +33.56%] | 54.0% | 1.855 | +7.83% | +9.96% | LOW_SAMPLE | NEUTRAL |
| +1.5 | home | 61 | 45.9% | 1.920 | -7.39 | -12.11% | [-36.30%, +12.07%] | 46.0% | 2.169 | -11.14% | -9.01% | LOW_SAMPLE | NEUTRAL |

#### By league

| League | Bets | P&L | Yield% | ROI 95% CI | Sample |
| --- | --- | --- | --- | --- | --- |
| ENG-PL | 5320 | -90.28 | -1.70% | [-4.11%, +0.72%] | STRONG_SAMPLE |
| ESP-LALIGA | 760 | -13.70 | -1.80% | [-8.11%, +4.50%] | STRONG_SAMPLE |

#### By season

| Season | Bets | P&L | Yield% | ROI 95% CI | Sample |
| --- | --- | --- | --- | --- | --- |
| 2019-2020 | 1520 | -25.75 | -1.69% | [-6.17%, +2.78%] | STRONG_SAMPLE |
| 2020-2021 | 760 | -9.70 | -1.28% | [-7.71%, +5.16%] | STRONG_SAMPLE |
| 2021-2022 | 760 | -13.03 | -1.71% | [-8.11%, +4.68%] | STRONG_SAMPLE |
| 2022-2023 | 760 | -13.76 | -1.81% | [-8.18%, +4.56%] | STRONG_SAMPLE |
| 2023-2024 | 760 | -13.39 | -1.76% | [-8.11%, +4.58%] | STRONG_SAMPLE |
| 2024-2025 | 760 | -14.47 | -1.90% | [-8.33%, +4.52%] | STRONG_SAMPLE |
| 2025-2026 | 760 | -13.88 | -1.83% | [-8.20%, +4.55%] | STRONG_SAMPLE |

#### By favorite / underdog

| Direction | Bets | P&L | Yield% | ROI 95% CI | Sample |
| --- | --- | --- | --- | --- | --- |
| favorite | 3028 | -97.98 | -3.24% | [-6.45%, -0.02%] | STRONG_SAMPLE |
| market_neutral | 24 | -0.31 | -1.29% | [-31.82%, +29.24%] | INSUFFICIENT_SAMPLE |
| underdog | 3028 | -5.68 | -0.19% | [-3.36%, +2.99%] | STRONG_SAMPLE |

#### By side

| Side | Bets | P&L | Yield% | ROI 95% CI | Sample |
| --- | --- | --- | --- | --- | --- |
| away | 3040 | -13.04 | -0.43% | [-3.62%, +2.77%] | STRONG_SAMPLE |
| home | 3040 | -90.94 | -2.99% | [-6.17%, +0.18%] | STRONG_SAMPLE |

## BEST CARDS (headline cohort)

| Card | Available | Line | Side | Bets | Yield% | Model EV | Value State |
| --- | --- | --- | --- | --- | --- | --- | --- |
| BEST VALUE | YES | -2 | away | 61 | +22.92% | +22.03% | POSITIVE_VALUE |
| BEST HISTORICAL ROI | YES | -2 | away | 61 | +22.92% | +22.03% | POSITIVE_VALUE |
| HIGHEST PROBABILITY | YES | -2 | away | 61 | +22.92% | +22.03% | POSITIVE_VALUE |
| LARGEST SAMPLE | YES | -0.25 | away | 441 | +0.86% | +1.02% | NEUTRAL |
| MOST CONSISTENT | YES | -2 | away | 61 | +22.92% | +22.03% | POSITIVE_VALUE |

## WALK-FORWARD (out-of-sample, season folds)

- `best_available|closing`: OOS bets 3798, all-bets yield -1.55%, positive-EV selection 1609 bets @ -0.71% yield, mean Brier 0.2509, mean ECE 0.0540, positive-value folds 1/5.
- `best_available|opening`: OOS bets 3798, all-bets yield -1.88%, positive-EV selection 1524 bets @ -2.95% yield, mean Brier 0.2510, mean ECE 0.0303, positive-value folds 1/5.
- `bet365|closing`: OOS bets 3798, all-bets yield -2.36%, positive-EV selection 1491 bets @ -2.11% yield, mean Brier 0.2509, mean ECE 0.0540, positive-value folds 1/5.
- `bet365|opening`: OOS bets 3798, all-bets yield -2.48%, positive-EV selection 1418 bets @ -2.86% yield, mean Brier 0.2510, mean ECE 0.0303, positive-value folds 1/5.
- `betbrain_avg|single_quote`: OOS bets 7304, all-bets yield -3.30%, positive-EV selection 3022 bets @ -5.16% yield, mean Brier 0.2502, mean ECE 0.0276, positive-value folds 0/2.
- `pinnacle|closing`: OOS bets 3800, all-bets yield -1.80%, positive-EV selection 1572 bets @ -0.89% yield, mean Brier 0.2509, mean ECE 0.0542, positive-value folds 1/5.
- `pinnacle|opening`: OOS bets 3798, all-bets yield -2.10%, positive-EV selection 1477 bets @ -2.88% yield, mean Brier 0.2511, mean ECE 0.0305, positive-value folds 2/5.

## BIAS CHECK

| Check | Result |
| --- | --- |
| Look-ahead (train max date < test min date) | PASS |
| Duplicate odds collapsed | 5858 |
| Duplicate canonical ids | 0 |
| Unmatched odds rows | 0 |
| Provenance mislabel | DETECTED (resolved per-row) |
| Survivorship | No fixture filtering by outcome; all verified-result matches included |

## LIMITATIONS

- No odds timestamps exist in market_odds.jsonl (only match_date plus opening/closing/single_quote labels); T-24h/T-6h/T-1h snapshots are DATA NOT AVAILABLE.
- BetBrain aggregate columns (2015-16..2018-19 sources) were emitted twice by the legacy ingestion (labeled pinnacle and betbrain). The engine resolves true provenance from source headers and collapses the duplicate, but the raw dataset still contains the mislabeled rows.
- BetBrain quotes are consensus averages (BbAvAHH/BbAvAHA), not a single bookmaker; they are reported as a separate cohort and never mixed with Pinnacle/Bet365.
- Only football-data.co.uk closing/opening columns are available; exchange prices and in-play prices are DATA NOT AVAILABLE.
- best_available requires two genuine books quoting the same match/line/snapshot (Pinnacle + Bet365, 2019-20 onward); earlier eras cannot support a best-price methodology and are excluded from that cohort.
- Headline cohort contains 22 line/side groups below the 30-bet minimum sample; those are never ranked or promoted.
- Model EV and fair odds in the value table use the pooled (in-sample) posterior for that line/side; only the walk-forward section is out-of-sample.
- PROVENANCE_MISLABEL_DETECTED: legacy bookmaker_source labels are not trustworthy for pre-2019 sources.

## METHODOLOGY

- **stake**: Normalized 1.0 unit per bet. VOID bets are returned flat and excluded from ROI denominators.
- **yield**: ROI = Σpnl / Σstake (fraction); Yield% = ROI × 100. Hit rate is reported separately and is never labeled ROI.
- **settlement**: Quarter lines split the stake evenly across the two adjacent half-lines; P&L: FULL_WIN +(o−1), HALF_WIN +0.5(o−1), PUSH 0, HALF_LOSS −0.5, FULL_LOSS −1.
- **probability**: Dirichlet-multinomial posterior over the 5 settlement categories with uniform prior α=(1,1,1,1,1); binary positive-return event uses Beta(1+wins, 1+losses) with pushes excluded. 95% marginal credible intervals reported.
- **fairOdds**: Settlement-aware fair odds solve EV(o*)=0: o* = 1 + (0.5·pHL + pFL) / (pFW + 0.5·pHW). Binary 1/p is NOT used for AH.
- **ev**: EV(o) = (pFW + 0.5·pHW)(o−1) − (0.5·pHL + pFL). Edge = model EV − market implied EV from proportional two-way devig (documented binary approximation).
- **sampleSize**: INSUFFICIENT <30, LOW 30-99, MODERATE 100-299, STRONG >=300 evaluated bets.
- **ranking**: Default ranking uses the lower bound of the 95% ROI CI (sample-size protected); raw ROI ranking is available but never the default.
- **snapshots**: Opening and closing are computed as separate cohorts; single_quote (BetBrain) is never treated as opening or closing. Cohorts are never merged.
- **bestAvailable**: best_available = highest price across genuine Pinnacle/Bet365 quotes at the same match, line, snapshot and side (requires both books; 2019-20 onward). Reported as its own cohort, never blended with single-bookmaker results.
- **provenance**: True provenance resolved from the actual source CSV headers (AHh/PAHH vs BbAHh/BbAvAHH), not from the legacy bookmaker_source label.
