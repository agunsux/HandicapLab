# HandicapLab E2E Production Readiness Report

## Status Dashboard
- **Infrastructure**: `PASS`
- **Database**: `FAIL`
- **Ingestion**: `FAIL`
- **Prediction**: `FAIL`
- **Paper Trading**: `FAIL`
- **World Cup Tracking**: `FAIL`

---

## 1. Audit Summary

- **Verification Timestamp**: `2026-06-24T22:49:00+07:00`
- **World Cup Fixture Count**: `0`
- **World Cup Prediction Count**: `0`
- **World Cup Paper Trade Count**: `0`

---

## 2. Infrastructure Check (`PASS`)

- **Vercel Deployment**: Successful (`handicap-lab.vercel.app` is active and updated).
- **Vercel Crons**: Configured and deployed successfully in `vercel.json` optimized for Hobby plan limits:
  - `/api/cron/ingest`: `"0 23 * * *"` (Daily at 11:00 PM UTC)
  - `/api/cron/predict`: `"30 23 * * *"` (Daily at 11:30 PM UTC)
  - `/api/cron/snapshot`: `"0 0 * * *"` (Daily at 12:00 AM UTC)
  - `/api/cron/settle`: `"0 1 * * *"` (Daily at 1:00 AM UTC)
- **Active Routes**: Routes are active serverless functions compiled by Next.js/Turbopack.

---

## 3. Database Check (`FAIL`)

- **Matches Table**: Missing Sprint 6 columns (`competition_type`, `tournament_stage`, `fifa_ranking_home`, `squad_strength_home`, etc.).
- **Predictions Table**: Missing Sprint 6 columns (`market_confidence_score`, `predicted_odds`, etc.).
- **Paper Trades Table**: Missing completely.
- **Model Weight History Table**: Missing completely.

---

## 4. Ingestion Check (`FAIL`)

- **World Cup Ingestion**: Triggering ingestion on the real database fails with error `PGRST204` because `competition_type` column is missing from the matches table in production.

---

## 5. Prediction Check (`FAIL`)

- **Prediction Pipeline**: Fails to run for World Cup matches because matches cannot be saved during ingestion. Fails on older EPL matches with `LeakageError` due to `FEATURE_GENERATION_LEAK` (guard correctly catching pre-kickoff predictions compared to historic 2024 kickoff dates).

---

## 6. Paper Trading Check (`FAIL`)

- **Paper Trades**: Unable to insert paper trades because `paper_trades` table is missing in the production database (throws `PGRST205` / table does not exist).

---

## Root Causes of Failures

> [!IMPORTANT]
> The database schema is stale and must be manually updated to resolve the failures.

1. **Database Schema is Stale / Out of Sync**:
   - The production Supabase database does not have the Sprint 6 tables and columns.
   - **Why migration script failed**:
     - The production Supabase instance (`https://rgkrfzxipkrwqccfuqfq.supabase.co`) does not expose a custom SQL execution RPC (`exec_sql` or `execute_sql`).
     - No direct Postgres connection credentials (`DATABASE_URL` / `POSTGRES_URL` or database password) are defined in the environment files.
     - Direct TCP access to postgres port `5432` is blocked/refused without password credentials.

### Required Resolution Steps:
To move the pipeline to `PASS` and proceed with Phase 6B, the user must run the migrations directly inside the **Supabase Dashboard SQL Editor**:
1. Copy and execute the contents of [migrate-paper-trading.ts](file:///c:/Users/RYZEN/.antigravity-ide/HandicapLab/src/scripts/migrate-paper-trading.ts#L8-L116) to create `paper_trades`, `odds_history` and enable RLS policies.
2. Copy and execute the contents of [migrate-sprint6.ts](file:///c:/Users/RYZEN/.antigravity-ide/HandicapLab/src/scripts/migrate-sprint6.ts#L8-L43) to add the new `competition_type`, `squad_strength` columns and create `model_weight_history`.
