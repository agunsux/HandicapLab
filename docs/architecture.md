# HandicapLab — Market Intelligence Architecture

## System Overview

HandicapLab transforms from a historical research framework into a live evidence collection system. The architecture follows a layered, provider-independent design where every prediction is immutable and every claim is reproducible.

```
┌──────────────────────────────────────────────────────────┐
│                    DATA PROVIDERS                         │
│  (oddsProvider, fixturesProvider, resultsProvider)         │
│            ↑ Provider-independent interfaces               │
├──────────────────────────────────────────────────────────┤
│                    SNAPSHOT ENGINE                         │
│            Immutable, append-only odds storage             │
│            Chain-hashed audit trail                        │
├──────────────────────────────────────────────────────────┤
│                    SHADOW PREDICTION                       │
│            Connects existing model to live fixtures        │
│            No model logic changes                          │
├──────────────────────────────────────────────────────────┤
│                    EVIDENCE LEDGER                         │
│            Immutable prediction + settlement records       │
│            Full reproducibility                            │

## Layer Descriptions

### 1. Data Providers (`src/lib/data/providers/`)
- Provider-independent interfaces for odds, fixtures, and results
- New providers implement the interface without changing business logic
- Types: `asian_handicap`, `over_under`, `moneyline`

### 2. Snapshot Engine (`src/lib/data/snapshots/`)
- Append-only odds movement storage
- Every change timestamped with chain hash for audit
- Opening/Closing odds extraction for CLV computation

### 3. Shadow Prediction (`src/lib/data/prediction/`)
- Connects `generatePrediction()` from existing probability engine
- No model logic modifications
- Input data hashed for reproducibility
- Edge = model probability - market implied probability (vig-removed)

### 4. Evidence Ledger (`src/lib/data/evidence/`)
- Every prediction creates an immutable evidence entry
- Chain-linked hashes prevent tampering
- Full audit trail: input data hash → model → prediction → settlement


## Key Design Decisions

### Immutability
- Odds snapshots are append-only. No updates, no deletes.
- Evidence ledger is chain-linked. Tampering breaks the hash chain.
- Predictions are stored before outcome is known.

### Provider Independence
- Interfaces defined in `src/lib/data/providers/types.ts`
- Any provider (Pinnacle API, manual import, web scrape) can be implemented behind the interface.
- Business logic never references specific providers.

### Reuse, Not Rewrite
- Research metrics in `src/lib/math/metrics.ts` are used directly.
- Pipeline functions in `src/lib/research/pipeline.ts` are connected, not duplicated.
- Analytics in `src/lib/research/analytics.ts` provide risk metrics and regime analysis.

### Reproducibility
- Every prediction stores SHA-256 of input data.
- Model version is recorded per prediction.
- Odds snapshot reference anchors market conditions at prediction time.
- Git commit hash is recorded in every evaluation run.

## File Map

```
src/lib/data/
  providers/            ← Provider types + interfaces
  snapshots/            ← Immutable odds storage
  prediction/           ← Shadow prediction pipeline
  evidence/             ← Immutable evidence ledger
  evaluation/           ← Metrics reuse layer
src/lib/db/
  migrations/           ← 6 migration files
  connection.ts         ← PostgreSQL connection
  migrate.ts            ← Migration runner
src/app/api/shadow/     ← Predict, settle, evidence, evaluate APIs
src/app/dashboard/shadow/ ← Monitoring dashboard
src/scripts/            ← CLI worker
```

## Data Flow

```
Fixture arrives → Feature loader → generatePrediction() (existing model)
  → Prediction snapshot (with input hash, odds reference)
  → Evidence ledger entry created
  → Wait for match result
  → Settlement with CLV computed
  → Evidence ledger updated
  → Evaluation engine aggregates across windows
  → Dashboard updates metrics
```

## Thresholds

| Gate | Requirement | Source |
|------|-------------|--------|
| Min settled | 500 predictions | Operational |
| Preferred | 1000+ across leagues/markets | Operational |
| CLV | > 0 (positive) | Market edge |
| Bootstrap CI | Lower bound > 0 | Statistical confidence |
| Calibration | ECE < 5% | Prediction quality |
| Risk | Sharpe > 0.5, MaxDD < 30% | Risk-adjusted return |
| Robustness | Edge in ≥4 of 5 seasons | Cross-validation |

### 5. Evaluation Engine (`src/lib/data/evaluation/`)
- Reuses `computeMetrics`, `bootstrapMetrics`, `computeRiskMetrics`, `regimeAnalysis`
- Evaluation windows: 30d, 90d, 180d
- Minimum prediction thresholds per window

### 6. Database (`src/lib/db/`)
- Migration-first (6 migrations)
- All tables include `created_at`, `updated_at`, version/reference fields
- No direct schema mutation

├──────────────────────────────────────────────────────────┤
│                    EVALUATION ENGINE                       │
│            Reuses existing research metrics               │
│            Brier, LogLoss, ECE, CLV, Sharpe, Sortino       │
├──────────────────────────────────────────────────────────┤
│                    MONITORING DASHBOARD                    │
│            Real-time performance tracking                  │
└──────────────────────────────────────────────────────────┘
```
