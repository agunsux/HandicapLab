# EPIC-66 — Global Historical Market Discovery & Profitability Research Specification

**Status**: IN_PROGRESS  
**Lead System**: Antigravity Research Engine  
**Product Objective**: Discover empirically profitable market/line configurations across Asian Handicap (AH), Over/Under (OU), and Both Teams To Score (BTTS) over two completed seasons across a global league universe.  
**Operating Philosophy**: DATA FIRST. MARKET FIRST. MODEL SECOND. PRODUCTION LAST.  

---

## 1. Executive Summary & Research Mandate

Instead of searching for a black-box "AI model", HandicapLab operates like a quantitative market intelligence platform (Bloomberg Terminal for football markets). We systematically test all historical market lines to determine:
1. Which lines/configurations exhibit structural market bias or pricing inefficiencies.
2. Across which segments mathematical modeling (Dixon-Coles bivariate goal expectancy) generates statistically significant Closing Line Value (CLV) and positive risk-adjusted ROI.
3. Whether these edges survive out-of-sample forward walk testing.

---

## 2. Global League Universe (`GLOBAL_TIER_1_AND_FANBASE`)

We curate a 30-competition registry covering 4 geographic regions:
- **Europe (19 leagues)**: England Premier League, Championship, Spain La Liga, Italy Serie A, Germany Bundesliga, France Ligue 1, Netherlands Eredivisie, Portugal Primeira Liga, Belgium Pro League, Turkey Süper Lig, Scotland Premiership, Greece Super League, Austria Bundesliga, Switzerland Super League, Denmark Superliga, Norway Eliteserien, Sweden Allsvenskan, Poland Ekstraklasa, Czech First League.
- **Americas (6 leagues)**: Brazil Serie A, Argentina Liga Profesional, Colombia Primera A, Chile Primera División, USA MLS, Mexico Liga MX.
- **Asia & Oceania (5 leagues)**: Japan J1, South Korea K League 1, China Super League, Saudi Pro League, Indonesia Liga 1, Australia A-League.

### Completed Seasons Rule:
- For split-year calendars (Europe, Saudi, Mexico): The two most recent completed seasons are `2024-2025` and `2025-2026` (or `2023-2024` and `2024-2025` based on league completion).
- For calendar-year calendars (Brazil, Argentina, MLS, Japan, Korea, Norway, Sweden): The two most recent completed seasons are calendar years `2024` and `2025`.
- **Absolute Invariant**: The active, uncompleted `2026/27` or ongoing 2026 calendar season is strictly excluded from completed backtest evaluations.

---

## 3. Market Spectrum

### A. Asian Handicap (AH)
17 discrete lines tested:
$$-2.00, -1.75, -1.50, -1.25, -1.00, -0.75, -0.50, -0.25, 0.00, +0.25, +0.50, +0.75, +1.00, +1.25, +1.50, +1.75, +2.00$$
Categorized into 7 structural segments:
1. `DEEP_FAVORITE` ($[-3.0, -1.5]$)
2. `CLEAR_FAVORITE` ($[-1.25, -0.75]$)
3. `SLIGHT_FAVORITE` ($[-0.50, -0.25]$)
4. `PICKEM` ($0.00$)
5. `SLIGHT_UNDERDOG` ($[+0.25, +0.50]$)
6. `CLEAR_UNDERDOG` ($[+0.75, +1.25]$)
7. `DEEP_UNDERDOG` ($[+1.50, +3.0]$)

### B. Over / Under (OU)
15 discrete Asian totals tested:
$$0.50, 0.75, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00, 3.25, 3.50, 3.75, 4.00$$

### C. Both Teams To Score (BTTS)
Deterministic derivation from fulltime scores:
- `BTTS Yes`: $\text{Home Goals} \ge 1 \land \text{Away Goals} \ge 1$
- `BTTS No`: Otherwise

---

## 4. Deterministic Settlement Rigor

Quarter lines are settled by decomposing the stake into two adjacent half/integer bets:
- **AH -0.25** on 1-1 draw: Split into AH 0 (Push, refund 0.5) and AH -0.5 (Loss, lose 0.5) $\rightarrow$ **Half-Loss** ($-0.50$ units).
- **AH +0.25** on 1-1 draw: Split into AH 0 (Push, refund 0.5) and AH +0.5 (Win, $+0.5 \times (odds - 1)$) $\rightarrow$ **Half-Win** ($+0.5 \times (odds - 1)$ units).
- **OU 2.25** on 2 goals: Split into Over 2.0 (Push) and Over 2.5 (Loss) $\rightarrow$ **Half-Loss**.
- **OU 2.75** on 3 goals: Split into Over 2.5 (Win) and Over 3.0 (Push) $\rightarrow$ **Half-Win**.

---

## 5. Walk-Forward Validation & Leakage Prevention

1. **Chronological Sorting**: Every match is evaluated strictly in chronological order:
   $$\text{Timestamp}_i \le \text{Timestamp}_{i+1}$$
2. **Strict Pre-Kickoff Features**: Rolling Poisson scoring/conceding rates and Elo ratings are computed strictly from matches completed **prior** to the current fixture kickoff. Post-match score updates occur strictly **after** prediction and bet registration.
3. **Out-of-Sample Separation**:
   - Season 1: In-sample baseline calibration.
   - Season 2: Out-of-sample forward evaluation.

---

## 6. Statistical Gating & Robustness

1. **Sample Size Gating**:
   - $N < 100$: Disqualified.
   - $100 \le N < 250$: Discovery (Yellow).
   - $250 \le N < 500$: Candidate (Yellow/Green).
   - $N \ge 500$: Production Candidate (Green/Gold).
2. **Multiple Hypothesis Testing Correction**:
   - Benjamini-Hochberg False Discovery Rate (FDR) applied across all market $\times$ league combinations ($q < 0.05$).
3. **Classification Tiers**:
   - `RED`: ROI $< 0$.
   - `GREY`: Inconclusive ($p \ge 0.05$).
   - `YELLOW`: Positive ROI, low sample size ($N < 250$).
   - `GREEN`: Positive ROI, $N \ge 250$, statistically significant ($p < 0.05$).
   - `GOLD`: Positive ROI, $N \ge 500$, positive CLV, robust cross-season out-of-sample.

---

## 7. Production Isolation Invariant

No strategy will automatically generate production picks until explicitly approved by the user through a formal Promotion Gate. `public.active_daily_picks` remains at **0**.
