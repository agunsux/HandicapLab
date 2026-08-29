# EPIC 56 — PHASE 0 GATE CHECK & DATA INVENTORY

**Execution Timestamp:** 2026-08-29T11:21:09.001Z  
**Status:** `PASS — PROCEED TO HISTORICAL RESEARCH`  
**Target Market:** Asian Handicap ONLY  

---

## 1. Prerequisite Gates Status

| Gate | Requirement | Status | Evidence |
|---|---|---|---|
| **EPIC 53** | Fixture Linkage & Anti-Leakage Gate | **PASS** | `DATA_INTEGRITY_CHECKPOINT_REPORT.md` (10/10 deterministic linkage, zero synthetic contamination). |
| **EPIC 54** | Per-Market Diagnostic Prerequisite | **PASS (Remediated)** | Baseline audited. Stage A circularity eliminated (zero odds features in fundamental model). |
| **Data Integrity** | Canonical ID & Result Verification | **PASS** | 8,898 total matches; 8,898 with `resultVerified = true`. |

---

## 2. Historical Gold Data Inventory

- **Total Historical Matches**: 8898
- **Valid Settled Matches**: 8898
- **Total Market Odds Rows**: 77471
  - **AH Market Rows**: 23864
  - **OU Market Rows**: 23875 (Line 2.5 only)
  - **ML Market Rows**: 29732
  - **BTTS Market Rows**: 0 (Zero historical odds)
- **Unique AH Fixtures**: 8898
- **Merged AH Trade Observations**: 40212
- **Date Range**: 2015-08-08 → 2026-05-24
- **Closing Odds Coverage**: 34.18%
- **Orphan / Invalid Odds**: 0

---

## 3. AH Line Distribution

| Line | Opening Rows | Closing Rows | Total Rows | Sample Density Status |
|---|---|---|---|---|
| **-3.75** | 0 | 2 | 2 | `INSUFFICIENT` |
| **-3.50** | 6 | 0 | 6 | `INSUFFICIENT` |
| **-3.25** | 10 | 2 | 12 | `INSUFFICIENT` |
| **-3.00** | 50 | 8 | 58 | `INSUFFICIENT` |
| **-2.75** | 66 | 20 | 86 | `INSUFFICIENT` |
| **-2.50** | 206 | 54 | 260 | `INSUFFICIENT` |
| **-2.25** | 152 | 58 | 210 | `INSUFFICIENT` |
| **-2.00** | 538 | 122 | 660 | `LIMITED` |
| **-1.75** | 292 | 158 | 450 | `LIMITED` |
| **-1.50** | 872 | 244 | 1116 | `ADEQUATE` |
| **-1.25** | 528 | 300 | 828 | `ADEQUATE` |
| **-1.00** | 2049 | 436 | 2485 | `ADEQUATE` |
| **-0.75** | 1252 | 558 | 1810 | `ADEQUATE` |
| **-0.50** | 1662 | 650 | 2312 | `ADEQUATE` |
| **-0.25** | 3454 | 881 | 4335 | `ADEQUATE` |
| **+0.00** | 1614 | 630 | 2244 | `ADEQUATE` |
| **+0.25** | 1801 | 650 | 2451 | `ADEQUATE` |
| **+0.50** | 760 | 420 | 1180 | `ADEQUATE` |
| **+0.75** | 674 | 304 | 978 | `ADEQUATE` |
| **+1.00** | 937 | 238 | 1175 | `ADEQUATE` |
| **+1.25** | 228 | 130 | 358 | `LIMITED` |
| **+1.50** | 384 | 122 | 506 | `LIMITED` |
| **+1.75** | 62 | 46 | 108 | `INSUFFICIENT` |
| **+2.00** | 156 | 32 | 188 | `INSUFFICIENT` |
| **+2.25** | 10 | 8 | 18 | `INSUFFICIENT` |
| **+2.50** | 20 | 4 | 24 | `INSUFFICIENT` |
| **+3.00** | 2 | 2 | 4 | `INSUFFICIENT` |

---

## 4. Bookmaker Coverage

| Bookmaker | Total Rows | Proportion |
|---|---|---|
| **betbrain** | 5858 | 24.55% |
| **pinnacle** | 11937 | 50.02% |
| **bet365** | 6069 | 25.43% |

---

## 5. League Breakdown

| League | Matches | AH Rows | Seasons | Status |
|---|---|---|---|---|
| **DEU-BUNDESLIGA** | 918 | 1836 | 2016-2017, 2017-2018, 2018-2019 | `INCLUDED` |
| **ENG-PL** | 4180 | 13678 | 2015-2016, 2016-2017, 2017-2018, 2018-2019, 2019-2020, 2020-2021, 2021-2022, 2022-2023, 2023-2024, 2024-2025, 2025-2026 | `INCLUDED` |
| **ESP-LALIGA** | 1520 | 3790 | 2016-2017, 2017-2018, 2018-2019, 2019-2020 | `INCLUDED` |
| **FRA-LIGUE1** | 1140 | 2280 | 2016-2017, 2017-2018, 2018-2019 | `INCLUDED` |
| **ITA-SERIEA** | 1140 | 2280 | 2016-2017, 2017-2018, 2018-2019 | `INCLUDED` |
