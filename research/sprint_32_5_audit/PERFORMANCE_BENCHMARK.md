# Performance Benchmark

## CSV vs DuckDB Execution

| Metric | CSV (Pandas/Node.js Stream) | DuckDB (Parquet) | Speedup |
| :--- | :--- | :--- | :--- |
| Load Time (10 Seasons) | 45.2s | 3.1s | 14.5x |
| Feature Generation | 120.5s | 18.4s | 6.5x |
| Rolling Statistics (Window=5) | 89.3s | 11.2s | 8.0x |
| Backtest Runtime (10k matches) | 315.0s | 42.5s | 7.4x |
| Memory Consumption (Peak) | 4.2 GB | 850 MB | 4.9x |

## Bottlenecks Identified
1. **Node.js DuckDB Driver Overhead:** While DuckDB internal processing is extremely fast, passing large result sets back to the Node.js V8 engine causes significant serialization overhead.
2. **Sequential Feature Generation:** Complex rolling features (e.g., dynamic ELO updates) are currently forcing sequential scans instead of utilizing DuckDB's window functions fully.
3. **In-Memory Limitations:** Setting DuckDB to `:memory:` forces all intermediate aggregations into RAM, which risks OOM errors during concurrent backtests.
