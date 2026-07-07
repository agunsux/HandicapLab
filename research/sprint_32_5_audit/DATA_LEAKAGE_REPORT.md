# Data Leakage Audit

## Audit Findings

**Target Leakage Risk:** HIGH
**Point-in-Time Correctness:** FAILED

### Future Leakage
The current feature generation pipeline calculates rolling statistics using a `BETWEEN row - 5 AND row` window over match dates. If a match on the same date kicks off later in the day, its result could theoretically leak into the early match if ordered improperly.

**Exact Code Location:**
Any raw SQL relying on `ORDER BY date` rather than `ORDER BY date, kickoff_time_unix` is vulnerable.

### Odds Leakage
Closing Line Value (CLV) calculations currently ingest `closing_odds` without strict timestamp separation. If a prediction is made 1 hour before kickoff, but the model accesses the true closing odds (which finalize at kickoff), this is a critical leakage of market movement.

### Recommendations
1. Implement strict "As-Of" joins for all Feature Store queries.
2. Separate odds timeseries from match results. Odds must be queried with `timestamp <= prediction_time`.
3. Introduce a strict chronological backtesting engine that asserts no future data is loaded in the DuckDB context during inference simulation.
