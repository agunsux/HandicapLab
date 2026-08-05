# EPIC 59 Stage 0: Read-Only Probe Coverage Matrix Report

**Date**: 2026-08-05T19:45:28.960Z
**Scope**: Tier 1 EPL (Seasons 2018-2019 through 2024-2025)

## 1. Football-Data.co.uk Adapter (Tier 1 Core)

| Season | Actual / Expected Rows | Total Cols | Score Coverage % | Pinnacle Opening ML % | Pinnacle Closing ML % | Asian Handicap % | Over/Under 2.5 % |
|--------|-----------------------|------------|------------------|-----------------------|-----------------------|------------------|------------------|
| 2018-2019 | 380 / 380 | 62 | 100% | 100% | 100% | 0% | 0% |
| 2019-2020 | 380 / 380 | 106 | 100% | 100% | 100% | 100% | 100% |
| 2020-2021 | 380 / 380 | 106 | 100% | 100% | 100% | 100% | 100% |
| 2021-2022 | 380 / 380 | 106 | 100% | 100% | 100% | 100% | 100% |
| 2022-2023 | 380 / 380 | 106 | 100% | 100% | 100% | 100% | 99.7% |
| 2023-2024 | 380 / 380 | 106 | 100% | 100% | 100% | 100% | 97.9% |
| 2024-2025 | 380 / 380 | 120 | 100% | 100% | 100% | 100% | 99.2% |

### Available Columns in Football-Data.co.uk (2023-2024 / 2024-2025)
```text
Div, Date, Time, HomeTeam, AwayTeam, FTHG, FTAG, FTR, HTHG, HTAG, HTR, Referee, HS, AS, HST, AST, HF, AF, HC, AC, HY, AY, HR, AR, B365H, B365D, B365A, BWH, BWD, BWA, IWH, IWD, IWA, PSH, PSD, PSA, WHH, WHD, WHA, VCH, VCD, VCA, MaxH, MaxD, MaxA, AvgH, AvgD, AvgA, B365>2.5, B365<2.5, P>2.5, P<2.5, Max>2.5, Max<2.5, Avg>2.5, Avg<2.5, AHh, B365AHH, B365AHA, PAHH, PAHA, MaxAHH, MaxAHA, AvgAHH, AvgAHA, B365CH, B365CD, B365CA, BWCH, BWCD, BWCA, IWCH, IWCD, IWCA, PSCH, PSCD, PSCA, WHCH, WHCD, WHCA, VCCH, VCCD, VCCA, MaxCH, MaxCD, MaxCA, AvgCH, AvgCD, AvgCA, B365C>2.5, B365C<2.5, PC>2.5, PC<2.5, MaxC>2.5, MaxC<2.5, AvgC>2.5, AvgC<2.5, AHCh, B365CAHH, B365CAHA, PCAHH, PCAHA, MaxCAHH, MaxCAHA, AvgCAHH, AvgCAHA
```

---

## 2. Understat Adapter (xG & Team Performance)

| Season | Actual Teams / Expected | xG / xGA Coverage % | xPTS Coverage % |
|--------|------------------------|---------------------|-----------------|
| 2018-2019 | 20 / 20 | 100% | 100% |
| 2019-2020 | 20 / 20 | 100% | 100% |
| 2020-2021 | 20 / 20 | 100% | 100% |
| 2021-2022 | 20 / 20 | 100% | 100% |
| 2022-2023 | 20 / 20 | 100% | 100% |
| 2023-2024 | 20 / 20 | 100% | 100% |
| 2024-2025 | 20 / 20 | 100% | 100% |

---

## 3. Silver Merged Fixtures Dataset

| Season | Fixtures / Expected | Kickoff % | Scores % | Shots % | Shots on Target % |
|--------|---------------------|-----------|----------|---------|-------------------|
| 2018-2019 | 0 / 380 | 0% | 0% | 0% | 0% |
| 2019-2020 | 0 / 380 | 0% | 0% | 0% | 0% |
| 2020-2021 | 192 / 380 | 100% | 100% | 100% | 100% |
| 2021-2022 | 380 / 380 | 100% | 100% | 100% | 100% |
| 2022-2023 | 380 / 380 | 100% | 100% | 100% | 100% |
| 2023-2024 | 380 / 380 | 100% | 100% | 100% | 100% |
| 2024-2025 | 380 / 380 | 100% | 100% | 100% | 100% |

---

## 4. Key Verification Findings & Invariants

1. **Zero Database Changes**: Probe operated 100% read-only against bronze/silver files and local adapters. Zero SQL tables created or modified in Stage 0.
2. **Tier 1 Coverage (EPL)**: 380/380 fixtures per completed season (2018-2024) across Football-Data.co.uk with 100% score coverage.
3. **Pinnacle Odds Reality**: Pinnacle Moneyline Opening (`PSH`/`PSD`/`PSA`) and Closing (`PSCH`/`PSCD`/`PSCA`) lines are 100% complete for 2019-2025, enabling valid CLV calculation.
4. **Adapter Uniformity**: All adapters map provenance attributes (`provider`, `provider_match_id`, `ingested_at`).

> [!NOTE]
> Ready for Stage 1 Core Schema creation upon user approval.
