# HandicapLab — Architecture Decision Record Index

**Type:** Decision Log  
**Status:** Active  
**Last Updated:** 2026-07-10  

---

## Purpose

This index tracks every Architecture Decision Record (ADR) made during HandicapLab's development. ADRs document significant architectural decisions, their rationale, alternatives considered, and consequences.

Per **Invariant 10**, any change to a frozen interface or invariant after Phase 3 architecture freeze requires a new ADR.

---

## Phase 1 — Foundation (Sprints 1–6)

| ADR | Title | Date | Status |
|---|---|---|---|
| 001 | Use Next.js App Router for API routes | Sprint 1 | ✅ Ratified |
| 002 | Supabase as primary database | Sprint 1 | ✅ Ratified |
| 003 | ProbabilityEngine as single prediction source | Sprint 2 | ✅ Ratified |
| 004 | Poisson + Dixon-Coles as baseline models | Sprint 2 | ✅ Ratified |
| 005 | Replay architecture using replay runner | Sprint 3 | ✅ Ratified |
| 006 | Structured logging with JSON format | Sprint 3 | ✅ Ratified |
| 007 | Canonical dataset format for historical data | Sprint 4 | ✅ Ratified |
| 008 | ProductionPredictorAdapter as replay bridge | Sprint 6 | ✅ Ratified |
| 009 | Market translator pattern (ML, AH, OU) | Sprint 6 | ✅ Ratified |
| 010 | Validation metrics as pure functions | Sprint 6 | ✅ Ratified |

---

## Phase 2 — Research Platform (Sprints 6.7–6.9)

| ADR | Title | Date | Status |
|---|---|---|---|
| 011 | Canonical Dataset Platform with SHA-256 fingerprinting | Sprint 6.7 | ✅ Ratified |
| 012 | Mass Replay Engine with checkpoint/resume | Sprint 6.8 | ✅ Ratified |
| 013 | Statistical Validation Laboratory (18 metrics) | Sprint 6.9 | ✅ Ratified |
| 014 | Bootstrap validation with configurable resampling | Sprint 6.9 | ✅ Ratified |
| 015 | Walk-forward validation (rolling window, seasonal, chronological) | Sprint 6.9 | ✅ Ratified |

---

## Phase 3 — Research Operating System (EPIC 1–7)

| ADR | Title | Date | Status |
|---|---|---|---|
| 016 | Experiment Registry with immutable completion | EPIC 1 | ✅ Ratified |
| 017 | Model Registry with champion/challenger lifecycle | EPIC 1 | ✅ Ratified |
| 018 | Feature Store with versioned dependencies | EPIC 1 | ✅ Ratified |
| 019 | Feature Dependency Graph (DAG via Kahn's algorithm) | EPIC 1 | ✅ Ratified |
| 020 | Centralized identifier generation (exp_000001, mdl_000001) | Hardening | ✅ Ratified |
| 021 | Standardized BaseMetadata contract | Hardening | ✅ Ratified |
| 022 | Domain events for all registry state changes | Hardening | ✅ Ratified |
| 023 | Execution pipeline (experiment → replay → validation → benchmark) | EPIC 2 | ✅ Ratified |
| 024 | BenchmarkRegistry with model comparison | EPIC 2 | ✅ Ratified |
| 025 | Hyperparameter search as tracked experiments | EPIC 2 | ✅ Ratified |
| 026 | Market Framework as plugin-based translators | EPIC 7 | ✅ Ratified |
| 027 | BTTS as first proof of translator extensibility | EPIC 7 | ✅ Ratified |
| 028 | Data Quality Layer between dataset and feature factory | EPIC 8.5 | ✅ Ratified |
| 029 | Feature Factory separated from Feature Store | EPIC 8 | ✅ Ratified |
| 030 | Model Training/Serving separation | EPIC 9 | ✅ Ratified |
| 031 | Architecture freeze for Phase 3 public contracts | Freeze | ✅ **Active** |
| 032 | 16 architecture invariants ratified as project constitution | Freeze | ✅ **Active** |
| 033 | 12 engineering principles ratified as implementation standards | Freeze | ✅ **Active** |
| 034 | Evidence Over Outcome — model promotion based on evidence quality, not ROI alone | Freeze | ✅ **Active** |
| 035 | Scientific Method research lifecycle (11-stage methodology) | Freeze | ✅ **Active** |
| 036 | Research Readiness Gate (7-gate checklist before Feature Factory) | Freeze | ✅ **Active** |

---

## Phase 4 — Platform & Operations

| ADR | Title | Date | Status |
|---|---|---|---|
| 037 | Historical Evidence Platform (season/dataset registries, integrity, coverage, leakage, provenance, versioning, diff, import pipeline, evidence ledger, reporting) | 2026-07-11 | ✅ Ratified |

---

## How to Create a New ADR

When a change requires an ADR (per Invariant 10):

1. Copy template from `docs/adr/TEMPLATE.md`
2. Assign next ADR number
3. Fill in: Title, Date, Status, Context, Decision, Consequences, Compliance
4. Add entry to this index
5. Submit for review

### ADR Template

```markdown
# ADR-XXX — [Title]

**Date:** YYYY-MM-DD  
**Status:** Proposed | Accepted | Deprecated | Superseded

## Context
[What is the issue or motivation?]

## Decision
[What was decided and why?]

## Alternatives Considered
[What other options were evaluated?]

## Consequences
[What are the trade-offs, risks, and benefits?]

## Compliance
[How will this decision be enforced?]
```

---

## Research Phase ADRs (Reserved — Research Program A+)

The following ADRs are reserved for the Quantitative Research phase (v0.8.0+):

| ADR | Title | Status |
|---|---|---|
| 037 | Feature Factory plugin architecture | 🔮 Planned |
| 038 | Model Zoo plugin architecture | 🔮 Planned |
| 039 | Odds Intelligence framework | 🔮 Planned |
| 040 | Simulation Laboratory | 🔮 Planned |
| 041 | Production Intelligence / Drift Detection expansion | 🔮 Planned |
| 042 | Live Engine architecture | 🔮 Planned |
| 043 | Research Program A — Quantitative results protocol | 🔮 Planned |

---

*ADR 034–036 are ratified in Phase 3 above. This section tracks only reserved future ADRs.*
