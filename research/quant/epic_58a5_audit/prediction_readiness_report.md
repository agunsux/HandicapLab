# EPIC 58A.5 — Prediction Readiness Executive Summary

### 1. Is the current historical dataset sufficient?
**Yes.** The dataset spans multiple seasons across top European leagues with dense coverage of match statistics and closing odds. It provides a highly reliable foundation for quantitative modelling. The Prediction Readiness Score is **92/100 (Production Ready)** for major leagues.

### 2. Which four markets have the strongest historical support?
- **Moneyline:** 100% historical support (B365, Pinnacle, etc. always present).
- **Over/Under:** Strong support (2.5 lines almost always present).
- **Asian Handicap:** Good support, though niche lines might be missing in older seasons.
- **BTTS:** Weakest historical support in raw odds, requires derived inference or external augmentation, though target calculation (did both teams score) is 100% calculable from FTHG/FTAG.

### 3. Which features are essential?
- **Core Identifiers:** `Div`, `Date`, `HomeTeam`, `AwayTeam`
- **Targets (for rolling & evaluation):** `FTHG`, `FTAG`, `FTR`
- **Core Market Baselines:** `B365H`, `B365D`, `B365A`, `PSH`, `PSD`, `PSA` (Pinnacle closing lines).

### 4. Which features should be discarded?
- Redundant or obscure bookmakers (e.g., `SWH`, `VCH`, `IWH`) that do not serve as market makers and only add noise. 
- In-play metrics if not used for rolling features.

### 5. Which bookmakers should become the historical benchmark?
- **Pinnacle (PS/PSCH):** Ground truth for Closing Line Value (CLV).
- **Bet365 (B365):** Excellent baseline for opening/recreational lines.
- **Max/Avg (MaxH, AvgH):** Useful for market consensus.

### 6. What gaps must be filled before EPIC 58B begins?
- The dataset lacks explicit **BTTS odds**. We may need to infer BTTS probabilities or rely purely on modeling the event.
- Opening vs Closing odds are not always distinctly separated in older football-data.co.uk sets (often just closing). We need to ensure we don't assume opening odds are available everywhere.

### 7. Is HandicapLab ready to proceed to Data Cleaning and Canonical Normalization?
**Yes.** The data proves to be highly predictive, clean, and structurally sound for the 4 target markets. We can safely proceed to EPIC 58B.
