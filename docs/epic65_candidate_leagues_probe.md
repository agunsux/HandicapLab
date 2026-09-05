# EPIC 65: Section 1 Candidate Leagues Source-Availability Probe Report

**Probe Date:** `2026-09-05`  
**Governance Requirement:** "No league is added to the training/backtest universe without a Stage A source-availability check... New candidate leagues are not approved for ingestion in this EPIC without explicit review."  
**Candidate Scope:**
1. Brasileirão Série A (Brazil)
2. Liga MX (Mexico)
3. Major League Soccer / MLS (USA)
4. Saudi Pro League (Saudi Arabia)
5. Argentina Liga Profesional (Argentina)

---

## 1. Provider Probe Results Matrix

| League | Country | Source Checked | URL / Endpoint Inspected | Sharp AH Closing Line Present? | Sharp OU Closing Line Present? | Verdict |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- |
| **Brasileirão Série A** | Brazil | Football-Data.co.uk | `https://www.football-data.co.uk/new/BRA.csv` | ❌ NO (1X2 only) | ❌ NO | **REJECTED (INSUFFICIENT_DATA)** |
| | | API-Football | `GET /fixtures?league=71&season=2024` | ❌ NO (Retail 1X2 only) | ❌ NO | |
| | | OddsPapi.io | `GET /v4/historical-odds?fixtureId={id}&bookmakers=pinnacle` | ❌ NO (No 2-yr archive) | ❌ NO | |
| **Liga MX** | Mexico | Football-Data.co.uk | `https://www.football-data.co.uk/new/MEX.csv` | ❌ NO (1X2 only) | ❌ NO | **REJECTED (INSUFFICIENT_DATA)** |
| | | API-Football | `GET /fixtures?league=262&season=2024` | ❌ NO (Retail 1X2 only) | ❌ NO | |
| | | OddsPapi.io | `GET /v4/historical-odds?fixtureId={id}&bookmakers=pinnacle` | ❌ NO (No 2-yr archive) | ❌ NO | |
| **Major League Soccer (MLS)** | USA | Football-Data.co.uk | `https://www.football-data.co.uk/new/USA.csv` | ❌ NO (1X2 only) | ❌ NO | **REJECTED (INSUFFICIENT_DATA)** |
| | | API-Football | `GET /fixtures?league=253&season=2024` | ❌ NO (Retail 1X2 only) | ❌ NO | |
| | | OddsPapi.io | `GET /v4/historical-odds?fixtureId={id}&bookmakers=pinnacle` | ❌ NO (No 2-yr archive) | ❌ NO | |
| **Saudi Pro League** | Saudi Arabia | Football-Data.co.uk | `https://www.football-data.co.uk/new/SAU.csv` | ❌ ABSENT (HTTP 404) | ❌ ABSENT | **REJECTED (NO_SOURCE_FILE)** |
| | | API-Football | `GET /fixtures?league=307&season=2024` | ❌ NO (Retail 1X2 only) | ❌ NO | |
| | | OddsPapi.io | `N/A` (No tournament mapping) | ❌ NO | ❌ NO | |
| **Argentina Liga Profesional** | Argentina | Football-Data.co.uk | `https://www.football-data.co.uk/new/ARG.csv` | ❌ NO (1X2 only) | ❌ NO | **REJECTED (INSUFFICIENT_DATA)** |
| | | API-Football | `GET /fixtures?league=128&season=2024` | ❌ NO (Retail 1X2 only) | ❌ NO | |
| | | OddsPapi.io | `GET /v4/historical-odds?fixtureId={id}&bookmakers=pinnacle` | ❌ NO (No 2-yr archive) | ❌ NO | |

---

## 2. Forensic Findings & Critical Discoveries

### A. Non-European Football-Data.co.uk Schema Limitation
Inspection of `BRA.csv`, `MEX.csv`, `USA.csv`, and `ARG.csv` directly from `football-data.co.uk/new/` confirmed the exact 25 columns available:
`Country, League, Season, Date, Time, Home, Away, HG, AG, Res, PH, PD, PA, MaxH, MaxD, MaxA, AvgH, AvgD, AvgA, BFEH, BFED, BFEA, PSCH, PSCD, PSCA`
- **Result:** These files contain Pinnacle **1X2 match odds** (`PSCH`, `PSCD`, `PSCA`), but **completely lack Asian Handicap lines and Over/Under lines** (`AHCh`, `PCAHH`, `PCAHA`, `PC>2.5`, `PC<2.5`).
- Under HandicapLab's constitutional rules, Pinnacle closing odds are the required benchmark for Closing Line Value (CLV). Evaluating Asian Handicap profitability without handicap lines or odds is mathematically impossible.

### B. Prior Pipeline Alias Confusion Discovered
In `handicaplab-pipeline/data/historical/downloader.py`, line 27 incorrectly mapped:
```python
CODES = {
  ...
  "Brasileirão": "B1",
}
```
**Forensic Reality:** In `football-data.co.uk`, `B1` is the code for the **Belgian Jupiler Pro League** (`B1_2425.csv` contains Anderlecht, St Truiden, Club Brugge, etc.), NOT Brazil. Brazil's code is `BRA.csv`. The Belgian Pro League CSVs contain full AH data, whereas Brazilian data does not. This alias confusion is now permanently clarified.

### C. Live vs Historical Provider Boundaries
- **API-Football:** Excellent fixture and score metadata, but does not provide Pinnacle Asian Handicap closing odds.
- **OddsPapi.io:** Essential for live/pre-match pipeline, but the tier does not support bulk historical archives for 2 completed seasons across these leagues.

---

## 3. Definitive Governance Decision

**HARD STOP:** None of the 5 candidate leagues qualify for ingestion or backtesting under EPIC 65.
- Scope remains strictly restricted to the **5 verified European leagues** (`ENG-PL`, `ESP-LALIGA`, `ITA-SERIEA`, `DEU-BUNDESLIGA`, `FRA-LIGUE1`).
- `NED-ERE` and `POR-PRIMEIRA` remain explicitly excluded with `SOURCE_DATA_ABSENT`.
