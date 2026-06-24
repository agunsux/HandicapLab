# LIVE READINESS REPORT

DATABASE: FAIL
PROVIDER: PASS
INGESTION: FAIL
PREDICTION: FAIL
PAPER TRADING: FAIL
WORLD CUP: AVAILABLE

---

## Detailed Activation Status

### 1. DATABASE SCHEMA: ❌ FAIL
The manual SQL migration has **NOT** been successfully applied to the active Supabase project (`rgkrfzxipkrwqccfuqfq`):
- **Blocker 1 (Check Constraint)**: Inserting any match fails due to `matches_competition_type_check` check constraint.
- **Blocker 2 (Missing Columns in `predictions`)**: `market_subtype`, `selection`, `model_probability`, `fair_odds`, `entry_odds`, `market_confidence_score`, `predicted_odds`, and `closing_line_value` do not exist.
- **Blocker 3 (Missing Columns in `paper_trades`)**: `user_id`, `market_subtype`, `selection`, `entry_odds`, `opening_odds`, `cohort_tag`, `profit`, `is_win`, `clv`, and `brier_score` do not exist.

#### 👉 Unblocker SQL:
Please copy and execute the following SQL statement block in the **Supabase Dashboard SQL editor**:
```sql
-- Fix check constraint on matches
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_competition_type_check;
ALTER TABLE matches ADD CONSTRAINT matches_competition_type_check CHECK (competition_type IN ('club', 'international'));

-- Add missing columns to predictions
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS market_subtype TEXT;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS selection TEXT;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS model_probability DOUBLE PRECISION;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS fair_odds DOUBLE PRECISION;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS entry_odds DOUBLE PRECISION;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS market_confidence_score INTEGER;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS predicted_odds DOUBLE PRECISION;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS closing_line_value DOUBLE PRECISION;

-- Add missing columns to paper_trades
ALTER TABLE paper_trades ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE paper_trades ADD COLUMN IF NOT EXISTS market_subtype TEXT;
ALTER TABLE paper_trades ADD COLUMN IF NOT EXISTS selection TEXT;
ALTER TABLE paper_trades ADD COLUMN IF NOT EXISTS entry_odds DOUBLE PRECISION;
ALTER TABLE paper_trades ADD COLUMN IF NOT EXISTS opening_odds DOUBLE PRECISION;
ALTER TABLE paper_trades ADD COLUMN IF NOT EXISTS cohort_tag TEXT DEFAULT 'GENERAL';
ALTER TABLE paper_trades ADD COLUMN IF NOT EXISTS profit DOUBLE PRECISION;
ALTER TABLE paper_trades ADD COLUMN IF NOT EXISTS is_win BOOLEAN;
ALTER TABLE paper_trades ADD COLUMN IF NOT EXISTS clv DOUBLE PRECISION;
ALTER TABLE paper_trades ADD COLUMN IF NOT EXISTS brier_score DOUBLE PRECISION;
```

---

### 2. DATA PROVIDER:  PASS
- **Provider**: `api-football`
- **API Response**: Fetched 70 fixtures successfully across all checked competitions.
- **Fixture Count**: 70
- **Sample Fixture**:
  ```json
  {
    "id": "200000",
    "competitionId": "39",
    "competitionName": "Premier League",
    "homeTeam": "Arsenal",
    "awayTeam": "Chelsea",
    "matchDate": "2026-06-14T16:31:23.196Z",
    "status": "finished",
    "season": 2026,
    "homeTeamId": "1",
    "awayTeamId": "2",
    "tournamentStage": "Regular Season - 1"
  }
  ```

---

### 3. INGESTION: ❌ FAIL
- **Status**: Received 70 fixtures, but inserted 0 and failed 70 due to the `matches_competition_type_check` check constraint constraint violation.

---

### 4. PREDICTION: ❌ FAIL
- **Status**: Blocked. Schema cache queries fail with `column predictions.entry_odds does not exist` when saving predictions.

---

### 5. PAPER TRADING: ❌ FAIL
- **Status**: Blocked. Missing column `user_id` and other columns on the `paper_trades` table prevents any trades from being generated.

---

### 6. WORLD CUP: AVAILABLE
- **Status**: The provider successfully returned 10 World Cup fixtures for the 2026 season.
