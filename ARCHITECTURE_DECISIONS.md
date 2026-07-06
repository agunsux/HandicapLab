# Architecture Decision Records (ADR) - HandicapLab

This document logs the significant architectural decisions of the HandicapLab quantitative platform.

---

## ADR-001 — Prediction Engine Frozen (Model_v3.5)
- **Status**: Accepted
- **Context**: Need a stable baseline to evaluate market efficiency metrics and avoid regression in model prediction outcomes.
- **Decision**: Freeze core prediction logic, Poisson modeling weights, and feature mapping configurations under version tag `Model_v3.5`.
- **Alternatives Considered**: Continuous retraining of the production model pipeline.
- **Consequences**: Ensures 100% backward compatibility. Any future accuracy improvements are developed in sandbox segments without affecting the live observer metrics.

---

## ADR-002 — Event-Driven Paper Trading
- **Status**: Accepted
- **Context**: Transitioning from batch simulation to real-world continuous recommendation logging.
- **Decision**: Implement a lightweight event broker queue processing immutable `fixture.created` and `match.finished` jobs with built-in retry mechanics.
- **Alternatives Considered**: Synchronous database triggers.
- **Consequences**: High availability, crash recovery, and decoupled prediction orchestration.

---

## ADR-003 — Immutable Snapshot Locker
- **Status**: Accepted
- **Context**: Preventing pre-match predictions and odds from being altered after kickoff.
- **Decision**: Create a `SnapshotLocker` module that locks snapshot records by matchId on creation, raising errors if modifications are attempted.
- **Alternatives Considered**: Database table edit locks.
- **Consequences**: Strict mathematical and statistical integrity for model validation.

---

## ADR-004 — CLV as Observation Layer
- **Status**: Accepted
- **Context**: Estimating model edge relative to bookmaker movements.
- **Decision**: Put all Closing Line Value (CLV) and line tracking elements in a distinct observation namespace completely isolated from prediction inputs.
- **Alternatives Considered**: Feeding CLV directly back into the feature assembler.
- **Consequences**: Eliminates future data leakage risks.

---

## ADR-005 — Provider Abstraction
- **Status**: Accepted
- **Context**: Support live odds updates from Pinnacle, SBO, Bet365, Orbit, etc.
- **Decision**: Define a generic `MarketDataProvider` interface for plug-and-play provider adapters.
- **Alternatives Considered**: Direct mapping of SBO API contracts in route endpoints.
- **Consequences**: New books can be easily onboarded.

---

## ADR-006 — Release SOP v1
- **Status**: Accepted
- **Context**: Enforcing thorough audits prior to production push.
- **Decision**: Adopt a strict release lifecycle (Implement -> Tests -> Backtests -> Benchmarks -> Release Report -> Git Tag -> Deploy -> Smoke Test).
- **Alternatives Considered**: Fast-lane pushes directly from pull requests.
- **Consequences**: High structural stability, regression safety, and auditing transparency.
