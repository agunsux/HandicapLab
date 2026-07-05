# HandicapLab Database Optimization Report

This report outlines the optimizations applied to improve query response times and transaction efficiency.

---

## 1. Missing Indexes Analysis & Logical Explain

### Missing Index: `idx_predictions_timestamp`
* **Target Column:** `predictions (prediction_timestamp DESC)`
* **Query Patterns Optimized:**
  - GET `/api/predictions` (chronological feed sorting)
  - GET `/api/cron/predict`
* **Logical Explain:**
  - **Before Index:** The database performs a sequential scan (Seq Scan) across all rows in the `predictions` table, loading the dataset into memory or swapping to disk to perform a sorting operation ($O(N \log N)$ cost) to satisfy the `ORDER BY prediction_timestamp DESC` clause.
  - **After Index:** Creating a B-Tree index on `prediction_timestamp DESC` enables an index scan. The query planner can retrieve pre-sorted record references in $O(\log N)$ time, avoiding memory sorting operations altogether.

```sql
-- Migration implemented in 00000000000007_idx_predictions_timestamp.sql
CREATE INDEX IF NOT EXISTS idx_predictions_timestamp ON public.predictions (prediction_timestamp DESC);
```

---

## 2. DB Client Connection Pooling Analysis

### Port Alignment: 6543 vs 5432
* **Supabase Client JS (Vercel Runtime):** Automatically targets the HTTP/PostgREST API, benefiting from server-side pool reuse and HTTP/2 multiplexing.
* **Migration & Utility Scripts:** Raw direct database client setups (e.g. `pg` or shell processes) have been aligned to connect via **Port 6543** (Transaction Pooler) in the staging and production environments to prevent client connection exhaustion during concurrent execution runs.
