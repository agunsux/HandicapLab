# ADR-037 — Historical Evidence Platform

**Date:** 2026-07-11  
**Status:** Ratified  
**Phase:** 4 — Platform & Operations

---

## Context

Phase 3 delivered the Research Operating System (prediction engine, replay,
registries, market framework, validation lab). However, the historical data
that feeds every replay, experiment, benchmark, calibration study, feature
study, and shadow-mode execution was ingested through ad-hoc paths with no
single, auditable source of truth.

Without a centralized evidence layer:

1. **Reproducibility is fragile** — datasets have no permanent identity, so an
   experiment cannot be re-run against the exact same input.
2. **Integrity is unverified** — duplicate fixtures, invalid odds, and timezone
   drift can silently corrupt research results.
3. **Leakage is undetected** — future information (closing odds, results,
   post-match fields) can leak into "pre-match" datasets, producing
   overconfident but invalid models (violating Invariant 11).
4. **Provenance is lost** — predictions cannot be traced to their raw source
   (violating Invariant 13).
5. **Coverage is opaque** — no way to know which markets/leagues are complete.

Phase 4 must provide a Historical Evidence Platform that becomes the single
source of truth for all historical data, guaranteeing that every future
experiment is reproducible, auditable, and statistically trustworthy.

---

## Decision

Introduce a new, self-contained module `src/lib/evidence-platform/` implementing
twelve cohesive capabilities (Sprints A1–A12):

| Sprint | Capability | Module |
|---|---|---|
| A1 | Season Registry | `seasonRegistry.ts` |
| A2 | Dataset Registry | `datasetRegistry.ts` |
| A3 | Manifest Generator | `manifestGenerator.ts` |
| A4 | Data Integrity Engine | `integrityEngine.ts` |
| A5 | Coverage Analyzer | `coverageAnalyzer.ts` |
| A6 | Leakage Detector | `leakageDetector.ts` |
| A7 | Provenance Engine | `provenanceEngine.ts` |
| A8 | Dataset Versioning | `datasetVersionStore.ts` |
| A9 | Diff Engine | `diffEngine.ts` |
| A10 | Import Pipeline | `importPipeline.ts` + `parsers.ts` |
| A11 | Evidence Ledger | `evidenceLedger.ts` |
| A12 | Reporting | `reporting.ts` |

Design constraints honoured:

- **Layer direction** — the platform depends downward only on the canonical
  dataset schema (`src/lib/dataset`) and the shared registry identifier factory.
  It never imports from `app/`, `services/`, or `pipelines/` (Invariant 5).
- **Immutability** — registry entries, provenance records, dataset versions, and
  evidence artifacts are `Object.freeze`d and append-only (Invariants 4 & 14).
- **Determinism** — integrity, coverage, leakage, diff, manifest, and hashing
  are pure functions (Invariant 9 spirit).
- **Reproducibility** — every dataset carries a checksum (raw source) and an
  order-independent fingerprint (canonical data) (Invariant 6).
- **Provenance travels through replay** — `ReplayContext` gains an **optional**
  `provenance?: DatasetProvenance` field (see Backward Compatibility below),
  satisfying Invariant 13 without breaking existing callers.

---

## Backward Compatibility (Frozen Interface Extension)

The only change to a frozen Phase 3 contract is the **additive, optional** field
`provenance?: DatasetProvenance` on `ReplayContext`. Per Invariant 16, adding an
optional field is backward compatible within the same major version:

- Existing callers that omit `provenance` compile and behave unchanged.
- `createReplayContext` passes the field through when supplied.
- No method signatures changed; no required fields added; no return types changed.

`src/lib/registry/identifiers.ts` gains an additive `EVIDENCE: 'evd'` prefix
constant. No existing prefixes changed.

No changes were made to `ProbabilityEngine`, `ProductionPredictorAdapter`,
`ReplayRunner`, `MarketTranslator`, the Experiment Registry, or any existing
abstraction.

---

## Alternatives Considered

| Alternative | Rejected Because |
|---|---|
| Extend the existing `dataset` module in place | Would couple ingestion, versioning, integrity and ledger concerns into a frozen leaf module |
| Reuse `lib/data/evidence` (prediction ledger) | That ledger records *predictions*; this platform records *datasets* — different lifecycle and contract |
| Make `ReplayContext.provenance` required | Breaking change; would violate Invariant 16 and force churn on all callers |
| Store datasets mutably with overwrite | Violates Invariants 4 & 14 (append-only, immutable history) |

---

## Consequences

### Positive
- Single source of truth for historical evidence across all research surfaces.
- Every imported dataset has a permanent id, checksum, fingerprint, manifest,
  integrity score, provenance, immutable version, and evidence artifact.
- Datasets that fail validation, integrity (errors), or leakage are rejected
  before entering the registry.
- Full audit trail: provenance travels through the replay engine.

### Negative
- New surface area to maintain (12 modules) — mitigated by near-100% unit tests.
- Enrichment coverage (xG, lineups, injuries, weather) relies on side-channel
  inputs because these are not part of the frozen canonical schema.

### Neutral
- Storage is abstracted (`EvidenceStorageAdapter`) with an in-memory default;
  a durable adapter can be added later without contract changes.

---

## Compliance

- `npx tsc --noEmit` → 0 errors.
- `npx eslint src/lib/evidence-platform` → 0 warnings; no `any`, `ts-ignore`, or
  `eslint-disable`.
- 74 unit tests across 5 suites, all passing.
- Existing replay tests (22) unaffected.
