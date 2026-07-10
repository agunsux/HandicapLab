# HandicapLab — Master Execution Prompt

**Version:** 2.0 (Architecture Constitution)  
**Status:** Active — Use this as the single context document for every implementation session  
**Last Updated:** 2026-07-11  

---

## How To Use This Document

This is the **single context document** for every HandicapLab implementation session. At the start of each session, the AI reads this document once to establish context, then receives a **short sprint prompt** specifying the current capability, EPIC, and objective.

**Do not** write separate per-EPIC prompts. **Do not** redesign frozen modules. Use this constitution.

---

## Product Position

HandicapLab is a **Football Market Intelligence Platform**.

It combines:

- Quantitative research
- Reproducible prediction workflows
- Explainable machine intelligence
- Transparent validation
- Immutable research records

**Target markets:** Asian Handicap, Over/Under, Moneyline, BTTS  
**Future markets** (no architectural redesign required): Corners, Cards, Player Markets

**Never** describe the platform as a tipster.  
**Never** optimize for "daily picks."  
**Optimize for research quality.**

---

## Architecture Invariants (The Constitution)

| # | Invariant |
|---|---|
| 1 | **Single source of truth** — Only `ProbabilityEngine.predict()` generates match probabilities |
| 2 | **Replay uses production engine** — `ProductionPredictorAdapter` wraps `ProbabilityEngine.predict()` |
| 3 | **Market translators are read-only** — No DB access, no state, no independent probability computation |
| 4 | **Registries immutable after finalization** — `Object.freeze()` on complete/promote |
| 5 | **No reverse dependencies** — Lower layers never import higher layers |
| 6 | **All artifacts reproducible** — Dataset hash + config hash + seed → identical output |
| 7 | **Centralized identifiers** — `generateId(prefix)` from `identifiers.ts` |
| 8 | **All plugins must register** — No bypassing the registry |
| 9 | **Prediction deterministic** — Same input → same output |
| 10 | **Freeze changes require ADR** — Post-freeze interface changes need documented decision |
| 11 | **No future information in predictions** — Data leakage prevention |
| 12 | **All randomness seeded and reproducible** — Seed stored in artifact |
| 13 | **Every prediction traceable to source data** — Provenance chain |
| 14 | **Historical artifacts append-only** — No mutation, new versions instead |
| 15 | **Domain logic provider-independent** — Canonical data only |
| 16 | **Public interfaces backward compatible** — Within same major version |

**Full document:** `ARCHITECTURE_INVARIANTS.md`

---

## Engineering Principles (Implementation Standards)

| # | Principle |
|---|---|
| 1 | Every module has unit tests |
| 2 | Every public API has contract tests |
| 3 | No `any` types |
| 4 | No hidden singletons |
| 5 | All logs structured |
| 6 | All errors typed |
| 7 | All dependencies injected |
| 8 | All plugins have metadata + version |
| 9 | No global mutable state in tests |
| 10 | Modules self-contained |
| 11 | Pure functions where possible |
| 12 | Feature toggles over branching |

**Full document:** `ENGINEERING_PRINCIPLES.md`

---

## Capability Map

```
CAPABILITY 1 — Research Intelligence Platform
  EPIC 8: Feature Factory
  EPIC 8.5: Data Quality Engine
  Feature Importance Lab
  Walk Forward Validation
  Research Report Generator
  Research Artifact Registry

CAPABILITY 2 — Verified Research Ledger
  Ledger Repository (Search, Export, API)
  Immutable Audit Logs
  Confidence Framework (Model Agreement, Calibration, Historical Accuracy, Data Quality, Market Stability)
  Market Quality Scoring (Excellent, Good, Neutral, Avoid)
  Trust Metrics (Calibration, CLV, Accuracy, ROI, Yield)

CAPABILITY 3 — Explainability Engine
  Reason Generator (Top Features, Evidence, Similar Matches)
  Natural Language Summary
  Feature Attribution
  Counterfactual Explanation
  Market Analysis

CAPABILITY 4 — Football Market Intelligence
  Pre-Match Scanner
  Live Scanner
  Odds Intelligence (Movement, Steam, Consensus, Sharp/Public Divergence, Liquidity)
  Market Stability Analysis
  Value Detection

CAPABILITY 5 — Shadow Validation Platform
  Continuous predictions + settlements
  Calibration + CLV + ROI + Yield + Trust tracking
  Model drift detection
  60–90 day validation cycles

CAPABILITY 6 — Production Intelligence
  Monitoring + Alerting + Health Checks
  Model / Data / Feature Drift Detection
  Retraining Pipeline
  Incident Reports

CAPABILITY 7 — Commercial Platform
  Public Research Portal
  Verified Research Ledger (public)
  API + Subscriptions + One-Time Credits
  Analytics Dashboard
  Role Based Access + Audit Logs

CAPABILITY 8 — Advanced Quantitative Research
  Model Zoo (8+ models)
  Bayesian Optimization
  Simulation Lab (Kelly, Portfolio, Risk)
  Ensemble Learning
  Monte Carlo + Bootstrap Validation
```

**Every module must belong to exactly one capability.**

---

## Technical EPIC Roadmap (Implementation View)

| EPIC | Name | Capability | Dependency |
|---|---|---|---|
| 8 | **Feature Factory** | 1 | FeatureStore exists |
| 8.5 | **Data Quality Engine** | 1 | EPIC 8 |
| 9 | **Model Zoo** | 8 | EPIC 8 |
| 10 | **Odds Intelligence** | 4 | EPIC 1–7 |
| 11 | **Simulation Laboratory** | 8 | EPIC 9, 10 |
| 12 | **Explainability & Confidence** | 3 | EPIC 8, 9, 10 |
| 13 | **Production Intelligence** | 6 | All previous |
| 14 | **Live Engine** | 4 | All previous |

---

## Research Principles

Every experiment must store:

- Experiment ID
- Dataset Version
- Feature Version
- Model Version
- Seed
- Timestamp
- Parameters
- Metrics
- Artifacts

**Everything must be reproducible.**

---

## Confidence Framework

Every prediction computes:

- Confidence Score
- Model Agreement
- Historical Accuracy
- Calibration
- Prediction Stability
- Data Quality
- Market Stability
- Trust Score

---

## Quality Framework

Every market computes:

- Expected Value
- Closing Line Value
- Calibration
- Historical ROI
- Liquidity
- Variance
- Market Stability
- Market Quality (Excellent, Good, Neutral, Avoid)

**If quality is below threshold, DO NOT recommend.**

---

## Reporting Formats

All reports must support:

- Markdown
- HTML
- JSON
- CSV
- API

Card types:

- Research Cards
- Model Cards (version, sample size, ROI, yield, calibration, Brier, LogLoss, ECE, retrained, limitations)
- Feature Cards (definition, formula, dependencies, importance, version, owner, validation)
- Dataset Cards (coverage, completeness, freshness, missing values, duplicates, outliers, schema, drift)
- Confidence Cards
- Market Cards

---

## Definition of Done (Every Session)

1. ✅ Working source code
2. ✅ All tests pass (old + new)
3. ✅ Documentation updated
4. ✅ ADR created if needed
5. ✅ No TODO placeholders
6. ✅ No stub implementations
7. ✅ No duplicated code
8. ✅ Architecture invariants preserved
9. ✅ Backward compatible
10. ✅ Migration notes if breaking

---

## Session Prompt Template

At the start of each implementation session, use:

```text
Continue HandicapLab implementation.

Architecture Constitution is frozen.

Do not redesign previous modules.

Current Capability

[Capability Name]

Current Technical EPIC

[EPIC Number and Name]

Current Sprint

[Sprint Number]

Objectives

Build the next production-ready modules only.

Requirements

• Follow Architecture Invariants.
• Follow Engineering Principles.
• Follow Capability Map.
• Keep backward compatibility.
• Add tests.
• Update documentation.
• No placeholders.
• No duplicated code.
• Everything typed.
• Everything reproducible.
• Everything auditable.

Before coding

Review existing implementation.

Identify reusable modules.

Avoid rebuilding existing functionality.

After implementation

Run a consistency review.

Report

• completed modules
• remaining work
• technical debt
• risks
• next sprint recommendation

Then automatically continue with the next coherent sub-sprint if there are no blockers.
```

---

## Reference Documents

| Document | Location |
|---|---|
| Architecture Invariants | `ARCHITECTURE_INVARIANTS.md` |
| Engineering Principles | `ENGINEERING_PRINCIPLES.md` |
| ADR Index | `ADR_INDEX.md` |
| Phase 3 Roadmap | `ROADMAP_PHASE_3.md` |
| Phase 4 Roadmap | `ROADMAP_PHASE_4.md` |
| Phase 2 Roadmap (historical) | `ROADMAP_PHASE_2.md` |

Read these documents before starting any implementation session to ensure full context.