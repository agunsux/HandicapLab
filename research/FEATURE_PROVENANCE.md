# Feature Provenance Registry

This registry tracks the source and leakage safety of all features used in our models.

> **Invariant**: Tidak boleh ada feature yang berasal dari data dengan timestamp ≥ kickoff pertandingan yang diprediksi.

| Feature | Source | Window | Leakage Safe | Notes |
|---------|--------|--------|--------------|-------|
| `rolling_xg_3` | Understat | 3 Matches | ✅ | Trailing 3 matches before kickoff |
| `rolling_xg_5` | Understat | 5 Matches | ✅ | Trailing 5 matches before kickoff |
| `rolling_xg_8` | Understat | 8 Matches | ✅ | Trailing 8 matches before kickoff |
| `rolling_xg_10` | Understat | 10 Matches | ✅ | Trailing 10 matches before kickoff |
| `ema_xg` | Understat | Dynamic (EMA) | ✅ | Exponential moving average before kickoff |
| `rolling_xga_3` | Understat | 3 Matches | ✅ | Trailing 3 matches before kickoff |
| `rolling_xga_5` | Understat | 5 Matches | ✅ | Trailing 5 matches before kickoff |
| `rolling_xga_8` | Understat | 8 Matches | ✅ | Trailing 8 matches before kickoff |
| `rolling_xga_10` | Understat | 10 Matches | ✅ | Trailing 10 matches before kickoff |
| `ema_xga` | Understat | Dynamic (EMA) | ✅ | Exponential moving average before kickoff |
| `elo` | Internal | Dynamic | ✅ | K=32, HFA=50, calculated up to T-1 |
| `bookmaker_prob`| Football-Data| Matchday | ✅ | Pre-match implied probabilities |
| `closing_odds` | Football-Data| Closing | ⚠️ | Hanya untuk evaluasi ROI / CLV |
| `league_position`| Derived | Matchday | ✅ | Standings before kickoff |
