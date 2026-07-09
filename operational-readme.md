# HandicapLab — Operational README

## What This Is

A market intelligence system that collects live fixture data, generates predictions using an existing probability model, and measures whether the model contains **independent information versus Pinnacle closing odds**.

This is **not** a betting tips website or a gambling recommendation system.
This is a research platform for empirical market intelligence.

## Constraints

- **No model modifications** — The probability model is frozen from Sprint 3.
- **No threshold tuning** — Thresholds are fixed. Only evidence determines outcomes.
- **No historical backfill** — All predictions must be made before the outcome is known.
- **No anonymous predictions** — Every prediction has an audit trail.
- **No silent deletions** — Evidence is immutable.

## Quick Start

```bash
# Install
npm install

# Run demo
npm run shadow:predict

# Start dashboard
npm run dev
# → http://localhost:3000/dashboard/shadow
```

## Architecture

See [docs/architecture.md](docs/architecture.md)

## Operations

See [docs/SHADOW_OPERATIONS.md](docs/SHADOW_OPERATIONS.md)

## Evidence Policy

See [docs/evidence.md](docs/evidence.md)

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/data/providers/types.ts` | Provider interfaces |
| `src/lib/data/snapshots/engine.ts` | Immutable odds storage |
| `src/lib/data/prediction/engine.ts` | Shadow prediction pipeline |
| `src/lib/data/evidence/ledger.ts` | Immutable evidence chain |
| `src/lib/data/evaluation/runner.ts` | Metrics reuse layer |
| `src/lib/db/migrations/` | Database schema |
| `src/app/api/shadow/` | REST API |
| `src/app/dashboard/shadow/` | Monitoring dashboard |
| `src/scripts/start-shadow-pipeline.ts` | CLI worker |

## Scripts

```bash
npm run shadow:predict    # Run shadow pipeline demo
npm run shadow:migrate    # Check migration status
npm run shadow:evaluate   # Fetch evaluation via API
```

## Evaluation Gates

| Gate | Metric | Target |
|------|--------|--------|
| Data Integrity | dataset_hash.json | All files present |
| Prediction Quality | Brier, LogLoss, ECE | ECE < 5% |
| Market Edge | CLV | > 0 (positive) |
| Statistical Confidence | Bootstrap CI | Lower bound > 0 |
| Robustness | Season breakdown | Edge in ≥4 seasons |
| Risk | Sharpe, Sortino, MaxDD | Sharpe > 0.5 |

## Shadow Production Criteria

Before any public recommendation:

- [ ] 500+ settled predictions
- [ ] CLV positive across 30d+ window
- [ ] Bootstrap 95% CI lower bound > 0
- [ ] ECE < 5%
- [ ] Multiple leagues represented
- [ ] Multiple market types (AH, OU, ML)

## Status

The system is in **shadow prediction mode**: collecting evidence without affecting any external system. When the minimum evidence threshold is met, the system can be evaluated for potential operational deployment.
