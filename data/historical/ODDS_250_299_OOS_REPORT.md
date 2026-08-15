# ODDS 2.50-2.99 OOS VALIDATION REPORT

- Hypothesis: entry_odds >= 2.5 AND <= 2.99
- Model: poisson-historical-v2-repaired
- Frozen commit: 2deac1e9434c2ddd4ad022a30149d1b9c5383528
- C3 source required: OddsPAPI (Pinnacle/Circa/SBO) — REQUIRED, NOT AVAILABLE

## C1 (Historical)
```json
{
  "cluster": "C1",
  "bets": 133,
  "wins": 54,
  "losses": 79,
  "pushes": 0,
  "half_wins": 0,
  "half_losses": 0,
  "stake": 133,
  "profit": 12.44,
  "roi": 0.0935,
  "avg_ev": 0.111,
  "median_ev": 0.2197,
  "clv": -0.00419,
  "median_clv": -0.00165,
  "positive_clv_pct": 0.4511,
  "hit_rate": 0.406,
  "max_drawdown": -13.06,
  "roi_ci95": [
    -0.1326,
    0.3197
  ],
  "positive_months": 5,
  "negative_months": 5,
  "avg_monthly_roi": 0.0565,
  "best_month": {
    "month": "2022-09",
    "roi": 0.5686
  },
  "worst_month": {
    "month": "2023-08",
    "roi": -0.4229
  }
}
```
## C2 (Recent)
```json
{
  "cluster": "C2",
  "bets": 182,
  "wins": 76,
  "losses": 106,
  "pushes": 0,
  "half_wins": 0,
  "half_losses": 0,
  "stake": 182,
  "profit": 23.42,
  "roi": 0.1287,
  "avg_ev": 0.0683,
  "median_ev": 0.1237,
  "clv": -0.00125,
  "median_clv": -0.001755,
  "positive_clv_pct": 0.4615,
  "hit_rate": 0.4176,
  "max_drawdown": -9.45,
  "roi_ci95": [
    -0.066,
    0.3234
  ],
  "positive_months": 5,
  "negative_months": 5,
  "avg_monthly_roi": 0.1211,
  "best_month": {
    "month": "2024-08",
    "roi": 0.5384
  },
  "worst_month": {
    "month": "2025-09",
    "roi": -0.202
  }
}
```
## C3 (Current OOS)
```json
{
  "cluster": "?",
  "bets": 0,
  "wins": 0,
  "losses": 0,
  "pushes": 0,
  "half_wins": 0,
  "half_losses": 0,
  "stake": 0,
  "profit": 0,
  "roi": null,
  "avg_ev": null,
  "median_ev": null,
  "clv": null,
  "median_clv": null,
  "positive_clv_pct": null,
  "hit_rate": null,
  "max_drawdown": null,
  "roi_ci95": null,
  "positive_months": 0,
  "negative_months": 0,
  "avg_monthly_roi": null,
  "best_month": null,
  "worst_month": null
}
```
## Linkage
```json
{
  "oddspapi_records_received": 0,
  "valid_records": 0,
  "duplicate_records": 0,
  "unmatched_fixtures": 0,
  "matched_fixtures": 0,
  "unmatched_markets": 0,
  "matched_markets": 0,
  "matched_predictions": 0,
  "matched_250_299_opportunities": 0,
  "oddspapi_data_present": false,
  "credential_status": "BLOCKED — ODDS_PAPI_KEY resolves to empty string locally (phase_e2); prior key rejected HTTP 401 INVALID_API_KEY",
  "blocked_reason": "No OddsPAPI data has been ingested anywhere in the repository; the only 2026+ odds are football-data.co.uk Pinnacle (not OddsPAPI). Per EPIC section 3/4, OddsPAPI is the sole acceptable C3 source and substitution is forbidden.",
  "decision": "C3_VALIDATION_BLOCKED"
}
```
## Placebo
```json
{
  "method": "shuffled ML probabilities, 2.50-2.99 band, EV>=1%",
  "bets": 111,
  "profit": 29.67,
  "roi": 0.2673
}
```
## Final Decision
E — C3 VALIDATION BLOCKED