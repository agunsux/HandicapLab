# Production Pipeline Status Report

## Summary
- **Overall Status**: 🛑 **FAILED (Blocked by Database Schema)**
- **Database**: ❌ **FAIL**
- **Provider**:  **PASS**
- **Fixture Ingestion**: ❌ **FAIL**
- **Prediction**: ❌ **FAIL**
- **Paper Trading**: ❌ **FAIL**

---

## 1. Database Check
- **Status**: ❌ **FAIL**
- **Blockers**:
  1. **Check Constraint Violation**: The constraint `matches_competition_type_check` on the `matches` table rejects inserts for both `club` and `international` matches.
  2. **Missing Columns in `predictions` table**: 8 columns are missing: `market_subtype`, `selection`, `model_probability`, `fair_odds`, `entry_odds`, `market_confidence_score`, `predicted_odds`, `closing_line_value`.
  3. **Missing Columns in `paper_trades` table**: 10 columns are missing, including `user_id`, `selection`, `entry_odds`, `opening_odds`, `cohort_tag`.
- **Solution**: The user must run the SQL statements in [migration_fix.sql](file:///c:/Users/RYZEN/.antigravity-ide/HandicapLab/supabase/migration_fix.sql) in their Supabase Dashboard SQL Editor.

---

## 2. Data Provider Check
- **Status**:  **PASS**
- **Active Provider**: `api-football` (with `football-data` available via `DATA_PROVIDER=football-data`).
- **Details**: Direct provider queries fetch fixtures successfully for all registered competitions (EPL, UCL, La Liga, Serie A, Bundesliga, Ligue 1, and World Cup).

---

## 3. Ingestion Pipeline
- **Status**: ❌ **FAIL** (Blocked by `matches_competition_type_check` constraint).
- **Logs Output**: 
  - `[INGEST START]` log headers correctly instrumented.
  - Returns detailed error payload with status code, endpoint, provider, and error message instead of silently failing.

---

## 4. Prediction Pipeline
- **Status**: ❌ **FAIL** (Blocked by missing `entry_odds` column in the `predictions` table, causing `PGRST204` schema cache errors).

---

## 5. Paper Trading Pipeline
- **Status**: ❌ **FAIL** (Blocked by missing columns in the `paper_trades` table).

---

### 🛠️ Required Action to Unblock
Execute the following SQL block in the **Supabase Dashboard SQL editor**:
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
