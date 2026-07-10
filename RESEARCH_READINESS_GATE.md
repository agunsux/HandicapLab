# HandicapLab — Research Readiness Gate

**Type:** Milestone Criteria  
**Status:** Active — Gate must be passed before Feature Factory (EPIC 8) enters full production  
**Last Updated:** 2026-07-11  

---

## Purpose

This document defines the **mandatory checklist** that must be satisfied before any capability (Feature Factory, Model Zoo, Explainability, etc.) can be considered production-ready.

The gate exists to prevent the common failure mode: building sophisticated capabilities on top of untrusted data or unvalidated pipelines. Every layer must prove its foundation before the next layer is built.

---

## Gate Structure

Each gate has multiple criteria. A gate is passed only when **all** criteria are met.

---

## Gate 1 — Data Integrity

Before any feature computation or model training, the dataset pipeline must be proven correct.

| # | Criterion | Verification Method | Pass/Fail |
|---|---|---|---|
| 1.1 | Historical fixtures load into canonical format without errors | DatasetBuilder.build() succeeds | ☐ |
| 1.2 | Team identity resolution coverage ≥ 99% | TeamIdentityRegistry.resolve() test against 1,000+ fixtures | ☐ |
| 1.3 | League identity resolution coverage = 100% | CompetitionRegistry.resolve() test against all source leagues | ☐ |
| 1.4 | No duplicate fixtures in any dataset | DatasetValidator detects zero duplicates | ☐ |
| 1.5 | No missing critical fields (home team, away team, kickoff, odds, result) | DatasetValidator reports zero critical errors | ☐ |
| 1.6 | Odds are valid (decimal, positive, within 1.01–100.0 range) | DatasetValidator reports zero odds errors | ☐ |
| 1.7 | Results are valid (non-negative integer goals) | DatasetValidator reports zero result errors | ☐ |
| 1.8 | All kickoff timestamps are valid ISO 8601 dates | DatasetValidator reports zero date errors | ☐ |
| 1.9 | SHA-256 fingerprint matches after rebuild (determinism) | Build dataset twice → fingerprints match | ☐ |
| 1.10 | Provenance recorded for every fixture | Every dataset has non-empty provenance field | ☐ |

**Gate 1 Status:** ☐ **PASS** / ☐ **FAIL**

---

## Gate 2 — Replay Integrity

The replay pipeline must be proven correct against known outcomes.

| # | Criterion | Verification Method | Pass/Fail |
|---|---|---|---|
| 2.1 | ReplayRunner produces deterministic output for same dataset | Run twice → identical results | ☐ |
| 2.2 | Replay uses ProductionPredictorAdapter (not mock) | Code review confirms adapter in use | ☐ |
| 2.3 | Replay uses ProbabilityEngine.predict() (not custom logic) | Code review confirms engine call | ☐ |
| 2.4 | Settlement matches known results for 100+ fixtures | Manual verification of settled outcomes | ☐ |
| 2.5 | All four market types (ML, AH, OU, BTTS) settle correctly | MarketSettlementEngine tests pass | ☐ |
| 2.6 | Replay completes within performance budget | > 10,000 matches/hour throughput | ☐ |
| 2.7 | Replay produces correct metrics (ROI, Brier, CLV) | Cross-verified against known dataset | ☐ |
| 2.8 | No data leakage in replay (no future information) | Timestamp audit on all features | ☐ |

**Gate 2 Status:** ☐ **PASS** / ☐ **FAIL**

---

## Gate 3 — Validation Completeness

The validation laboratory must produce comprehensive, statistically sound metrics.

| # | Criterion | Verification Method | Pass/Fail |
|---|---|---|---|
| 3.1 | ROI computed correctly | Test against manual calculation | ☐ |
| 3.2 | Yield computed correctly | Test against manual calculation | ☐ |
| 3.3 | Brier Score computed correctly | Test against manual calculation | ☐ |
| 3.4 | LogLoss computed correctly | Test against manual calculation | ☐ |
| 3.5 | Calibration ECE computed correctly | Test against known calibrated output | ☐ |
| 3.6 | Calibration MCE computed correctly | Test against known miscalibrated output | ☐ |
| 3.7 | CLV computed correctly | Test against manual calculation | ☐ |
| 3.8 | Walk-forward validation produces correct windows | Test window boundaries | ☐ |
| 3.9 | Bootstrap produces valid confidence intervals | Test coverage properties | ☐ |
| 3.10 | League comparison produces correct per-league splits | Test against known data | ☐ |
| 3.11 | All 18 metrics exposed in ValidationReport | All fields populated | ☐ |

**Gate 3 Status:** ☐ **PASS** / ☐ **FAIL**

---

## Gate 4 — Explainability Minimum

A minimum explainability layer must exist before Feature Factory.

| # | Criterion | Verification Method | Pass/Fail |
|---|---|---|---|
| 4.1 | Every prediction has a reason summary | Pipeline populates reason field | ☐ |
| 4.2 | Reason summarizes probability, fair odds, expected value | Check output format | ☐ |
| 4.3 | Settlement outcome is recorded and explainable | Ledger shows settlement with reason | ☐ |
| 4.4 | Market translator output is traceable to goal distribution | Translator reads score matrix only | ☐ |
| 4.5 | No hallucinated explanations | All explanation fields are deterministic | ☐ |

**Gate 4 Status:** ☐ **PASS** / ☐ **FAIL**

---

## Gate 5 — Verified Research Ledger

The ledger must automatically record all research activity.

| # | Criterion | Verification Method | Pass/Fail |
|---|---|---|---|
| 5.1 | Every replay produces a ledger entry | Run replay → ledger populated | ☐ |
| 5.2 | Ledger entries are immutable after creation | Attempted mutation throws error | ☐ |
| 5.3 | Prediction ID, fixture, market, selection, probability stored | Check ledger fields | ☐ |
| 5.4 | Model version, dataset version, feature version stored | Check ledger fields | ☐ |
| 5.5 | Settlement, CLV, ROI, Yield stored | Check ledger fields after settlement | ☐ |
| 5.6 | Ledger exportable to CSV, JSON, Markdown | Export functions work | ☐ |
| 5.7 | No manual editing of ledger entries | API enforces append-only | ☐ |

**Gate 5 Status:** ☐ **PASS** / ☐ **FAIL**

---

## Gate 6 — Model Promotion Integrity

Model promotion follows ADR-034 (Evidence Over Outcome).

| # | Criterion | Verification Method | Pass/Fail |
|---|---|---|---|
| 6.1 | Champion demotion creates ADR | Promote new champion → ADR created | ☐ |
| 6.2 | Promotion requires walk-forward validation | Registry checks before promote | ☐ |
| 6.3 | Promotion requires bootstrap CI | Registry checks before promote | ☐ |
| 6.4 | Promotion requires ECE < 0.05 | Registry checks before promote | ☐ |
| 6.5 | Promotion does not overwrite previous champion history | Promotion appends, never replaces | ☐ |

**Gate 6 Status:** ☐ **PASS** / ☐ **FAIL**

---

## Gate 7 — Feature Factory Readiness

Before Feature Factory enters production:

| # | Criterion | Verification Method | Pass/Fail |
|---|---|---|---|
| 7.1 | All Gate 1–6 pass | Cumulative checklist | ☐ |
| 7.2 | At least one complete dataset passes all gates | EPL 2024-25 dataset verified | ☐ |
| 7.3 | Baseline model (Poisson) produces scientifically valid output | All gates passed for baseline | ☐ |
| 7.4 | Research lifecycle documented | SCIENTIFIC_METHOD.md reviewed | ☐ |
| 7.5 | Anti-patterns documented and understood | Team has read and acknowledged | ☐ |

**Gate 7 Status:** ☐ **PASS** / ☐ **FAIL**

---

## Overall Research Readiness

| Gate | Status | Date |
|---|---|---|
| Gate 1 — Data Integrity | ☐ | |
| Gate 2 — Replay Integrity | ☐ | |
| Gate 3 — Validation Completeness | ☐ | |
| Gate 4 — Explainability Minimum | ☐ | |
| Gate 5 — Verified Research Ledger | ☐ | |
| Gate 6 — Model Promotion Integrity | ☐ | |
| Gate 7 — Feature Factory Readiness | ☐ | |
| **Overall** | **☐ READY / ☐ NOT READY** | |

**Decision:** Feature Factory (EPIC 8) must not enter full production until "Overall" reads READY.

---

## Deferred (Phase 4) Gates

The following gates are intentionally deferred to Phase 4 and do not block Feature Factory:

| Deferred Gate | Phase 4 EPIC |
|---|---|
| Public API availability | EPIC 20 |
| Commercial subscription system | EPIC 20 |
| Real-time live engine | EPIC 14 |
| AI Assistant integration | EPIC 23 |
| Multi-region deployment | Operations |
| Microservices migration | Operations |