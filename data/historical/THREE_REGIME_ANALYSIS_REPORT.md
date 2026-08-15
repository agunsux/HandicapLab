# THREE-REGIME ANALYSIS REPORT

- Model: poisson-historical-v2-repaired
- Frozen commit: 2deac1e9434c2ddd4ad022a30149d1b9c5383528
- Odds provider: football-data.co.uk (Pinnacle)
- Source type: REAL_PROVIDER

## Master Table
```json
{
  "C1": {
    "date_range": "2022-08-01 → 2024-06-30",
    "fixtures": 360,
    "odds_records": 5846,
    "bets": 2033,
    "ml_bets": 1080,
    "ou_bets": 718,
    "ah_bets": 235,
    "btts_bets": 0,
    "roi": -0.0407,
    "avg_ev": 0.0354,
    "clv": -0.00134,
    "logloss": 1.01218,
    "brier": 0.60381,
    "ece": 0.14181,
    "max_drawdown": -104.63,
    "roi_ci95": [
      -0.1023,
      0.021
    ],
    "positive_months": 1,
    "negative_months": 9
  },
  "C2": {
    "date_range": "2024-08-01 → 2025-12-31",
    "fixtures": 374,
    "odds_records": 4422,
    "bets": 2089,
    "ml_bets": 1122,
    "ou_bets": 746,
    "ah_bets": 221,
    "btts_bets": 0,
    "roi": -0.0398,
    "avg_ev": 0.013,
    "clv": -0.00126,
    "logloss": 1.02257,
    "brier": 0.61174,
    "ece": 0.1275,
    "max_drawdown": -87.86,
    "roi_ci95": [
      -0.0974,
      0.0177
    ],
    "positive_months": 1,
    "negative_months": 9
  },
  "C3": {
    "date_range": "2026-01-01 → latest",
    "fixtures": 0,
    "odds_records": 182,
    "bets": 0,
    "ml_bets": 0,
    "ou_bets": 0,
    "ah_bets": 0,
    "btts_bets": 0,
    "roi": null,
    "avg_ev": null,
    "clv": null,
    "logloss": 1.09481,
    "brier": 0.66739,
    "ece": 0.12528,
    "max_drawdown": null,
    "roi_ci95": null,
    "positive_months": 0,
    "negative_months": 0
  }
}
```
## Regime Classification
```json
{
  "C1C2": 0.867,
  "C2C3": 0.647,
  "C1C3": 0.589,
  "classification": "INSUFFICIENT_EVIDENCE (C3 sample too small)"
}
```
## Placebo Controls
```json
{
  "C1": {
    "cluster": "C1",
    "method": "shuffled ML probabilities, EV>=1% filter",
    "bets": 708,
    "profit": -33.71,
    "roi": -0.0476
  },
  "C2": {
    "cluster": "C2",
    "method": "shuffled ML probabilities, EV>=1% filter",
    "bets": 713,
    "profit": 6.34,
    "roi": 0.0089
  },
  "C3": {
    "cluster": "C3",
    "method": "shuffled ML probabilities, EV>=1% filter",
    "bets": 0,
    "profit": 0,
    "roi": null
  }
}
```
## Notes
C3 real-odds coverage is thin (182 pairs, 24 matches) because OddsPAPI historical odds only begin Jan 2026 and the CSV source has limited 2026 rows. C3 bets reported accordingly.