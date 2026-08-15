# REAL ODDS VALIDATION REPORT

- Model: poisson-historical-v2-repaired
- Odds provider: football-data.co.uk (Pinnacle)
- Source type: REAL_PROVIDER
- Total bets: 4122
- ROI: -0.0402
- CLV avg: -0.0013
- ROI 95% CI: [-0.08237364630334498,0.0018738889040241513]
- Profitability status: NOT_PROFITABLE

## Overall
```json
{
  "bets": 4122,
  "wins": 1643,
  "losses": 2388,
  "pushes": 23,
  "half_wins": 29,
  "half_losses": 39,
  "hit_rate": 0.3986,
  "stake": 4122,
  "profit": -165.91,
  "roi": -0.0402,
  "avg_ev": 0.0241,
  "clv": -0.0013,
  "max_drawdown": -178.5,
  "roi_ci95": [
    -0.08237364630334498,
    0.0018738889040241513
  ]
}
```
## Thresholds
```json
{
  "0.01": {
    "bets": 1710,
    "wins": 508,
    "losses": 1191,
    "pushes": 2,
    "half_wins": 8,
    "half_losses": 1,
    "hit_rate": 0.2971,
    "stake": 1710,
    "profit": -102.36,
    "roi": -0.0599,
    "avg_ev": 0.3227,
    "clv": -0.00136,
    "max_drawdown": -127.33,
    "roi_ci95": [
      -0.139691308251326,
      0.01997201000571197
    ]
  },
  "0.02": {
    "bets": 1628,
    "wins": 470,
    "losses": 1147,
    "pushes": 2,
    "half_wins": 8,
    "half_losses": 1,
    "hit_rate": 0.2887,
    "stake": 1628,
    "profit": -114.32,
    "roi": -0.0702,
    "avg_ev": 0.3382,
    "clv": -0.00125,
    "max_drawdown": -134.15,
    "roi_ci95": [
      -0.15273608967290075,
      0.012293829230640305
    ]
  },
  "0.03": {
    "bets": 1548,
    "wins": 440,
    "losses": 1097,
    "pushes": 2,
    "half_wins": 8,
    "half_losses": 1,
    "hit_rate": 0.2842,
    "stake": 1548,
    "profit": -105.62,
    "roi": -0.0682,
    "avg_ev": 0.3544,
    "clv": -0.00113,
    "max_drawdown": -123.03,
    "roi_ci95": [
      -0.15387893312910994,
      0.01741898480869647
    ]
  },
  "0.05": {
    "bets": 1427,
    "wins": 401,
    "losses": 1018,
    "pushes": 2,
    "half_wins": 6,
    "half_losses": 0,
    "hit_rate": 0.281,
    "stake": 1427,
    "profit": -80.71,
    "roi": -0.0566,
    "avg_ev": 0.3811,
    "clv": -0.00092,
    "max_drawdown": -103.88,
    "roi_ci95": [
      -0.14775338483072653,
      0.03463495455742585
    ]
  },
  "0.07": {
    "bets": 1304,
    "wins": 360,
    "losses": 938,
    "pushes": 0,
    "half_wins": 6,
    "half_losses": 0,
    "hit_rate": 0.2761,
    "stake": 1304,
    "profit": -60.67,
    "roi": -0.0465,
    "avg_ev": 0.4114,
    "clv": -0.00069,
    "max_drawdown": -90.04,
    "roi_ci95": [
      -0.14417596905761332,
      0.05112382181834953
    ]
  }
}
```
## Markets
```json
{
  "ML": {
    "bets": 2202,
    "wins": 734,
    "losses": 1468,
    "pushes": 0,
    "half_wins": 0,
    "half_losses": 0,
    "hit_rate": 0.3333,
    "stake": 2202,
    "profit": -89.17,
    "roi": -0.0405,
    "avg_ev": 0.1087,
    "clv": 0,
    "max_drawdown": -106.72,
    "roi_ci95": [
      -0.1095401946895176,
      0.028550185606865494
    ]
  },
  "OU25": {
    "bets": 1464,
    "wins": 732,
    "losses": 732,
    "pushes": 0,
    "half_wins": 0,
    "half_losses": 0,
    "hit_rate": 0.5,
    "stake": 1464,
    "profit": -53.85,
    "roi": -0.0368,
    "avg_ev": -0.0128,
    "clv": -0.00404,
    "max_drawdown": -54.56,
    "roi_ci95": [
      -0.0879945107679275,
      0.014428936997435679
    ]
  },
  "AH": {
    "bets": 456,
    "wins": 177,
    "losses": 188,
    "pushes": 23,
    "half_wins": 29,
    "half_losses": 39,
    "hit_rate": 0.3882,
    "stake": 456,
    "profit": -22.89,
    "roi": -0.0502,
    "avg_ev": -0.2663,
    "clv": 0.00122,
    "max_drawdown": -26.88,
    "roi_ci95": [
      -0.1329000274234007,
      0.03250529058129545
    ]
  }
}
```
## CLV
```json
{
  "available": true,
  "count": 4122,
  "avg": -0.0013,
  "positive_pct": 0.4859,
  "by_market": {
    "ML": {
      "bets": 2202,
      "wins": 734,
      "losses": 1468,
      "pushes": 0,
      "half_wins": 0,
      "half_losses": 0,
      "hit_rate": 0.3333,
      "stake": 2202,
      "profit": -89.17,
      "roi": -0.0405,
      "avg_ev": 0.1087,
      "clv": 0,
      "max_drawdown": -106.72,
      "roi_ci95": [
        -0.1095401946895176,
        0.028550185606865494
      ]
    },
    "OU25": {
      "bets": 1464,
      "wins": 732,
      "losses": 732,
      "pushes": 0,
      "half_wins": 0,
      "half_losses": 0,
      "hit_rate": 0.5,
      "stake": 1464,
      "profit": -53.85,
      "roi": -0.0368,
      "avg_ev": -0.0128,
      "clv": -0.00404,
      "max_drawdown": -54.56,
      "roi_ci95": [
        -0.0879945107679275,
        0.014428936997435679
      ]
    },
    "AH": {
      "bets": 456,
      "wins": 177,
      "losses": 188,
      "pushes": 23,
      "half_wins": 29,
      "half_losses": 39,
      "hit_rate": 0.3882,
      "stake": 456,
      "profit": -22.89,
      "roi": -0.0502,
      "avg_ev": -0.2663,
      "clv": 0.00122,
      "max_drawdown": -26.88,
      "roi_ci95": [
        -0.1329000274234007,
        0.03250529058129545
      ]
    }
  }
}
```
## Monthly
```json
[
  {
    "month": "2022-08",
    "bets": 275,
    "stake": 275,
    "profit": -10.88,
    "roi": -0.0395,
    "clv": 0.00166
  },
  {
    "month": "2022-09",
    "bets": 101,
    "stake": 101,
    "profit": -4.47,
    "roi": -0.0443,
    "clv": 0.00051
  },
  {
    "month": "2022-10",
    "bets": 330,
    "stake": 330,
    "profit": -2.28,
    "roi": -0.0069,
    "clv": -0.00001
  },
  {
    "month": "2022-11",
    "bets": 115,
    "stake": 115,
    "profit": 2.67,
    "roi": 0.0232,
    "clv": -0.00208
  },
  {
    "month": "2022-12",
    "bets": 102,
    "stake": 102,
    "profit": -9.74,
    "roi": -0.0955,
    "clv": 0.00049
  },
  {
    "month": "2023-08",
    "bets": 166,
    "stake": 166,
    "profit": -27.33,
    "roi": -0.1646,
    "clv": -0.00002
  },
  {
    "month": "2023-09",
    "bets": 214,
    "stake": 214,
    "profit": -9.46,
    "roi": -0.0442,
    "clv": -0.00481
  },
  {
    "month": "2023-10",
    "bets": 185,
    "stake": 185,
    "profit": -17.6,
    "roi": -0.0951,
    "clv": -0.00146
  },
  {
    "month": "2023-11",
    "bets": 172,
    "stake": 172,
    "profit": -1.18,
    "roi": -0.0069,
    "clv": -0.00487
  },
  {
    "month": "2023-12",
    "bets": 373,
    "stake": 373,
    "profit": -2.42,
    "roi": -0.0065,
    "clv": -0.00244
  },
  {
    "month": "2024-08",
    "bets": 141,
    "stake": 141,
    "profit": -14.79,
    "roi": -0.1049,
    "clv": -0.0013
  },
  {
    "month": "2024-09",
    "bets": 183,
    "stake": 183,
    "profit": -5.11,
    "roi": -0.0279,
    "clv": -0.00308
  },
  {
    "month": "2024-10",
    "bets": 170,
    "stake": 170,
    "profit": -10.58,
    "roi": -0.0622,
    "clv": -0.0012
  },
  {
    "month": "2024-11",
    "bets": 204,
    "stake": 204,
    "profit": 10.36,
    "roi": 0.0508,
    "clv": -0.00321
  },
  {
    "month": "2024-12",
    "bets": 348,
    "stake": 348,
    "profit": -7.32,
    "roi": -0.021,
    "clv": -0.0003
  },
  {
    "month": "2025-08",
    "bets": 165,
    "stake": 165,
    "profit": -3.99,
    "roi": -0.0242,
    "clv": -0.00433
  },
  {
    "month": "2025-09",
    "bets": 170,
    "stake": 170,
    "profit": -9.38,
    "roi": -0.0551,
    "clv": -0.001
  },
  {
    "month": "2025-10",
    "bets": 168,
    "stake": 168,
    "profit": -4.96,
    "roi": -0.0295,
    "clv": 0.00177
  },
  {
    "month": "2025-11",
    "bets": 222,
    "stake": 222,
    "profit": -12.75,
    "roi": -0.0574,
    "clv": 0.00082
  },
  {
    "month": "2025-12",
    "bets": 318,
    "stake": 318,
    "profit": -24.74,
    "roi": -0.0778,
    "clv": -0.00162
  }
]
```
## Placebo control
```json
{
  "method": "shuffled model probabilities (seeded 42), EV>=1% ML filter",
  "bets": 1377,
  "profit": -54.99,
  "roi": -0.0399,
  "expected": "ROI ~ 0 or negative; positive placebo ROI would flag data-mining"
}
```