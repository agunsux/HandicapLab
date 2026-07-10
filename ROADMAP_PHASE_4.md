# HandicapLab — Phase 4: Platform & Operations (Post-Freeze)

**Generated:** 2026-07-10  
**Status:** Future — architectural runway for Phase 4

---

## Preamble

Phase 3 (EPIC 1–14) is now under **architecture freeze**. The core Research Operating System is complete:

- ✅ Prediction Engine (ProbabilityEngine.predict — immutable)
- ✅ Replay Engine (ProductionPredictorAdapter verified)
- ✅ Canonical Dataset Platform
- ✅ Statistical Validation Laboratory
- ✅ Market Framework (ML, AH, OU, BTTS)
- ✅ Feature Store
- ✅ Model Registry + Experiment Registry
- ✅ Execution Pipeline (EPIC 2)
- ✅ Data Quality Layer (EPIC 8.5)
- ✅ Feature Factory (EPIC 8)
- ✅ Model Zoo with Training/Serving separation (EPIC 9)
- ✅ Odds Intelligence (EPIC 10)
- ✅ Simulation Laboratory (EPIC 11)
- ✅ Explainability & Confidence (EPIC 12)
- ✅ Production Intelligence (EPIC 13)
- ✅ Live Engine (EPIC 14)

The following capabilities are **intentionally deferred to Phase 4** because they address operational scaling, developer experience, and commercial readiness — not core prediction science.

---

## EPIC 15 — Experiment Lineage

**Problem:** When ROI changes, you need to trace the root cause across the entire chain: prediction → model → training → dataset → raw source.

**Deliverables:**
- `LineageGraph` — directed acyclic graph connecting all artifacts
- `LineageNode` — each experiment, dataset, model, feature set, calibration, translator, odds snapshot
- `LineageEdge` — dependency relationships (uses, trained-on, derived-from)
- Trace forward: "What predictions used this model?"
- Trace backward: "What dataset was this model trained on?"
- `LineageQuery` — filter by type, time range, version
- `LineageArtifact` — exportable lineage report

---

## EPIC 16 — Research Query Engine

**Problem:** With thousands of experiments, finding specific results requires manual artifact inspection.

**Deliverables:**
- `ResearchQuery` — structured query language:
  ```
  experiments WHERE league = EPL AND model = Dixon-Coles AND season = 2023
    AND roi > 5 AND clv > 0 AND ece < 0.03
  ```
- `QueryEngine` — indexes all experiments, models, benchmarks, validations
- `QueryResult` — paginated, sortable, filterable results
- `QueryExport` — JSON, CSV, markdown export
- `SavedQuery` — reusable query templates
- `DashboardView` — aggregated statistics per query

---

## EPIC 17 — Scheduler / Orchestrator

**Problem:** Pipelines require manual triggering. No automation for daily updates.

**Deliverables:**
- `Scheduler` — cron-based orchestration
- `Orchestrator` — dependency-aware pipeline execution
- Pipeline templates:
  ```
  Daily: Update Fixtures → Update Odds → Feature Build → Prediction → Settlement
  Weekly: Benchmark → Drift Detection → Report
  On-Demand: Replay → Validation → Benchmark → Export
  ```
- `ScheduledJob` — one-time, recurring, conditional
- `JobStatus` — pending, running, completed, failed, skipped
- `ExecutionLog` — per-step timing, status, errors
- `AlertOnFailure` — integrated with Production Intelligence (EPIC 13)

---

## EPIC 18 — Secrets & Configuration Layer

**Problem:** Adding a new data provider requires code changes for API keys and configuration.

**Deliverables:**
- `ConfigRegistry` — hierarchical key-value configuration
- `SecretManager` — encrypted storage for API keys, tokens
- `ProviderConfig` — per-provider configuration schema
- `RuntimeConfig` — overridable without deployment
- `ConfigSchema` — validation rules per config key
- `ConfigVersion` — versioned configuration snapshots
- `ConfigExport` — audit-ready configuration report

---

## EPIC 19 — Plugin SDK

**Problem:** Each new plugin (feature, market, model, odds provider) requires manual registration.

**Deliverables:**
- `PluginSDK` — internal npm package for plugin development
- Plugin interfaces:
  ```typescript
  class MyFeaturePlugin implements FeaturePlugin { ... }
  class MyMarketPlugin implements MarketPlugin { ... }
  class MyModelPlugin implements ModelPlugin { ... }
  class MyOddsProvider implements OddsProviderPlugin { ... }
  ```
- `AutoDiscovery` — scan directories for plugin implementations
- `AutoRegistration` — register all discovered plugins on startup
- `PluginManifest` — name, version, dependencies, capabilities
- `PluginSandbox` — isolated execution for third-party plugins
- `PluginValidator` — validate plugin against contract before registration
- `PluginBenchmark` — measure plugin performance

---

## EPIC 20 — Public Research API

**Problem:** Dashboard, mobile, and third-party apps each need their own integration without duplicating business logic.

**Deliverables:**
- `ResearchAPI` — query experiments, models, benchmarks
- `PredictionAPI` — get predictions by fixture, league, market
- `OddsAPI` — query odds history, steam, CLV
- `ReplayAPI` — trigger replay jobs, query results
- `ExperimentAPI` — create, start, complete experiments
- `ModelAPI` — query champion, challengers, comparison
- `APIKeyManager` — key generation, rotation, rate limiting
- `APIDocumentation` — OpenAPI 3.0 spec
- `APIVersioning` — semantic versioning for all endpoints
- `APIMetrics` — request count, latency, error rate per endpoint

---

## EPIC 21 — Asset Versioning

**Problem:** ONNX models, CatBoost binaries, embeddings, scalers, and encoders need consistent versioning with checksums.

**Deliverables:**
- `AssetRegistry` — versioned storage for binary artifacts
- `AssetChecksum` — SHA-256 of all registered assets
- `AssetManifest` — name, version, hash, size, type, dependencies
- `AssetStorage` — local filesystem, S3-compatible, Supabase
- `AssetLifecycle` — upload, promote, deprecate, archive
- `AssetDeployment` — deploy specific asset version to serving environment
- `AssetAudit` — complete deployment history

---

## EPIC 22 — Multi-League Benchmark

**Problem:** Single-model benchmarks hide per-league performance differences.

**Deliverables:**
- `LeagueBenchmarkRunner` — runs benchmark per league
- `LeagueBenchmarkReport` — per-league metrics table:
  | League | ROI | CLV | Calibration (ECE) | Brier | Bets |
  |--------|-----|-----|--------------------|-------|------|
  | EPL | 8.2% | 0.04 | 0.021 | 0.181 | 1,240 |
  | Serie A | 3.1% | 0.02 | 0.034 | 0.192 | 890 |
  | ... | ... | ... | ... | ... | ... |
- `LeagueBenchmarkComparison` — head-to-head between leagues
- `LeagueParameterTuning` — suggest per-league parameter overrides
- `LeagueBenchmarkHistory` — track per-league performance over time

---

## EPIC 23 — AI Assistant (Separate Layer)

**Problem:** Users need insights but the prediction system must remain deterministic.

**Architecture Principle:** AI is a **consumer** of research results, not a **producer** of predictions.

```
Research OS (deterministic)
        │
        ▼
Inference Layer (deterministic)
        │
        ▼
AI Assistant (non-deterministic, read-only)
```

**Deliverables:**
- `ResearchSummary` — AI-generated natural language summary of experiment results
- `AnomalyExplanation` — AI explanation of unexpected metric changes
- `TrendAnalysis` — AI identification of performance trends
- `RecommendationGenerator` — AI suggestions for next experiments
- `ReportWriter` — AI-generated executive summaries
- `QueryInterpreter` — natural language to ResearchQuery translation
- All AI output is **read-only** — never feeds back into ProbabilityEngine

---

## Summary: Phase 3 vs Phase 4

| Dimension | Phase 3 (Frozen) | Phase 4 (Future) |
|---|---|---|
| Focus | Prediction science | Platform operations |
| Core engine | ✅ ProbabilityEngine | Immutable |
| Replay | ✅ ProductionPredictorAdapter | Immutable |
| Research | ✅ Full OS | Query engine + lineage |
| Automation | Manual pipeline | Scheduler/orchestrator |
| Developer experience | Plugin architecture | Plugin SDK |
| Commercial | Not started | Public API + billing |
| AI integration | None | Read-only assistant |