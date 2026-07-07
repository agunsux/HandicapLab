# Part 10: Technical Debt
- **Architecture Debt**: Low. The pipeline is highly modular.
- **Research Debt**: Med. We rely entirely on EPL. Generalization to La Liga/Serie A is untested.
- **Code Debt**: Low. TypeScript adoption is strong.
- **Data Debt**: High. CSV adapters are a bottleneck; need full Parquet/DuckDB pipeline.
