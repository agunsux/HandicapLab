# EPIC 62 — STAGE 2 FORENSIC DATA GOVERNANCE REPORT
### Data Inventory Verification, `var_era` Status Correction & Market Constraint Locking

**Audit Date:** 2026-09-02  
**Governance Scope:** EPIC 62 Stage 2 Finalization  
**Final Gate:** **STAGE 2 PASS — DATA INVENTORY & CONSTRAINTS PROVEN. STAGE 3 = BLOCKED.**

---

## 1. Executive Summary & Scope Boundary

This document records the authoritative data governance findings and locked invariants established during the EPIC 62 Stage 2 forensic audit of the historical gold dataset across five European leagues.

### Strict Scope Boundary
- **Audit & Governance Only:** No Stage 3 design or code implementation has commenced.
- **No Model Building / No Backtests:** Prediction engines, scoring algorithms, and backtest loops remain untouched.
- **Zero Data Mutation:** No historical gold records, odds rows, scores, or timestamps were rewritten or altered.
- **Zero Synthetic Data:** No synthetic, interpolated, or fallback odds were created or permitted.
- **Stage 3 Status:** **HARD BLOCKED**. Stage 3 requires explicit owner approval after the EPIC 60 Stage B scope question is separately resolved.

---

## 2. Definitive Correction of `var_era` Implementation Status

The implementation status of `var_era` is formally recorded as:

> **"Schema support exists, but VAR-era classification is not materialized in the canonical gold dataset or active DB rows."**

### Forensic Evidence
1. **Database Schema:** Migration [`supabase/migrations/00000000000046_var_era_scoping.sql`](file:///c:/Users/RYZEN/.antigravity-ide/HandicapLab/supabase/migrations/00000000000046_var_era_scoping.sql) added column `matches.var_era BOOLEAN NOT NULL DEFAULT FALSE`.
2. **Active Database State:** Active Supabase `matches` table contains **0 rows with `var_era = true`** and **495 rows with `var_era = false`**.
3. **Canonical Gold JSONL:** Out of **8,898 matches** in [`data/golden/europe/canonical_matches.jsonl`](file:///c:/Users/RYZEN/.antigravity-ide/HandicapLab/data/golden/europe/canonical_matches.jsonl), exactly **0 rows contain the `var_era` field**.
4. **Governance Invariant:** The database field `matches.var_era` is **NOT authoritative** for historical backtesting. The gold dataset MUST NOT be backfilled or mutated merely to make implementation appear complete.

---

## 3. Authoritative VAR-Era Determination Rule

For all research, walk-forward splits, and backtesting (Stage 3 and beyond):

$$\text{VAR Eligibility} \equiv \text{Kickoff Timestamp} \ge \text{League-Specific VAR Cutoff}$$

VAR eligibility MUST NOT be queried from `matches.var_era`.

### Authoritative Cutoff Dates
- **`ENG-PL` (Premier League):** `2019-08-01`
- **`ESP-LALIGA` (La Liga):** `2018-08-01`
- **`DEU-BUNDESLIGA` (Bundesliga):** `2017-08-01`
- **`ITA-SERIEA` (Serie A):** `2017-08-01`
- **`FRA-LIGUE1` (Ligue 1):** `2018-08-01`

### Cohort Classification Invariant
The resulting **5,172 matches** (out of 8,898, or 58.13%) MUST be documented and labeled strictly as:

$$\mathbf{\text{“theoretical date-qualified VAR-era cohort”}}$$

They MUST NOT be designated as *"verified VAR-era matches"*. Date qualification is a deterministic research scoping rule, not match-level operational verification of video assistant referee deployment.

---

## 4. Preserved Data Inventory Findings

The audit confirmed the exact composition of the canonical gold dataset:

| League Code | League Name | Total Matches | AH Covered Matches | AH Odds Rows | OU Covered Matches (Line 2.5) | OU Odds Rows (Line 2.5) | BTTS Odds Rows | Duplicate Fixtures |
|---|---|---|---|---|---|---|---|---|
| `ENG-PL` | Premier League | 4,180 | 4,179 | 11,202 | 4,180 | 11,208 | 0 | 0 |
| `ESP-LALIGA` | La Liga | 1,520 | 1,518 | 4,073 | 1,520 | 4,075 | 0 | 0 |
| `DEU-BUNDESLIGA` | Bundesliga | 918 | 918 | 2,458 | 918 | 2,460 | 0 | 0 |
| `ITA-SERIEA` | Serie A | 1,140 | 1,140 | 3,055 | 1,140 | 3,056 | 0 | 0 |
| `FRA-LIGUE1` | Ligue 1 | 1,140 | 1,140 | 3,076 | 1,140 | 3,076 | 0 | 0 |
| **Total** | **5 Leagues** | **8,898** | **8,895** | **23,864** | **8,898** | **23,875** | **0** | **0** |

- **Fixture Deduplication:** Clean across all leagues. The 1,520 raw duplicates in EPL bronze sources were eliminated during gold ingestion, leaving zero duplicate fixtures in canonical records.
- **Non-European Leagues:** 19 additional registered leagues remain schema placeholders with 0 matches.

---

## 5. Market-Specific Historical Constraints

### A. Over/Under (OU): Restricted Exclusively to Line 2.5
- Historical OU odds rows: **23,875 rows (100.0% on line 2.5)**.
- Historical OU odds on all other lines (0.5, 1.5, 2.0, 2.25, 2.75, 3.0, 3.5, etc.): **0 rows**.
- **Binding Invariant:** Historical OU profitability validation (ROI, EV, CLV, Kelly stakes, trading signals) is strictly restricted to **Line 2.5**. Non-2.5 lines may only be represented as mathematical probability distributions derived from bivariate score matrices; they MUST NOT produce historical profitability claims unless real odds are ingested and validated with full provenance.

### B. Both Teams To Score (BTTS): Calibration-Only Mode
- Historical BTTS odds rows: **EXACTLY 0 ROWS (N=0)**.
- Historical match scorelines contain 100% ground-truth outcomes (`btts: true|false`), allowing statistical probability evaluation:
  - Brier Score
  - Log Loss
  - Expected Calibration Error (ECE)
  - Calibration reliability curves
- **Binding Invariant:** BTTS MUST NOT produce historical EV, CLV, ROI, Kelly stakes, or profitability claims. Fabricating synthetic, interpolated, or model-inverted odds is strictly prohibited.

---

## 6. Universal Real-Data Profitability Gate

```
NO REAL HISTORICAL ODDS
         ↓
       NO EV
         ↓
      NO CLV
         ↓
      NO ROI
         ↓
     NO KELLY
         ↓
NO PROFITABILITY CLAIM
```

Any missing or unproven market odds MUST result in `EXCLUDED_FROM_PROFITABILITY_BACKTEST`. Prohibited practices:
- No fabrication of odds
- No interpolation between lines
- No estimation of margins
- No using live odds for historical matches
- No substituting model fair odds for bookmaker market odds
- No fallback or default odds values (e.g. assigning 1.95/1.95)

---

## 7. AH Market Provenance Requirements

For an Asian Handicap observation to be admitted into historical backtesting, all of the following market provenance fields must be proven:
1. `matchId` / Canonical fixture linkage
2. Kickoff timestamp
3. Market designation (`AH`)
4. Handicap line (`line`)
5. Selection / Side (`home` / `away`)
6. Odds price (`takenOdds` and `closingOdds`)
7. Bookmaker source (Pinnacle primary, SBOBET secondary)
8. Provenance observation timestamp (opening / closing)
9. Verified final match score

Observations missing any required field must be disqualified, not silently imputed.

---

## 8. Anti-Leakage Pipeline Order

All future backtest execution (Stage 3 and beyond) must enforce point-in-time causality:

$$\text{Historical Prior Data } (T_{\text{match}} < T_{\text{pred}}) \implies \text{Prediction } (T_{\text{pred}} \le T_{\text{kickoff}}) \implies \text{Odds Snapshot } (T_{\text{odds}} \le T_{\text{kickoff}}) \implies \text{Settlement } (T_{\text{settle}} > T_{\text{kickoff}})$$

Strictly prohibited in feature extraction:
- Future match outcomes
- Closing odds movement occurring after prediction timestamp
- Match-day statistics or lineup data unavailable at prediction cutoff
- Post-match retrospective adjustments

---

## 9. Gate Status

- **STAGE 2 STATUS:** **PASS — DATA INVENTORY & CONSTRAINTS PROVEN**
- **STAGE 3 STATUS:** **BLOCKED**

No Stage 3 model design, code, or backtesting may commence without explicit sign-off and separate resolution of the EPIC 60 Stage B scope question.
