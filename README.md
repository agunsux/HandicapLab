# HandicapLab

**Football Market Intelligence Platform** — Quantitative modeling for identifying statistical inefficiencies and betting market edges.

> Positioned like a Bloomberg Terminal for football markets, not a tipster. Every prediction carries a statistical breakdown: xG indicators, ELO shifts, home advantage values, CLV, Brier scores, and calibration curves.

---

## Architecture Overview

HandicapLab is built on a frozen, research-grade infrastructure comprising:

| Module | Location | Purpose |
|---|---|---|
| Canonical Dataset Platform | `src/lib/data-platform/` | SHA-256-fingerprinted historical dataset builder, gold validator, schema enforcement |
| Replay Engine | `src/lib/replay/` | Mass replay with checkpoint/resume, time-travel point-in-time isolation |
| Production Predictor Adapter | `src/lib/replay/ProductionPredictorAdapter.ts` | Bridges replay with live prediction pipeline |
| Experiment Registry | `src/lib/registry/experimentRegistry.ts` | Immutable experiment tracking with lifecycle events |
| Model Registry | `src/lib/registry/modelRegistry.ts` | Champion/challenger lifecycle, version-controlled model metadata |
| Feature Store | `src/lib/registry/featureStore.ts` | Versioned feature snapshots with dependency resolution |
| Feature Dependency Graph | `src/lib/registry/featureDependencyGraph.ts` | DAG via Kahn's algorithm, cycle detection |
| Decision Engine | `src/lib/decision/` | Evidence-based recommendation engine (TrustCard, EvidenceCard, Story) |
| Explainability / Evidence Engine | `src/lib/explainability/` | StructuredEvidenceBuilder, FeatureContributionEngine, Calibration narratives |
| Trust Card | `src/lib/decision/types.ts` | TrustCard interface — calibration, CLV, historical accuracy, data quality |
| Serializer | `src/lib/decision/serializer.ts` | DecisionSerializer for deterministic JSON output |
| Benchmark Engine | `src/lib/benchmark/` | Model comparison, backtest runner, statistical significance |
| Calibration Utilities | `src/lib/calibration/` | Platt scaling, temperature scaling, market calibrator, AcceptanceGate |
| ADR Documents | `ADR_INDEX.md`, `docs/adr/` | 36 architecture decisions tracked |

---

## Current Status — v0.8.0 (Research-Ready)

**Infrastructure Phase: COMPLETE**  
**Next Phase: Quantitative Research (Research Program A)**

- ✅ TypeScript compilation: clean (0 errors)
- ✅ Unit tests: 824 passing across 123 test files
- ✅ Architecture invariants: 16 ratified and enforced
- ✅ Engineering principles: 12 active
- ✅ ADR count: 36 ratified
- ✅ Leakage prevention: enforced at all pipeline boundaries
- ✅ Replay Engine: deterministic, checkpoint/resume capable
- ✅ Scientific Method: 11-stage methodology ratified

---

## Key Metrics (Hero Metrics)

HandicapLab prioritises institutional-grade metrics:

- **CLV (Closing Line Value)** — primary edge signal
- **Brier Score** — probabilistic calibration quality
- **ECE (Expected Calibration Error)** — calibration curve fidelity
- **ROI / EV** — expected value with Kelly stake sizing
- **Bootstrap CI** — statistical confidence intervals
- **Walk-Forward Validation** — temporal integrity

---

## Pricing Tiers

| Plan | Price | Features |
|---|---|---|
| Free | $0 | Dashboard, basic signals |
| Starter | $9/mo | Historical data, basic analytics |
| Pro | $29/mo | CLV tracking, advanced metrics |
| Quant | $99/mo | Full research platform, API access |

---

## 🛡️ Data Integrity & Leakage Prevention

Strict **Edge Leakage Prevention** is enforced at every pipeline boundary:

- **The Hard Gate**: `LeakageGuard.assertNoFutureData(matchId, cutoffDate)` at every feature extractor
- **Frozen Snapshots**: Market opening odds frozen at prediction time, never mutated
- **Outcomes Separation**: Actual outcomes, Brier scores, CLV, and P&L in separate settlement tables
- **Point-in-Time Isolation**: `available_at <= predictionTime` enforced in all queries

See [`docs/LEAKAGE_PREVENTION.md`](file:///c:/Users/RYZEN/.antigravity-ide/HandicapLab/docs/LEAKAGE_PREVENTION.md) for full developer guidelines.

---

## Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# TypeScript check
npx tsc --noEmit

# Run all tests
npm test

# Run specific test file
npx vitest run tests/decision-engine.test.ts

# Run shadow pipeline
npm run test:shadow
```

---

## Architecture Decisions

See [`ADR_INDEX.md`](file:///c:/Users/RYZEN/.antigravity-ide/HandicapLab/ADR_INDEX.md) for the full list of 36 ratified ADRs.

Key invariants and engineering principles:
- [`ARCHITECTURE_INVARIANTS.md`](file:///c:/Users/RYZEN/.antigravity-ide/HandicapLab/ARCHITECTURE_INVARIANTS.md)
- [`ENGINEERING_PRINCIPLES.md`](file:///c:/Users/RYZEN/.antigravity-ide/HandicapLab/ENGINEERING_PRINCIPLES.md)
- [`SCIENTIFIC_METHOD.md`](file:///c:/Users/RYZEN/.antigravity-ide/HandicapLab/SCIENTIFIC_METHOD.md)

---

**Disclaimer**: HandicapLab provides analytics and market intelligence only. No betting automation.
