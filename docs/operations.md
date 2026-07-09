# HandicapLab — Operations Guide

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 15+ (for production)
- Existing research modules (Sprint 3)

### Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Run the shadow pipeline demo
npm run shadow:predict

# 3. View the report
cat shadow_runs/<timestamp>/shadow_report.md

# 4. Start the development server for the dashboard
npm run dev
# Navigate to http://localhost:3000/dashboard/shadow
```

### Database Setup (Production)

```bash
# 1. Set DATABASE_URL in .env
echo "DATABASE_URL=postgresql://user:pass@localhost:5432/handicaplab" >> .env

# 2. Run migrations
npx tsx -e "const{runMigrations}=require('./src/lib/db/migrate');runMigrations('up').then(console.log).catch(console.error)"

## API Reference

### `POST /api/shadow/predict`
Generate a shadow prediction for a fixture.

```json
{
  "fixture": {
    "fixtureId": "string",
    "league": "EPL",
    "season": "2024-2025",
    "homeTeam": "Arsenal",
    "awayTeam": "Chelsea",
    "kickoffTime": "2025-01-15T20:00:00Z"
  },
  "oddsSnapshot": {
    "fixtureId": "string",
    "bookmaker": "pinnacle",
    "marketType": "moneyline",
    "line": 0,
    "priceHome": 2.10,
    "priceAway": 3.80,
    "priceDraw": 3.40
  },
  "marketType": "moneyline",
  "line": 0
}
```

### `POST /api/shadow/settle`
Record outcome and settle a prediction.

```json
{
  "predictionId": "string",
  "prediction": { ... prediction object ... },
  "actualOutcome": 1,
  "closingOddsProb": 0.48,
  "odds": 2.10
}
```

### `GET /api/shadow/evidence`
Query evidence ledger.
- `?window=30d` — Evaluation for 30-day window
- `?window=90d` — Evaluation for 90-day window
- `?window=180d` — Evaluation for 180-day window
- `?window=all` — All evaluation windows
- `?fixtureId=xxx` — Filter by fixture

### `GET /api/shadow/evaluate`
Full evaluation across all windows.
Returns windowed metrics + all-time aggregate.

## Monitoring

### Dashboard
`http://localhost:3000/dashboard/shadow`

Displays:
- **Data Collection**: total predictions, settled, unsettled, chain validity
- **Model Performance**: per-window ROI, CLV, ECE, Sharpe, Sortino, MaxDD, Bootstrap CI
- **Market Intelligence**: average CLV, beat rate, edge stability

### Report Files
`shadow_runs/<timestamp>/`
- `metadata.json` — Run configuration
- `shadow_evaluation.json` — Evaluation results
- `shadow_report.md` — Human-readable report

## Evidence Chain Verification

Every evidence entry is hash-linked to the previous entry.
To verify chain integrity:

```bash
npx tsx -e "
const{MemoryEvidenceLedgerStore}=require('./src/lib/data/evidence/ledger');
const store=new MemoryEvidenceLedgerStore();
store.verifyChainIntegrity().then(r=>console.log('Chain valid:', r.valid, r.brokenAt?'Broken at: '+r.brokenAt:''));
"
```

If the chain is broken, data has been tampered with.

## Shadow Production Criteria

Before any public recommendation, ALL criteria must be met:

| Criteria | Threshold | Verified |
|----------|-----------|----------|
| Total settled predictions | ≥ 500 | `GET /api/shadow/evidence` |
| CLV positive | > 0 | `GET /api/shadow/evaluate` |
| Bootstrap CI lower bound | > 0 | `GET /api/shadow/evaluate` |
| ECE | < 5% | `GET /api/shadow/evaluate` |
| Across multiple leagues | ≥ 2 | Data provider config |
| Multiple market types | ≥ 2 | Data provider config |

## Troubleshooting

### Chain integrity failure
- Check for manual database edits.
- If using in-memory store, data is ephemeral.

### Missing closing odds
- Ensure odds snapshots are collected until kickoff.
- The last snapshot before kickoff is used as closing.

### Prediction confidence is low
- Verify feature inputs (xg_home, xg_away, form data).
- Check OOD scores for out-of-distribution fixtures.

### Dashboard shows no data
- Ensure predictions have been generated.
- Check API endpoints directly: `curl http://localhost:3000/api/shadow/evidence`


# 3. Verify
npx tsx src/scripts/start-shadow-pipeline.ts
```

## Pipeline Lifecycle

### 1. Fixture Acquisition
Fixtures arrive from a provider (Pinnacle API, manual import, etc.).
The `IFixturesProvider` interface abstracts the source.

### 2. Odds Collection
For each fixture, odds snapshots are collected periodically.
Every odds change is stored as an immutable, append-only record.

### 3. Prediction Generation
For each fixture+market combination:
- Build model input from fixture + odds data
- Call existing `generatePrediction()` (unchanged)
- Store prediction snapshot with input data hash
- Create evidence ledger entry

### 4. Settlement
After fixture result is known:
- Compute actual outcome
- Fetch closing odds from snapshot store
- Compute CLV = closingOddsProb - marketProb
- Store settlement record
- Update evidence ledger

### 5. Evaluation
Periodically:
- Aggregate settled predictions
- Compute metrics (Brier, LogLoss, ECE, ROI, CLV, Sharpe, Sortino, MaxDD)
- Bootstrap confidence intervals
- Store evaluation run
