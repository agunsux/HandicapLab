# Phase 1 Data Quality & Ingestion Summary Report

**Execution Timestamp**: 2026-08-05T20:03:56.761Z
**Provider**: Football-Data.co.uk
**Competition**: Premier League (EPL)

## Quality Reports Matrix (`quality_reports`)

| Season | Ingested / Expected | Coverage % | Null % | Health Score | Warnings | Status |
|--------|---------------------|------------|--------|--------------|----------|--------|
| 2018-2019 | 380 / 380 | 100% | 0% | 46 | 1 | SUCCESS |
| 2019-2020 | 380 / 380 | 100% | 0% | 63 | 1 | SUCCESS |
| 2020-2021 | 380 / 380 | 100% | 0% | 63 | 1 | SUCCESS |
| 2021-2022 | 380 / 380 | 100% | 0% | 46 | 1 | SUCCESS |
| 2022-2023 | 380 / 380 | 100% | 0% | 81 | 1 | SUCCESS |
| 2023-2024 | 380 / 380 | 100% | 0% | 100 | 0 | SUCCESS |
| 2024-2025 | 380 / 380 | 100% | 0% | 100 | 0 | SUCCESS |

---

## Provenance & Governance Verification
- **Layer 0 Raw Archive**: Download checksums and byte sizes validated for all 7 seasons.
- **Entity Resolution**: Canonical team IDs mapped for 100% of fixtures via `canonicalEntityResolver`.
- **Flexible Betting Market Dimension**: Moneyline, Asian Handicap, Over/Under lines staged cleanly.
- **Zero Schema Drift**: All fields map to 9-column mandatory provenance standard.
