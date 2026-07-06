# HandicapLab Feature Catalog

*Generated automatically from the Feature Registry*

Total Features: **4**

## xG

### Match xG (`match_xg`)
> Total Expected Goals for a team in a single match.

- **Formula:** `Sum of xG values for all shots taken by the team in the match`
- **Leakage Classification:** ✅ Safe *(Reason: Calculated from live match events, safely timestamped.)*
- **Time Travel Policy:** live
- **Data Type:** number | **Unit:** xG
- **Source:** Event Feed, Opta
- **Dependencies:** None
- **Version:** 1.0.0 (Formula: v1.0, Dep: v1.0)
- **Owner:** Quant Team

## Recent Form

### Rolling xG (5 Match) (`rolling_xg_5`)
> Average xG over the last 5 matches.

- **Formula:** `Moving average of match_xg over the previous 5 fixtures.`
- **Leakage Classification:** ✅ Safe *(Reason: Strictly excludes the current match from the window.)*
- **Time Travel Policy:** pre_match_only
- **Data Type:** number | **Unit:** xG
- **Source:** Feature Store
- **Dependencies:** `match_xg`
- **Version:** 1.0.0 (Formula: v1.0, Dep: v1.0)
- **Owner:** Quant Team

## Team Strength

### Team Attack Rating (`team_attack_rating`)
> Derived attacking strength combining rolling xG and actual goals.

- **Formula:** `(rolling_xg_5 * 0.7) + (rolling_goals_5 * 0.3)`
- **Leakage Classification:** ✅ Safe *(Reason: Relies purely on pre-match rolling aggregates.)*
- **Time Travel Policy:** pre_match_only
- **Data Type:** number | **Unit:** Rating
- **Source:** Feature Store
- **Dependencies:** `rolling_xg_5`
- **Version:** 1.0.0 (Formula: v1.0, Dep: v1.0)
- **Owner:** Quant Team

## Market

### Home Closing Odds (`closing_odds_home`)
> Pinnacle closing odds for home win.

- **Formula:** `Raw value at kickoff`
- **Leakage Classification:** ❌ Unsafe *(Reason: Using closing odds as a predictive feature introduces massive temporal leakage since they incorporate market knowledge right up to kickoff. Should only be used as a target/benchmark, never an input.)*
- **Time Travel Policy:** live
- **Data Type:** number | **Unit:** Decimal Odds
- **Source:** Odds API
- **Dependencies:** None
- **Version:** 1.0.0 (Formula: v1.0, Dep: v1.0)
- **Owner:** Quant Team

