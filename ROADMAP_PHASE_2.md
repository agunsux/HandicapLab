# HandicapLab — Phase 2 Research Platform Roadmap

**From: Prediction App → Research Platform**

The mission for Phase 2 is to transform HandicapLab from a prediction application into a **quantitative research platform** where every model can be validated, compared, and improved using historical data.

---

## Sprint 6.6.5 — Production Predictor Adapter Integration

**Critical Path:** Bridge replay to production Prediction Engine.

Before replay has any scientific value, it must run the **same code** that generates live predictions. This sprint connects the `Predictor` interface to the actual production pipeline.

**Deliverables:**
- Production `Predictor` adapter (wraps real engine without modifying it)
- End-to-end replay using production engine on 15 mock fixtures
- Replay vs live output comparison showing identical results
- Documentation proving replay and live use the same pipeline

**Why first:** Without this, all subsequent replay data is scientifically meaningless.

---

## Sprint 6.7 — Canonical Historical Dataset Platform

**Target:** Build HandicapLab's internal data standard. Not API-specific, not CSV-specific.

Any source → Normalizer → Canonical Dataset → Replay

**Deliverables:**
- Dataset Manifest (schema, version, hash, checksum, provenance)
- Canonical Match Schema (standardized fixture representation)
- Canonical Odds Schema (opening, closing, line movements)
- Canonical Team Identity (alias resolver, normalization)
- Competition Registry (league IDs, seasons, metadata)
- Timezone Normalizer
- Odds Normalizer (vig removal, decimal conversion)
- Validation Rules (schema conformance, range checks)
- Dataset Versioning (immutable snapshots with metadata)
- `dataset.hl` format (HandicapLab native dataset format)

**Output format:** `dataset.hl` — not CSV, not JSON — HandicapLab's own canonical format.

---

## Sprint 6.8 — Mass Replay Engine

**Target:** Replay 50,000 matches without memory leaks.

**Deliverables:**
- Parallel Worker Pool
- Replay Queue
- Resume from Checkpoint
- Progress Tracking
- Cancellation Support
- Retry Logic
- Partial Replay (subset of dataset)
- Memory Optimizer (streaming, batch disposal)
- Streaming Replay (process without loading entire dataset)
- Replay Cache (avoid re-computing unchanged matches)
- Execution Manifest (complete audit trail per run)
- Replay Artifact (compressed result package)
- Performance Metrics (throughput, latency, memory)

---

## Sprint 6.9 — Statistical Validation Laboratory

**Critical Sprint:** Scientific validation of every model.

**Deliverables:**
- Bootstrap Resampling (confidence intervals)
- Rolling Window Analysis
- Walk Forward Validation
- Cross Validation (by season, league, market)
- Calibration Curve (reliability diagram)
- Expected Calibration Error (ECE)
- Sharpness Metric
- LogLoss / Brier Score / AUC
- ROI / Yield / Profit Factor
- CLV Distribution Analysis
- Confidence Intervals (95%, 99%)
- Variance Analysis
- League Comparison (performance across competitions)
- Season Comparison (year-over-year trends)
- Market Comparison (ML vs AH vs OU)
- Automatic Report Generation
- Automatic Model Ranking
- Automatic Regression Detection

---

## Sprint 7.0 — Research Workbench

**Target:** Internal laboratory for comparing models.

**Deliverables:**
- Compare Model A vs B vs C
- Compare by: ROI, CLV, Calibration, Profit, Kelly, Yield, Drawdown, Confidence
- Filter by: League, Season, Market, Date Range, Odds Range
- Visual comparison reports
- Export to PDF/JSON
- Experiment tagging and notes

---

## Sprint 7.1 — Feature Store

**Target:** All features versioned and stored.

**Deliverables:**
- Canonical Feature Definitions
- Feature Versioning
- Feature Metadata Registry
- Feature Engineering Pipeline
- Feature Serving API
- Feature Lineage Tracking
- Features: Possession, Shots, xG, Corners, Rest Days, Travel Distance, Injuries, Market Drift, Opening/Closing Odds, Weather, Referee, Home Advantage, Recent Form, ELO

---

## Sprint 7.2 — Model Registry

**Target:** Multiple models, comparable, deployable.

**Deliverables:**
- Model Versioning
- Model Metadata
- Metrics per Version
- Champion/Challenger Pattern
- Rollback Support
- Model Lineage
- Supported: Poisson, Dixon-Coles, ELO, Bayesian, Logistic, Gradient Boosting, XGBoost, Ensemble, Neural Net, Meta Model

---

## Sprint 7.3 — Experiment Framework

**Target:** Every experiment tracked and reproducible.

**Deliverables:**
- Experiment ID + Manifest
- Dataset + Model + Parameters snapshot
- Metrics + Report per experiment
- Version pinning
- Status tracking (draft → running → complete → failed)
- Comparison API

---

## Sprint 7.4 — Continuous Benchmark

**Target:** Every commit benchmarks automatically.

**Deliverables:**
- Replay on Commit (CI pipeline)
- Regression Detection (metrics must not regress)
- Historical Trend Chart
- Alerts on degradation
- Automatic report on each commit

---

## Sprint 7.5 — Data Quality Platform

**Target:** Trust the data going into the system.

**Deliverables:**
- Duplicate Team Detection
- Alias Resolution
- Missing Odds Audit
- Impossible Odds Detection
- Missing Result Detection
- Broken Fixture Detection
- Timezone Drift Detection
- League Mapping Validation
- Bookmaker Mapping
- Coverage Scoring
- Confidence Score per Dataset

---

## Sprint 8.0 — Production Intelligence Platform

**Target:** AI-powered insights on system health.

**Deliverables:**
- AI Analysis (natural language summaries)
- Automatic Summary of model performance
- Recommendations (parameter tuning suggestions)
- Anomaly Detection (unexpected metric shifts)
- Performance Forecast (predicting future degradation)
- Model Health Dashboard
- "Why did ROI drop this week?" — answered automatically
- "Which league is underperforming?" — identified automatically
- "Which parameter caused calibration to drop?" — traced automatically

---

## Architecture Principles

```
Any Source
    ↓
[Normalizer]  ← Sprint 6.7
    ↓
Canonical Dataset (dataset.hl)
    ↓
[ReplayRunner]  ← Sprint 6.8
    ↓
Production Predictor  ← Sprint 6.6.5 (CRITICAL)
    ↓
[Statistical Validator]  ← Sprint 6.9
    ↓
[Research Workbench]  ← Sprint 7.0
    ↓
Model Improvement  ← Sprints 7.1–7.5
```

**Key invariant:** The Prediction Engine NEVER changes. Only providers, datasets, and validators evolve.

---

## Immediate Next Step

**Execute Sprint 6.6.5** — Create the Production Predictor Adapter that connects the replay engine to HandicapLab's actual production Prediction Engine, then run the 15-match mock dataset through it to prove end-to-end consistency.