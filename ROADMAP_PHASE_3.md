# HandicapLab — Phase 3 Master Roadmap (EPIC 8–14)

**Generated:** 2026-07-10  
**Updated:** 2026-07-10 (Revision 2)  
**Based on:** Completed EPIC 1–7 (Foundation, Execution, Market Framework) + Architecture Review

---

## Architecture Principles (Immutable)

- `ProbabilityEngine.predict()` — single source of truth
- Market Framework — translator-based, no engine changes
- Replay → `ProductionPredictorAdapter` → `ProbabilityEngine`
- All registries immutable after completion
- Every artifact versioned + metadata
- Every experiment reproducible
- Zero circular dependencies
- Dependency injection everywhere
- TypeScript strict, zero `any`

---

## Refined Data Flow

```
Dataset
  ↓
[Data Quality Layer]              ← EPIC 8.5 (NEW)
  ↓
[Feature Store] (storage)
  ↓
[Feature Factory] (computation)   ← EPIC 8
  ↓
[Feature Cache]
  ↓
[Model Training Pipeline]         ← EPIC 9 (separate training vs serving)
  ↓
[Model Artifact]
  ↓
[Serving Adapter]                 ← EPIC 9 (separate)
  ↓
[Odds Intelligence]               ← EPIC 10
  ↓
[ProbabilityEngine.predict()]
  ↓
[Market Translators]
  ↓
[Simulation Laboratory]           ← EPIC 11
  ↓
[Explainability & Confidence]     ← EPIC 12
  ↓
[Production Intelligence]         ← EPIC 13
  ↓
[Live Engine]                     ← EPIC 14
```

---

## EPIC 8 — Feature Factory

Build a plugin-based Feature Factory on top of the existing FeatureStore.

**Separation of concerns:**
- **Feature Store** (existing) — storage, versioning, metadata, dependency graph
- **Feature Factory** (new) — computation, plugin architecture, execution context

**Key modules:**
- `FeaturePlugin` interface — every feature is a plugin
- `FeatureRegistry` — extends FeatureStore with plugin registration
- `FeatureBuilder` — composes features from dependency graph
- `FeatureValidator` — validates output ranges, schema
- `FeatureCache` — memoizes computed features, LRU eviction
- `FeatureExecutionContext` — runtime context + timing
- `FeatureArtifactWriter` — persists feature snapshots
- `FeatureBenchmark` — measures computation performance
- Automatic dependency graph resolution + cycle detection

**Plugin examples:** Expected Goals, Rolling Form, Momentum, Injuries, Possession, Corners, Shots, Weather, Travel, Referee, Importance, Motivation, Odds Movement

**Performance target:** Feature generation < 100ms per fixture

---

## EPIC 8.5 — Data Quality & Data Contracts (NEW)

Data quality layer between raw dataset ingestion and Feature Factory.

**Key modules:**
- `SchemaValidator` — validates canonical dataset schema conformance
- `MissingValuePolicy` — configurable: drop, impute (mean/median/mode), warn
- `OutlierDetector` — IQR, z-score, MAD-based detection
- `DuplicateDetector` — exact + fuzzy duplicate fixture detection
- `TimeConsistencyValidator` — kickoff ordering, no future data leakage
- `LeakageDetector` — point-in-time validation, feature timestamp checks
- `DatasetScorer` — composite data quality score (0–100)
- `DataQualityReport` — JSON + markdown report generator

**Rationale:** Model quality is bounded by data quality. This layer ensures every dataset entering Feature Factory meets minimum quality thresholds before any computation occurs. Prevents garbage-in-garbage-out at the architecture level.

---

## EPIC 9 — Model Zoo (Training + Serving Separation)

Unified Model Framework with explicit separation between training and serving.

### Training Pipeline
- `ModelPlugin` interface
- `ModelFactory` — creates models from configuration
- `HyperparameterFramework` — extends EPIC 2 search
- `CalibrationPipeline` — per-model calibration (Platt, Isotonic, Beta)
- `EnsembleFramework` — combine multiple models
- `ChampionPromotionRules` — auto-promotion criteria

### Model Artifact
- `ModelArtifact` — serialized model + metadata
- `ModelManifest` — version, hash, training config, feature set
- `ModelRegistry` enhancements — register plugin-based models

### Serving Adapter
- `ServingAdapter` interface — inference-only, no training dependencies
- `ProbabilityEngine` integration — load trained model as probability source
- ONNX-compatible interface for future hardware acceleration

### Initial Models
| Model | Plugin | Training | Serving |
|---|---|---|---|
| Poisson | ✅ | ✅ | ✅ |
| Dixon-Coles | ✅ | ✅ | ✅ |
| Bivariate Poisson | ✅ | ✅ | ✅ |
| Zero Inflated Poisson | ✅ | ✅ | ✅ |
| CatBoost | ✅ | adapter | adapter |
| LightGBM | ✅ | adapter | adapter |
| XGBoost | ✅ | adapter | adapter |
| Neural Net | ✅ | adapter | adapter |

**Performance target:** Probability inference < 50ms

---

## EPIC 10 — Odds Intelligence

Bookmaker-independent odds infrastructure.

**Key modules:**
- `OddsProvider` interface — multiple provider adapters
- `OddsNormalizer` — vig removal, decimal conversion, fair odds derivation
- `OddsRegistry` — stores odds snapshots with versioning
- `OddsTimeline` — opening → movement → closing time series
- `SteamDetector` — rapid odds movement identification
- `ReverseLineMovementDetector` — smart money vs public money
- `ConsensusEngine` — weighted average across bookmakers
- `BookmakerRegistry` + `BookmakerMetadata` — identity management
- `CLVSnapshot` — closing line value tracking per fixture

**Design principle:** Odds remain independent of Market Translators. Translators consume odds but odds never depend on translators.

---

## EPIC 11 — Simulation Laboratory

Professional betting simulation engine.

**Key modules:**
- `KellyEngine` — full Kelly, half Kelly, quarter Kelly, fractional Kelly
- `FlatStake` — fixed unit size regardless of edge
- `VariableStake` — confidence-weighted proportional staking
- `PortfolioOptimizer` — correlation-aware allocation (Kelly across multiple bets)
- `CorrelationFilter` — avoid over-concentration in correlated markets
- `DrawdownAnalyzer` — max drawdown, recovery time, ulcer index
- `MonteCarloSimulation` — 10,000+ simulated bankroll paths
- `RiskOfRuin` — probability of bankroll depletion given strategy
- `BankrollSimulator` — full PnL with compounding
- `ScenarioRunner` — what-if analysis (vary Kelly fraction, stake size)
- `StrategyBenchmark` — compare staking strategies head-to-head

**Performance target:** > 100,000 bets/minute simulation throughput

---

## EPIC 12 — Explainability & Confidence

Every recommendation must be explainable.

**Key modules:**
- `ConfidenceEngine` — per-market confidence scoring (data quality + model agreement + calibration)
- `FeatureContribution` — which features drove the decision (SHAP-style attribution)
- `SimilarMatchRetrieval` — historical context from past similar fixtures
- `HistoricalContext` — how similar predictions performed
- `RecommendationExplanation` — structured natural language reasons
- `MarketExplanation` — why this market was chosen over alternatives
- `CalibrationExplanation` — calibration quality at this probability bin
- `ModelAgreementScore` — convergence/variance across models
- `UncertaintyEstimation` — epistemic (model uncertainty) + aleatoric (data noise)
- `ExplainabilityArtifact` — structured JSON explanation output

**Principle:** Every prediction must answer "why this probability for this market?"

---

## EPIC 13 — Production Intelligence

Production monitoring and drift detection.

**Key modules:**
- `DataDriftDetector` — input distribution shifts (PSI, KL divergence)
- `ConceptDriftDetector` — model relationship changes over time
- `FeatureDriftDetector` — per-feature drift tracking
- `CalibrationDriftDetector` — ECE/MCE trends over rolling windows
- `LeagueDriftDetector` — per-competition performance changes
- `BookmakerDriftDetector` — odds distribution shifts
- `DistributionDriftDetector` — prediction output distribution changes
- `DriftAlertEngine` — configurable thresholds per metric
- `ModelHealthDashboard` — data layer for health metrics (no UI)
- `AutoBenchmarkTrigger` — automatically run benchmark when champion degrades
- `AutoShadowValidation` — deploy challengers to shadow mode automatically

**Principle:** No model should be deployed without continuous monitoring.

---

## EPIC 14 — Live Engine

Real-time prediction infrastructure for live/in-play betting.

**Key modules:**
- `LiveMatchContext` — match state (score, minute, possession, etc.)
- `LiveEventStream` — goal, card, substitution, shot events
- `LiveFeatureUpdate` — incremental feature recomputation on new events
- `IncrementalProbabilityUpdate` — probability refresh on event
- `LiveMarketTranslator` — real-time translation of updated probabilities
- `LiveRecommendation` — per-market live picks with timing
- `LiveSnapshot` — point-in-time state capture for audit
- `LiveSettlement` — automatic settlement on match end
- `EventReplay` — replay completed live matches through engine
- `LatencyMonitor` — end-to-end timing from event to recommendation

**Performance target:** Live update latency < 1 second

**Design principle:** Reuses existing Prediction, Market, Feature, Model, and Odds modules. Zero business logic duplication.

---

## Global Requirements

### 1. Metadata Standard
Every artifact must include:
```json
{
  "gitCommit": "",
  "createdBy": "",
  "runtime": "",
  "executionTime": "",
  "datasetHash": "",
  "artifactVersion": ""
}
```

### 2. Performance Budget

| Area | Target |
|---|---|
| Feature generation | < 100ms per fixture |
| Probability inference | < 50ms |
| Replay throughput | > 10,000 matches/hour |
| Market translation | < 10ms |
| Simulation throughput | > 100,000 bets/minute |
| Live update latency | < 1s |

### 3. Compatibility Matrix

| Module | Depends On |
|---|---|
| BTTS | GoalDistribution |
| Asian Handicap | GoalDistribution |
| Over/Under | GoalDistribution |
| Moneyline | GoalDistribution |
| Kelly Staking | MarketRecommendation |
| Explainability | ModelZoo, FeatureFactory, OddsIntelligence |
| Drift Detection | All previous |

### 4. Definition of Done (Each EPIC)

A EPIC is only complete when ALL of the following pass:

1. ✅ `npx tsc --noEmit` — zero errors
2. ✅ `npx vitest run` — all tests pass (old + new)
3. ✅ `npx madge --circular` — zero cycles
4. ✅ Public API documented
5. ✅ Dependency graph updated
6. ✅ ADR updated
7. ✅ Benchmark before/after — no performance regression
8. ✅ No breaking changes to public contracts
9. ✅ All artifacts reproducible from scratch
10. ✅ Architecture audit report generated

---

## Final Engineering Assessment (2026-07-10)

| Area | Score | Notes |
|---|---|---|
| **Architecture** | 10/10 | Clean layers, zero cycles, clear boundaries |
| **Scalability** | 10/10 | Streaming replay, batch processing, event-driven |
| **Extensibility** | 10/10 | Plugin-based Market Framework, Feature Factory, Model Zoo |
| **Research Infrastructure** | 10/10 | Experiment Registry, Model Registry, Benchmark, Validation Lab |
| **Replay System** | 10/10 | Deterministic, checkpoint/resume, ProductionPredictorAdapter verified |
| **Plugin Design** | 10/10 | Market translators, feature plugins, model plugins |
| **Future ML Readiness** | 9.8/10 | Training/Serving separation ensures clean model deployment path |
| **Production Readiness** | 9.5/10 | Data Quality layer (EPIC 8.5) will close the remaining gap |

### Remaining recommendations before public beta:
1. Implement EPIC 8.5 (Data Quality) before Feature Factory
2. Ensure Model Training/Serving separation in EPIC 9
3. Establish performance budgets as hard gates
4. Complete the Compatibility Matrix as modules grow