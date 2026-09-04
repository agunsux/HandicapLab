# EPIC 64 — PROVIDER & DATA CAPABILITY MATRIX

**Date:** 2026-09-04  
**Audit Scope:** Forensic Capability Audit for Historical Gold Layer & Live Upcoming Asian Handicap Pipeline  
**Governance:** Single Source of Truth (`API-Football` for metadata/fixtures/results, `OddsPAPI.io` for live market odds, `Football-Data.co.uk` as verified offline historical ground truth).

---

## 1. PRIMARY PROVIDER CAPABILITY MATRIX

| Capability | Provider | Available? | Free? | Historical? | Upcoming? | AH? | Bookmaker | Seasons | Limitation |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- | :--- | :--- |
| **Fixtures (Upcoming)** | API-Football (`api-sports.io v3`) | YES | NO (Pro Plan active) | YES | YES | NO | N/A | 2010–2026 | 7,500 req/day quota; 10 req/min rate limit. Does not carry sharp AH odds. |
| **Fixtures (Upcoming)** | OddsPAPI.io (`api.oddspapi.io v4`) | YES | YES (Free tier) | NO | YES | YES | Pinnacle, Circa, SBOBET | Current (2026/27) | 250 req/month free limit (200 safe limit). No historical match discovery. |
| **Results / Final Scores** | API-Football | YES | NO (Pro Plan active) | YES | NO | N/A | N/A | 2010–2026 | Available post-match only. High reliability for scores & metadata. |
| **Results / Final Scores** | Football-Data.co.uk (Repo) | YES | YES (Offline file) | YES | NO | YES | N/A | 2015–2026 | Covers EPL + Top 4 European leagues. Verified scores and match statistics. |
| **Asian Handicap (Live)** | OddsPAPI.io | YES | YES | NO | YES | YES | Pinnacle (`pinnacle`), Circa, SBOBET | Current (2026/27) | Pre-match & live only; queries require specifying exact `bookmaker` param. |
| **Asian Handicap (Live)** | API-Football | NO | N/A | NO | NO | NO | Retail only | None | API-Football does not track sharp Asian Handicap lines. |
| **AH Opening Odds** | OddsPAPI.io | YES | YES | NO | YES | YES | Pinnacle | Current (2026/27) | Captured upon initial fixture listing. |
| **AH Opening Odds** | Football-Data.co.uk (Repo) | YES | YES | YES | NO | YES | Pinnacle (`PAHH`/`PAHA`), Bet365 | 2015–2026 (top leagues) | Static historical ground truth for completed seasons. |
| **AH Closing Odds** | OddsPAPI.io | YES | YES | NO | YES | YES | Pinnacle | Current (2026/27) | Captured via T-60 / prematch snapshot pipeline before kickoff. |
| **AH Closing Odds** | Football-Data.co.uk (Repo) | YES | YES | YES | NO | YES | Pinnacle (`PCAHH`/`PCAHA`) | 2015–2026 (top leagues) | Static closing line benchmark ground truth for CLV. |
| **Pinnacle Benchmark** | OddsPAPI.io | YES | YES | NO | YES | YES | `pinnacle` | Current (2026/27) | Verified sharp slug in OddsPAPI (`liveOdds: true`). |
| **Pinnacle Benchmark** | Football-Data.co.uk (Repo) | YES | YES | YES | NO | YES | Pinnacle opening + closing | 2015–2026 (top leagues) | Verified columns `PAHH`, `PAHA`, `PCAHH`, `PCAHA`. |
| **League Standings** | API-Football | YES | NO | YES | YES | N/A | N/A | 2010–2026 | Available via `/standings` endpoint. |
| **League Standings** | OddsPAPI.io | NO | N/A | NO | NO | NO | N/A | None | OddsPAPI is an odds-focused provider, no standings endpoint. |

---

## 2. HISTORICAL DATASET AUDIT (SEASONS 2024/25 & 2025/26)

Target European Leagues per EPIC 64 specification:

| League | Canonical ID | In Supabase DB Now? | In Repo Files Now? | 2024/25 AH Coverage | 2025/26 AH Coverage | Status / Action Needed |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **Premier League** | `ENG-PL` | YES (380/season) | YES (`data/bronze/`) | 100% (1,520 Pinnacle AH records) | 99.9% (1,519 Pinnacle AH records) | **READY** — Fully ingested into `historical_matches` & `historical_odds`. |
| **La Liga** | `ESP-LALIGA` | NO (only 2016–2020) | YES (`python_engine/.../SP1_*.csv`) | Present in CSV (`PAHH`/`PCAHH`) | Present in CSV (`PAHH`/`PCAHH`) | **FILE READY, DB PENDING** — Ingest from `SP1_2425.csv` & `SP1_2526.csv`. |
| **Serie A** | `ITA-SERIEA` | NO (only 2016–2019) | YES (`python_engine/.../I1_*.csv`) | Present in CSV (`PAHH`/`PCAHH`) | Present in CSV (`PAHH`/`PCAHH`) | **FILE READY, DB PENDING** — Ingest from `I1_2425.csv` & `I1_2526.csv`. |
| **Bundesliga** | `DEU-BUNDESLIGA` | NO (only 2016–2019) | YES (`python_engine/.../D1_*.csv`) | Present in CSV (`PAHH`/`PCAHH`) | Present in CSV (`PAHH`/`PCAHH`) | **FILE READY, DB PENDING** — Ingest from `D1_2425.csv` & `D1_2526.csv`. |
| **Ligue 1** | `FRA-LIGUE1` | NO (only 2016–2019) | YES (`python_engine/.../F1_*.csv`) | Present in CSV (`PAHH`/`PCAHH`) | Present in CSV (`PAHH`/`PCAHH`) | **FILE READY, DB PENDING** — Ingest from `F1_2425.csv` & `F1_2526.csv`. |
| **Eredivisie** | `NED-ERE` | NO (0 rows) | NO (0 files) | ABSENT | ABSENT | **EXCLUDED (SOURCE_DATA_ABSENT)** — No historical source file in repository. |
| **Primeira Liga** | `POR-PRIMEIRA` | NO (0 rows) | NO (0 files) | ABSENT | ABSENT | **EXCLUDED (SOURCE_DATA_ABSENT)** — No historical source file in repository. |

---

## 3. LIVE / UPCOMING DATA PLANE CAPABILITY

| Stage | Provider / Component | Verified Capability | Evidence |
| :--- | :--- | :--- | :--- |
| **Fixture Discovery** | API-Football (`GET /fixtures?league=39&season=2026&next=5`) | **FUNCTIONAL** | Returns verified upcoming fixtures (e.g. `1557393 Ipswich vs Liverpool` at `2026-09-04T19:00:00+00:00`). |
| **Odds Discovery** | OddsPAPI v4 (`GET /v4/odds-by-tournaments?tournamentIds=17&bookmaker=pinnacle`) | **FUNCTIONAL** | Returns 20 upcoming Premier League fixtures with live Pinnacle odds. |
| **Entity Linkage** | Canonical Entity Normalizer | **FUNCTIONAL** | Normalizes `Ipswich Town` (OddsPAPI) to `ipswich` and `Ipswich` (API-Football) to `ipswich`; matching kickoff timestamp `2026-09-04T19:00:00Z`. |
| **Market Normalization** | Native Odds Adapter (`src/lib/data/providers/odds/native/normalize.ts`) | **FUNCTIONAL** | Correctly maps OddsPAPI market `1072` (AH 0) and outcome `0.0/home` (price 4.96) / `0.0/away` (price 1.207) to `OddsSnapshot`. |
| **Input Validation** | Dixon-Coles / Poisson Input Contract | **FUNCTIONAL** | Requires real fixture metadata, teams, kickoff in future, home/away ratings, and valid market odds. |
| **Production Read Path** | `public.active_daily_picks` View | **FUNCTIONAL** | Empty right now (0 dummy picks). Ready to consume qualified real signals. |

---

## 4. QUOTA & RATE LIMIT GOVERNANCE

1. **API-Football:**
   - Plan: `Pro` (Active until 2026-09-11)
   - Limit: 7,500 requests/day
   - Rate limit: 10 requests/minute
   - Usage today: 6 / 7,500 requests
2. **OddsPAPI.io:**
   - Plan: Free tier
   - Limit: 250 requests/month (200 safe limit with 20% reserve in `quotaManagerV4.ts`)
   - Rate limit: 30 requests/minute
   - Constraint: Must use batch `odds-by-tournaments` endpoint with `bookmaker=pinnacle` to conserve quota (1 call per tournament instead of 1 call per fixture).
3. **Supabase Production Database:**
   - Health: Healthy, responsive
   - Verified row counts:
     - `historical_matches`: 8,898
     - `historical_odds`: 77,471
     - `archived_daily_picks`: 1,224 (quarantined synthetic rows from EPIC 63)
     - `daily_picks`: 0 (zero unverified/synthetic rows)
     - `active_daily_picks`: 0 (clean honest empty state)
