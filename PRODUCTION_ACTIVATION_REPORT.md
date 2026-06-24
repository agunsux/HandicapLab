# PRODUCTION ACTIVATION REPORT

DATABASE: FAIL
PROVIDER: PASS
INGESTION: FAIL
PREDICTION: FAIL
PAPER TRADING: FAIL
WORLD CUP: AVAILABLE

---

## Detailed Audit Results

### 1. DATABASE SCHEMA: ❌ FAIL
The manual SQL migration has **NOT** been fully or correctly applied in production:
- **Blocker 1 (Check Constraint)**: Inserting any club or international match still fails due to the `matches_competition_type_check` constraint.
- **Blocker 2 (Missing Columns)**: The `predictions` table is missing `market_subtype`, `selection`, `model_probability`, `fair_odds`, `entry_odds`, `market_confidence_score`, `predicted_odds`, and `closing_line_value`.
- **Blocker 3 (Missing Columns)**: The `paper_trades` table is missing 10 columns, including `user_id`, `selection`, `entry_odds`, `opening_odds`, `cohort_tag`.

#### 👉 Solution to Unblock:
Please execute the SQL inside [migration_fix_final.sql](file:///c:/Users/RYZEN/.antigravity-ide/HandicapLab/supabase/migration_fix_final.sql) in your **Supabase Dashboard SQL editor**:
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

### 2. PROVIDER:  PASS
- **Active Provider**: `api-football` (Credentials verified: `true`)
- **Direct Test Output**:
  - `provider`: `api-football`
  - `competitions checked`: Premier League, UEFA Champions League, La Liga, Serie A, Bundesliga, Ligue 1, FIFA World Cup
  - `fixtures received`: 70 matches
  - `sample fixture`:
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
- **Blocker**: DB insertion fails due to check constraint error: `new row for relation "matches" violates check constraint "matches_competition_type_check"`.

---

### 4. PREDICTION: ❌ FAIL
- **Blocker**: Saving predictions is blocked because the `entry_odds` column does not exist on the `predictions` table, resulting in `PGRST204` schema cache errors.

---

### 5. PAPER TRADING: ❌ FAIL
- **Blocker**: Missing required columns like `user_id` and `selection` on the `paper_trades` table prevents inserts.

---

### 6. WORLD CUP: AVAILABLE
- **Status**: The provider successfully returned 10 World Cup fixtures for the 2026 season:
  - `Competition`: FIFA World Cup (Season: 2026)
  - `Sample fixture`: Argentina vs France, Kickoff: `2026-06-25T15:32:00.904Z`, Status: `upcoming`, Stage: `Group Stage`.
