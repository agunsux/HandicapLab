# Shadow Pipeline Operations Guide

## Overview

The Shadow Pipeline transforms HandicapLab from a historical research framework into a **live evidence collection system**. It collects market data, generates predictions using the frozen probability model, and evaluates whether the model contains independent information versus Pinnacle closing odds.

## How to Start the Shadow Pipeline

```bash
# Development demo (processes 1 simulated fixture)
npm run shadow:predict

# Output goes to: shadow_runs/<timestamp>/
#   metadata.json       — Run configuration and summary
#   shadow_evaluation.json — Windowed evaluation results
#   shadow_report.md    — Human-readable report

# For continuous operation:
npx tsx src/scripts/start-shadow-pipeline.ts
```

## How Evidence is Collected

Every fixture goes through this evidence pipeline:

```
1. ODDS_CAPTURED       → odds snapshot stored
2. PREDICTION_CREATED  → model generates prediction
3. MATCH_STARTED       → match begins (future)
4. MATCH_SETTLED       → result recorded
5. EVALUATION_COMPLETED → evaluation run
```

Each evidence entry is chain-linked via SHA-256. Tampering is detected by `verifyEvidenceChain()`. No entries can be deleted or modified.


## How Evaluation Works

Reuses existing research metrics from `src/lib/research/pipeline.ts`:
- **Brier Score**: Mean squared error of probability predictions
- **Log Loss**: Cross-entropy loss
- **ECE**: Expected Calibration Error (10-bin)
- **ROI**: Return on investment (per-unit)
- **CLV**: Closing Line Value (positive = beat market)
- **Sharpe/Sortino/MaxDD**: Risk metrics from `analytics.ts`
- **Bootstrap CI**: 95% confidence interval

### Windows
| Window | Min Predictions | Purpose |
|--------|----------------|---------|
| 30d | 50 | Short-term |
| 90d | 200 | Medium-term |
| 180d | 500 | Long-term evidence |

### Market Breakdown
Per-market metrics: `moneyline`, `asian_handicap`, `over_under`

## How to Reproduce Predictions

Every prediction stores:
1. **modelHash**: SHA-256(model_version + config) — deterministic
2. **inputDataHash**: SHA-256(all feature inputs) — deterministic
3. **oddsSnapshotId**: Exact odds used
4. **featureVersion + datasetVersion**: Pipeline version tracking

Same inputs always produce the same outputs (verified).

## API Endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| POST | /api/shadow/predict | Generate prediction |
| GET | /api/shadow/predict | Ledger status |
| POST | /api/shadow/settle | Record result |
| GET | /api/shadow/evidence | Query ledger (?window=90d, ?fixtureId=x) |
| GET | /api/shadow/evaluate | Full evaluation |

## Dashboard

`/dashboard/shadow` — Auto-refreshes every 30s

Sections: Data Collection, Model Performance, Calibration, Market Intelligence, Market Breakdown

## Chain Integrity

```bash
npx tsx -e "
const{MELedgerStore}=require('./src/lib/data/evidence/ledger');
new MELedgerStore().verifyChainIntegrity().then(r=>console.log('Valid:',r.valid));
"
```

## Shadow Production Gates

| Gate | Requirement |
|------|-------------|
| Settled Predictions | ≥ 500 |
| CLV | > 0 |
| Bootstrap CI Lower | > 0 |
| ECE | < 5% |
| Multiple Leagues | ≥ 2 |
| Multiple Market Types | ≥ 2 |

## Safe Execution

- **Retry**: Exponential backoff (1s, 2s, 4s), 3 attempts
- **Graceful shutdown**: SIGINT/SIGTERM handler, logs summary
- **Structured logging**: JSON-formatted log entries

## How Settlement Works

### Moneyline (ML)
- Selected team wins → 1 (win, +1 unit)
- Draw → 0.5 (push, 0 units)
- Selected loses → 0 (loss, -1 unit)

### Asian Handicap (AH)
`adjusted_diff = goal_diff ± line`
- adjusted_diff > 0 → win
- adjusted_diff = 0 → push
- adjusted_diff < 0 → loss

### Over/Under (OU)
- Total goals > line → Over wins
- Total goals < line → Under wins
- Total goals = line → Push
