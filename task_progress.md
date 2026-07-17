# EPIC 32 — Research Data Platform Completion (Milestone 3 Critical Path)

## Phase Status

### Foundation — Completed
- [x] Define shared types (`src/pipelines/types.ts`)
- [x] Create utility module (`src/pipelines/utils.ts`)

### PHASE 1 — Silver Merge Engine — Completed
- [x] Read Bronze Understat + Football-Data sources
- [x] Deterministic fixture IDs via SHA-256
- [x] Duplicate detection
- [x] Merge confidence scoring
- [x] Merge audit report
- [x] Checksum validation
- [x] Output: Silver Fixture Store per season

### PHASE 2 — Canonical Team Registry — Not Started
- [ ] Scan all seasons for unique teams
- [ ] Generate team_registry.json
- [ ] Canonical IDs, aliases, historical naming
- [ ] Deterministic mapping

### PHASE 3 — Historical Feature Store — Not Started
- [ ] Rolling windows (5, 10, 20 matches)
- [ ] Generate ~80-150 leakage-safe features
- [ ] Goals, xG, xGA, Shots, PPDA, Cards, etc.
- [ ] Dynamic ELO, Momentum, Market features
- [ ] Output as JSON/Parquet

### PHASE 4 — Temporal Integrity — Not Started
- [ ] Anti-leakage validation
- [ ] Feature timestamp < kickoff timestamp
- [ ] Rolling windows exclude current fixture

### PHASE 5 — Gold Dataset Builder — Not Started
- [ ] Moneyline datasets
- [ ] Asian Handicap datasets
- [ ] Over/Under datasets
- [ ] Features, Targets, Fixture metadata

### PHASE 6 — Data Validation — Not Started
- [ ] Quality Report
- [ ] Coverage Report
- [ ] Validation Report
- [ ] Data Lineage Report

### PHASE 7 — Walk-Forward Dataset Generation — Not Started
- [ ] Expanding Window
- [ ] Rolling Window
- [ ] Season-by-Season

### PHASE 8 — Research Baselines — Not Started
- [ ] Poisson, Dixon-Coles, Logistic Regression
- [ ] Random Forest, Gradient Boosting
- [ ] Calibration (Platt, Isotonic, Beta)
- [ ] Brier Score, Log Loss, ECE, ROI, CLV

### PHASE 9 — Performance Engineering — Not Started
- [ ] Incremental rebuild
- [ ] Caching
- [ ] Parallel processing
- [ ] Deterministic outputs

### PHASE 10 — Research Readiness — Not Started
- [ ] Verify compatibility with probability/decision/calibration engines
- [ ] Backtesting compatibility
- [ ] Shadow mode readiness