# Technical Debt

## Critical
- **Impact:** System-wide failure on concurrent backtests.
- **Risk:** High (OOM crashes).
- **Complexity:** Medium
- **Recommendation:** Replace `:memory:` DuckDB instance with a persistent `.duckdb` file and implement connection pooling/concurrency limits.

## High
- **Impact:** Feature leakage leading to inflated backtest ROI.
- **Risk:** High
- **Complexity:** High
- **Recommendation:** Implement strict Point-in-Time (As-Of) joins in the Feature Store and decouple odds timestamps from match dates.

## Medium
- **Impact:** Brittle data pipelines that break on upstream API changes.
- **Risk:** Medium
- **Complexity:** Medium
- **Recommendation:** Implement a strict Canonical Schema using Zod or Protobuf before saving to Parquet to reject corrupted rows immediately.

## Low
- **Impact:** Slow local development loop.
- **Risk:** Low
- **Complexity:** Low
- **Recommendation:** Optimize Node.js-to-DuckDB IPC serialization.
