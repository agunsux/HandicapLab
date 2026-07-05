# HandicapLab Cron Query Audit

This audit documents database query behavior, N+1 patterns, and overhead in the background cron jobs prior to our optimization sprint.

| Cron Job / Endpoint | Database Queries (Estimate) | Sequential Awaits | Repeated Queries / Duplicated Fetches | N+1 Patterns | Unnecessary Updates | Performance Impact / Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **GET `/api/cron/evaluate`** | $2 + 2N$ queries (new schema)<br>$1 + 3N$ queries (legacy schema) | **Yes** (updates & inserts executed sequentially in loop) | Yes (repeated fetches for match records) | **Severe** ($O(N)$ updates/inserts) | Yes (updating individual records sequentially) | **High Bottleneck** (Timeout risk on large pending sets. Refactored to bulk writes). |
| **GET `/api/cron/predict`** | $2 + 21M$ queries for $M$ matches | **Yes** (sequential loops per match and market type) | Yes (repeated checks for prediction, decision, trade existence) | **Severe** ($O(N)$ duplicate existence selects) | Yes (individual inserts for snapshot children) | **Critical Blocker** (Sequential waits caused serverless timeouts. Parallelized with chunked concurrency). |
| **GET `/api/cron/ingest`** | $1 + 2M$ queries for $M$ ingested matches | **Yes** (sequential selects and inserts inside loop) | Yes (selecting same match ID to check existence) | **Moderate** (O(M) single selects) | Yes (single updates instead of upsert) | Moderate (Optimized by local map-based lookups). |
| **GET `/api/cron/update-ratings`**| $2$ queries | No | No | No | No | Optimized. Flat query pattern. |
| **GET `/api/cron/daily-summary`** | $6$ queries | No | No | No | No | Optimized. Flat metadata aggregations. |
| **GET `/api/cron/settle`** | $6 + 4S$ queries for $S$ signals | Yes | Yes | Moderate | No | Settle signals processing. |
