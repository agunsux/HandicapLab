# HandicapLab Production Readiness Status Report

## Summary

- **Production**: `FAIL`
- **Ingestion**: `FAIL`
- **Prediction**: `FAIL`
- **Paper Trading**: `FAIL`

---

## 1. Vercel s Check

### Scheduled Crons (in `vercel.json`)

- `/api/cron/predict`: Scheduled (`0 1 * * *` - Daily at 1:00 AM UTC)
- `/api/cron/snapshot`: Scheduled (`0 2 * * *` - Daily at 2:00 AM UTC)
- `/api/cron/settle`: Scheduled (`0 3 * * *` - Daily at 3:00 AM UTC)

### Missing Crons

- `/api/cron/ingest`: **MISSING** from `vercel.json`.

### Recommendation

Add the ingest cron path to `vercel.json` to enable automatic database updates for whitelisted leagues:

```json
{
  "path": "/api/cron/ingest",
  "schedule": "0 0 * * *"
}
```

---

## 2. Production Database Check

- **Target Table**: `matches`
- **World Cup 2026 matches**: `0` found.
- **Total matches**: `10` found (all are Premier League matches from August 2024).

### Sample Match Records

1. `87f3a3b9-e683-46d9-b020-f4cc7425a870` | Manchester United vs Fulham | Kickoff: `2024-08-16T19:00:00` | Status: `upcoming` | competition_id: `undefined`
2. `57cb7be4-5202-4e3d-92af-cf9d338cba2e` | Ipswich vs Liverpool | Kickoff: `2024-08-17T11:30:00` | Status: `upcoming` | competition_id: `undefined`

---

## 3. Ingestion Check

- **Ingestion Path**: API-Football -> dataTransformer -> matches table
- **Latest Ingestion Timestamp (`created_at`)**: `2026-06-23T13:54:19.175Z`
- **Latest Fixture Timestamp (`kickoff`)**: `2024-08-19T12:00:00.000Z`

---

## 4. Prediction Pipeline Check

- **Total Predictions Count**: `70`
- **Market Types Breakdown**:
  - `ML`: `30`
  - `AH`: `20`
  - `OU`: `20`
- **Confidence Distribution**: All `0` (missing/null values in database).

---

## 5. Edge Scanner Check

- **Total Predictions Evaluated**: `70`
- **Passed EV Filter**: `0`
- **Rejected by EV**: `70`
- **Rejected by Confidence**: `0` (null values)
- **Rejected by Market Suitability**: `0`

---

## 6. Paper Trading Check

- **Table `paper_trades`**: **MISSING** from the database schema cache.
- **Pending Trades Count**: `0` (Error: `PGRST205` - Could not find table in schema cache).

---

## Root Causes of Failures

> [!WARNING]
> The production pipeline check has failed due to database schema misalignment and environment configuration gaps.

1. **Stale / Non-Migrated Schema on Production Supabase**:
   - The `paper_trades` table and `model_weight_history` table do not exist.
   - The `matches` table is missing critical Sprint 6 columns: `competition_type`, `tournament_stage`, `fifa_ranking_home`, `squad_strength_home`, etc.
   - The `predictions` table is missing Sprint 6 columns: `market_confidence_score`, `predicted_odds`, `selection`, `edge_pct`, etc.
   - **Reason**:
     - The production Supabase instance `rgkrfzxipkrwqccfuqfq` has no custom RPC execution function (`exec_sql` or `execute_sql`).
     - No direct Postgres connection string (`DATABASE_URL` / `POSTGRES_URL`) or password credentials exist in the local `.env` files.
     - Direct TCP access to postgres port `5432` is blocked/refused without credentials.
2. **Missing Ingest Cron**:
   - `/api/cron/ingest` is not scheduled inside `vercel.json`.
3. **No World Cup Matches Ingested**:
   - Because the ingest cron has not run with the newly enabled World Cup config on production.
