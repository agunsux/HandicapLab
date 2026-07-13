# EPIC 24.8 — Domain Intelligence Platform: Architecture Report

**Date:** 2026-07-13  
**Status:** ✅ Initial Implementation Complete  
**Tag:** v1.6.0-domain-intelligence

---

## Overview

The Domain Intelligence Platform implements a first-class Domain-Driven Design (DDD) layer for HandicapLab. It defines the canonical language of the entire repository, providing entities, events, aggregates, value objects, domain graph, policies, and registry for all 28 domains.

---

## File Count

| Category | Files | Lines |
|----------|-------|-------|
| Shared Kernel | 10 | ~400 |
| Domain Entities | 28 | ~2,500 |
| Domain Events | 15 | ~450 |
| Aggregates | 5 | ~350 |
| Domain Graph | 2 | ~250 |
| Domain Policies | 2 | ~150 |
| Domain Registry | 2 | ~120 |
| Main Index | 1 | ~10 |
| Tests | 7 | ~400 |
| **Total** | **72** | **~4,630** |

---

## Domain Map (28 Domains)

```
Competition ──has──► Season ──has──► League ──contains──► Fixture
  │                                                         │
  │                                                         ├──has──► Odds
  │                                                         ├──has──► Prediction
  │                                                         ├──produces──► Result
  │                                                         └──played_at──► Venue
  └──has──► Team ──has──► Player

Prediction ──triggers──► Decision ──produces──► Stake ──belongs_to──► Portfolio
  │                                                                            │
  ├──validated_by──► Calibration                                                ├──belongs_to──► Risk
  └──measured_by──► Performance ◄──summarizes── Report
                               ▲
Replay ──produces──► Evidence ──feeds_into──► Report

Experiment ──tests──► Model ──generates──► Prediction
                          │
                          ├──trains──► Feature ◄──calculates_for── Fixture
                          ├──has──► Calibration
                          ├──has──► Performance
                          └──affected_by──► Drift

Provider ──provides──► Odds
Market ──classifies──► Odds
Policy ──governs──► Decision
Probability ──feeds──► Prediction
Research ──produces──► Evidence
```

---

## Aggregate Map (4 Aggregates)

| Aggregate | Root Entity | Invariants |
|-----------|-------------|------------|
| FixtureAggregate | Fixture | Cannot finish if not started, Cannot start if cancelled |
| PredictionAggregate | Prediction | Cannot settle unscheduled prediction, Cannot regenerate settled prediction |
| DecisionAggregate | Decision | Cannot execute rejected decision, Cannot approve without evaluation |
| PortfolioAggregate | Portfolio | Cannot exceed risk limit, Cannot allocate more than balance |

### FixtureAggregate State Machine
```
SCHEDULED ──startMatch──► LIVE ──finish──► FINISHED
    │                       │
    ├──postpone──► POSTPONED├──postpone──► POSTPONED
    └──cancel────► CANCELLED└──cancel────► CANCELLED
                                            ▲
                                    POSTPONED──cancel──┘
```

### PredictionAggregate State Machine
```
PENDING ──generate──► GENERATED ──settle──► SETTLED
                               └──invalidate──► INVALIDATED
```

### DecisionAggregate State Machine
```
PENDING ──evaluate──► EVALUATED ──approve──► APPROVED ──execute──► EXECUTED
                                  └──reject────► REJECTED
```

---

## Event Catalog (13 Events)

| Event | Trigger | Payload |
|-------|---------|---------|
| FixtureCreated | Fixture scheduled | fixtureId, homeTeamId, awayTeamId, kickoffTime, leagueId |
| FixtureUpdated | Fixture state change | fixtureId, changes |
| OddsCaptured | New odds snapshot | fixtureId, providerId, marketType, line |
| PredictionGenerated | Model predicts | fixtureId, modelId, homeProb, awayProb, drawProb, confidence |
| CalibrationCompleted | Model calibrated | modelId, datasetId, ece, brierScore |
| DecisionApproved | Decision approved | fixtureId, predictionId, decision, expectedValue, edge |
| StakeCalculated | Stake computed | decisionId, amount, currency, stakeType, odds |
| ResultCollected | Match result in | fixtureId, homeScore, awayScore, winner |
| ReplayCompleted | Replay finished | datasetId, fixtureCount, successCount, failureCount |
| ResearchFinished | Study complete | researchId, conclusion, keyFindings |
| DriftDetected | Drift identified | modelId, driftType, metric, deviation, severity |
| ChampionValidated | Model validated | modelId, challengerId, brierImproved, eceImproved |
| ReportGenerated | Report created | reportType, period |

---

## Shared Kernel (Value Objects)

| Value Object | Description |
|-------------|-------------|
| Identifier | Canonical ID generation with prefix-based sequences |
| Money | Immutable monetary value with currency |
| Percentage | Value in [0,1] range with arithmetic |
| Probability | Value in [0,1] with odds conversion |
| Timestamp | ISO 8601 timestamp wrapper |
| Version | Semantic versioning |
| Metadata | Immutable key-value container |
| Confidence | Score [0,1] with levels |
| Severity | Enum with ordering (LOW→EMERGENCY) |
| QualityScore | Score [0,100] with labels |

---

## Dependency Graph

The DomainGraph class pre-populates 28 nodes and 33 edges representing all meaningful relationships between domains.

**Methods:**
- `getPath(from, to)` — BFS pathfinding between domains
- `findCycles()` — Cycle detection (validated: 0 cycles)
- `toTopologicalOrder()` — BFS topological sort
- `getSubgraph(category)` — Subgraph extraction
- `detectOrphans()` — Orphan detection (validated: 0 orphans)

---

## Policies

| Policy | Description |
|--------|-------------|
| NamingPolicy | PascalCase entities, camelCase methods, UPPER_CASE constants |
| ImmutabilityPolicy | Object.freeze enforcement |
| ValidationPolicy | Required, range, string, array validation |
| StateTransitionPolicy | Valid state transition verification |
| VersionCompatibilityPolicy | Major version compatibility |
| ConsistencyPolicy | Event consistency invariants |

---

## Backward Compatibility

All existing modules remain untouched. The domain layer is fully additive:

- ✅ No existing modules modified
- ✅ No existing logic refactored
- ✅ All existing interfaces unchanged
- ✅ Domain layer is purely additive at `src/lib/domain/`
- ✅ Existing registries still work independently

---

## Next Steps

1. **Fix TypeScript strict mode errors** in generated files (implicit `any` types, optional parameter ordering, DTO `id` field consistency)
2. **Connect domain layer to existing modules** via adapter patterns
3. **Add domain validation** to existing pipeline entry points
4. **Expand test coverage** for all edge cases
5. **Integrate DomainEventBus** into existing operation pipeline