# Canonical Schema Proposal

Based on the audit of the existing football datasets, we propose the following unified canonical schema.

## 1. Fixtures
The core table containing match events.
- `fixture_id` (UUID, Primary Key)
- `competition_id` (String, e.g., 'E0')
- `season` (String, e.g., '2019/2020')
- `match_date` (DateTime)
- `home_team` (String)
- `away_team` (String)
- `referee` (String)

## 2. Results
Contains the outcome of the fixtures.
- `fixture_id` (UUID, Foreign Key)
- `full_time_home_goals` (Int)
- `full_time_away_goals` (Int)
- `half_time_home_goals` (Int)
- `half_time_away_goals` (Int)
- `match_result` (Enum: H, D, A)

## 3. Markets & Odds
Stores bookmaker closing/opening lines.
- `fixture_id` (UUID, Foreign Key)
- `bookmaker` (String, e.g., 'Pinnacle', 'Bet365')
- `market_type` (Enum: Moneyline, AsianHandicap, OverUnder, BTTS)
- `selection` (String)
- `line` (Float, nullable)
- `odds` (Float)
- `timestamp` (DateTime)
- `is_closing` (Boolean)

## 4. Match Stats
For predictive feature engineering.
- `fixture_id` (UUID, Foreign Key)
- `home_shots`, `away_shots` (Int)
- `home_shots_on_target`, `away_shots_on_target` (Int)
- `home_fouls`, `away_fouls` (Int)
- `home_corners`, `away_corners` (Int)
- `home_yellow`, `away_yellow` (Int)
- `home_red`, `away_red` (Int)

## 5. Predictions
Stores the output of quantitative models.
- `prediction_id` (UUID, Primary Key)
- `fixture_id` (UUID, Foreign Key)
- `model_version` (String)
- `market_type` (Enum)
- `selection` (String)
- `predicted_probability` (Float)
- `expected_value` (Float)
- `kelly_stake` (Float)
- `created_at` (DateTime)
