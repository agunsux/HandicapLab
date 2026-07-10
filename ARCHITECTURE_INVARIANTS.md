# HandicapLab — Architecture Invariants

**Type:** Project Constitution  
**Status:** Ratified — Phase 3 Architecture Freeze  
**Last Updated:** 2026-07-10 (Rev 3)  

---

## Purpose

This document defines the **non-negotiable rules** that the HandicapLab codebase must never violate. Unlike the roadmap (which describes what to build), this document describes **what must never change**.

Every contributor, every sprint, every EPIC, every refactor must preserve these invariants. Violations must be treated as architecture regressions and fixed immediately.

---

## Freeze Scope

**WHAT is frozen:** Public interfaces, contracts, and architectural boundaries.

```text
✅ ProbabilityEngine.predict() signature
✅ ProductionPredictorAdapter interface
✅ ReplayRunner contract
✅ MarketTranslator interface
✅ Canonical Dataset schema
✅ Registry public APIs
✅ Artifact contracts
✅ Identifier format (exp_000001, mdl_000001, ...)
✅ Metadata structure
✅ Event type definitions
```

**WHAT is NOT frozen:** Internal implementations, algorithms, optimizations.

```text
✅ Changes to Poisson implementation
✅ Changes to calibration algorithm
✅ Changes to feature engineering
✅ Changes to ML model internals
✅ Changes to translator math
✅ Performance optimizations
✅ New model types
✅ New feature plugins
```

**Principle:** Freeze the interfaces, not the intelligence.

---

## Invariant 1 — Single Source of Truth

`ProbabilityEngine.predict()` is the **only** function that generates match probabilities.

```
Any prediction → ProbabilityEngine.predict()
```

No other module may compute win/draw/away probabilities independently. Market translators read the score matrix — they do not compute their own probabilities.

**Rationale:** Multiple probability sources would produce inconsistent outputs and make validation impossible.

---

## Invariant 2 — Replay Must Use Production Engine

Replay must always use `ProductionPredictorAdapter` which wraps `ProbabilityEngine.predict()`.

```
ReplayRunner → ProductionPredictorAdapter → ProbabilityEngine.predict()
```

No separate "replay prediction" code path. No simplified mock predictor in production replay.

**Rationale:** If replay and live use different prediction code, replay results are scientifically invalid.

---

## Invariant 3 — Market Translators Are Read-Only

Market translators must **never** compute their own probabilities. They read the goal distribution (score matrix) from `ProbabilityEngine` and mechanically translate it into market-specific formats.

```
GoalDistribution → MarketTranslator → Market probabilities
```

No translator may:
- Access a database
- Call external APIs
- Train models
- Maintain state between translations

**Rationale:** Market probabilities must always sum to the same underlying match distribution. Independent probability computation would break calibration and validation.

---

## Invariant 4 — Registries Are Immutable After Finalization

After an entity is finalized (experiment completed, model promoted, artifact written), the record must not change.

```typescript
registry.complete(id, metrics)  // Object.freeze() internally
registry.get(id)                // Returns frozen object
```

No mutation methods on finalized entities. No `update()` on completed experiments. No overwriting promotion history.

**Rationale:** Scientific reproducibility requires immutable records. Changing past results invalidates all downstream analysis.

---

## Invariant 5 — No Reverse Dependencies

Layer dependency must always flow downward:

```
UI / API
    ↓
Services / Orchestrators
    ↓
Registry / Store
    ↓
Engine / Core
    ↓
Math / Utils (leaf)
```

A lower layer must never import from a higher layer. Specifically:

- `lib/` must never import from `app/`
- `lib/` must never import from `services/`
- `pipelines/` must never import from `app/`
- `crons/` must never import from `app/`

**Rationale:** Reverse dependencies create circular imports, make testing impossible, and cause subtle runtime bugs.

---

## Invariant 6 — All Artifacts Must Be Reproducible

Every artifact must contain enough metadata to reproduce it from scratch:

```json
{
  "id": "exp_000001",
  "datasetHash": "sha256:...",
  "datasetVersion": "1.0.0",
  "engineVersion": "1.0.0",
  "configurationHash": "sha256:...",
  "replaySeed": 42
}
```

Given the same inputs (dataset hash + config hash + seed), executing the pipeline must produce identical output.

**Rationale:** Without reproducibility, research results cannot be verified, and model improvements cannot be attributed correctly.

---

## Invariant 7 — All Identifiers Use Centralized Factory

No module may generate its own ID format. All identifiers must use `generateId(prefix)` from `src/lib/registry/identifiers.ts`.

```typescript
import { generateId, ID_PREFIX } from '../registry/identifiers';

const id = generateId(ID_PREFIX.EXPERIMENT);  // "exp_000001"
const id2 = generateId(ID_PREFIX.MODEL);      // "mdl_000001"
```

**Rationale:** Inconsistent ID formats make cross-referencing impossible and break the lineage graph.

---

## Invariant 8 — All Plugins Must Register

Every plugin (market translator, feature, model, odds provider) must go through the appropriate registry:

```typescript
marketRegistry.register(new MyMarketTranslator());
featureStore.register('my-feature', '1.0.0', 'derived', ...);
modelRegistry.register('My Model', '1.0.0', ...);
```

No plugin may be used without registration. No direct instantiation bypassing the registry.

**Rationale:** Unregistered plugins are invisible to the research OS — they can't be benchmarked, versioned, or reproduced.

---

## Invariant 9 — Prediction Must Be Deterministic

Given identical inputs, `ProbabilityEngine.predict()` must always return identical output.

```
matchId + features + config → ProbabilityEngine.predict() → deterministic output
```

No randomness in the prediction path. No date-dependent branching. No environment-dependent behavior.

**Rationale:** Non-deterministic predictions make validation impossible. If the same match produces different probabilities on two runs, you cannot trust either.

---

## Invariant 10 — All Changes After Freeze Require ADR

After Phase 3 architecture freeze, any change to a frozen interface or invariant must go through Architecture Decision Record (ADR).

Process:
1. Write ADR describing the proposed change
2. Document reason, compatibility, migration, impact
3. Review against all invariants
4. Approve or reject

Examples of ADR-worthy changes:
- Changing `ProbabilityEngine.predict()` return type
- Adding a new required field to `ExperimentRecord`
- Modifying the `MarketTranslator` interface
- Changing identifier format
- Relaxing an invariant

**Rationale:** The freeze prevents accidental architecture drift. ADRs ensure every change is deliberate, documented, and reviewed.

---

## Invariant 11 — No Future Information May Influence Prediction (Data Leakage Prevention)

Features and probabilities must only use data available **before kickoff**.

- Closing odds must never influence pre-match predictions
- Match results must never influence replay of the same match
- Settlement data must never appear in training features
- All feature timestamps must be validated against kickoff time

**Rationale:** Data leakage is the most common cause of overconfident but invalid models. Historical features that include future information produce metrics that cannot be replicated in live production.

---

## Invariant 12 — All Randomness Must Be Seeded and Reproducible

Every non-deterministic process must use a stored seed that makes it reproducible.

```
Bootstrap resampling     → requires seed in artifact
Monte Carlo simulation   → requires seed in artifact
Hyperparameter search    → requires seed in artifact
Train/validation split   → requires seed in artifact
```

The seed must be stored in the execution metadata alongside the result.

**Rationale:** Non-seeded randomness produces irreproducible research. Two runs of the same experiment must produce identical results.

---

## Invariant 13 — Every Prediction Must Be Traceable to Source Data (Provenance)

Every prediction must be traceable back to its raw source data.

```
Prediction
    ↓
  ProbabilityEngine output
    ↓
  MatchFeatures
    ↓
  Canonical Dataset
    ↓
  Provider / API / CSV
```

This requires:
- Each prediction artifact stores its dataset hash
- Each dataset stores its provenance (source, fetch time)
- Providers are recorded per fixture

**Rationale:** Without provenance, you cannot determine why a prediction changed when data sources change.

---

## Invariant 14 — Historical Artifacts Are Append-Only

Historical data and results must never be modified or overwritten.

- Experiments cannot be edited after completion
- Replay results cannot be overwritten
- Prediction snapshots cannot be retroactively changed
- Corrections create new artifact versions — they never mutate old ones

**Rationale:** Append-only history ensures auditability. If a model's past predictions can be silently changed, all downstream validation becomes meaningless.

---

## Invariant 15 — Domain Logic Must Never Depend on a Specific Provider

Business logic must always operate on **canonical data**, never on provider-specific formats.

```
API-Football → Normalizer → Canonical Dataset → Domain Logic
```

Not:

```
Domain Logic → API-Football (direct dependency)
```

**Rationale:** Provider-specific dependencies make it impossible to switch data sources without code changes. The canonical layer must absorb all provider differences.

---

## Invariant 16 — Public Interfaces Are Backward Compatible Within the Same Major Version

After architecture freeze, breaking changes to public interfaces require:
1. Major version bump
2. ADR documenting the change
3. Migration path for existing consumers

Breaking changes include:
- Removing or renaming public methods
- Changing method signatures
- Adding required fields to interfaces
- Changing return types

**Rationale:** Backward compatibility ensures that downstream modules (Phase 4, dashboards, APIs) don't break when internal implementations evolve.

---

## Invariant Compliance Checklist

Use this checklist when reviewing any pull request or EPIC completion:

| # | Invariant | Check |
|---|---|---|
| 1 | Single source of truth (ProbabilityEngine) | ☐ |
| 2 | Replay uses ProductionPredictorAdapter | ☐ |
| 3 | Market translators are read-only | ☐ |
| 4 | Registries immutable after finalization | ☐ |
| 5 | No reverse dependencies | ☐ |
| 6 | All artifacts reproducible | ☐ |
| 7 | Centralized identifiers | ☐ |
| 8 | All plugins register | ☐ |
| 9 | Prediction deterministic | ☐ |
| 10 | Freeze changes require ADR | ☐ |
| 11 | No future information in predictions | ☐ |
| 12 | All randomness seeded and reproducible | ☐ |
| 13 | Every prediction traceable to source data | ☐ |
| 14 | Historical artifacts append-only | ☐ |
| 15 | Domain logic provider-independent | ☐ |
| 16 | Public interfaces backward compatible | ☐ |

---

## Violation Protocol

If an invariant is found to be violated:

1. **Stop** — Do not add new features on top of the violation
2. **Document** — File an architecture debt issue
3. **Fix** — Restore the invariant before proceeding
4. **Verify** — Ensure the fix passes tsc, tests, madge
5. **Audit** — Check if downstream code relied on the violation

---

## Appendix: What This Means for Phase 4

Phase 4 modules (Lineage, Query Engine, Scheduler, Plugin SDK, Public API, AI Assistant) are built **on top of** these invariants. They must:

- Consume data through frozen public APIs
- Never bypass registries
- Never modify immutable records
- Never create their own ID formats
- Never introduce non-determinism into the prediction path
- Never depend on internal implementation details

Phase 4 can freely change its own internal implementations — only the contracts with Phase 3 are frozen.