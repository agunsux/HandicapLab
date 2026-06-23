# HandicapLab

AI-powered football market intelligence platform.

Focused markets:
- Asian Handicap
- Over/Under
- Moneyline

Features:
- Pre-match analysis
- In-play signal detection
- EV estimation
- Transparent signal ledger
- Performance tracking

Disclaimer:
HandicapLab provides analytics only.
No betting automation.

---

## Sprint 2: API-Football Real Data Integration

We integrate with [API-Football](https://www.api-football.com/) to fetch real match results and historical stats for validation.

### Setup Instructions
1. Get a free API key by signing up at [dashboard.api-football.com](https://dashboard.api-football.com/).
2. Add your key to your `.env` file in the root directory:
   ```env
   API_FOOTBALL_KEY=your_actual_api_key_here
   ```
   *Note: If `API_FOOTBALL_KEY` is not set or configured as `"mock"`, the system runs in Mock Mode, generating realistic football stats for local testing without depleting your request quota.*

### Rate Limits & Caching
- **Daily Quota**: The free tier of API-Football allows **100 requests per day**.
- **Request Throttling**: A request delay of 1.5 seconds is automatically applied between network requests to avoid burst rate limit locks.
- **Persistent Cache**: Responses are cached locally in `./cache/api-football/` to ensure we never query the same endpoint with the same arguments twice.
- **Estimated Fetch Timeline**: Complete historical statistics for the Premier League, La Liga, and Serie A for seasons 2022-2024 require ~726 distinct endpoint statistic calls. Because of the daily limit, a full cache generation will take **~8 days** to complete incrementally. Runs should be made daily to populate the cache.

---

## 🛡️ Data Integrity & Leakage Prevention

To ensure institutional investor confidence and scientific prediction rigor, HandicapLab implements strict **Edge Leakage Prevention** measures. Preventing future-data bias (look-ahead bias) is crucial for backtesting authenticity and real-money profitability.

- **The Hard Gate**: Every feature extractor and prediction pipeline is guarded by a runtime checkpoint via `LeakageGuard.assertNoFutureData(matchId, cutoffDate)`.
- **Frozen Snapshots**: Market opening odds are frozen at prediction time and never mutated. Closing odds are populated only during settlement.
- **Outcomes Separation**: Actual outcomes, Brier scores, CLV, and profit/loss calculations are kept in separate settlement tables to preserve predictions.

For full developer guidelines and compliance checklists, read the comprehensive [docs/LEAKAGE_PREVENTION.md](file:///c:/Users/RYZEN/.antigravity-ide/HandicapLab/docs/LEAKAGE_PREVENTION.md) guide.


