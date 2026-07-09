# ADR-002: Pipeline Execution Engine (not State Machine)

**Date**: 2026-07-10
**Status**: Accepted

## Context

HandicapLab's prediction pipeline has multiple steps: feature engineering, prediction generation, opening odds capture, periodic odds tracking, closing odds capture, settlement, CLV computation, and ledger write. Each step has dependencies on prior steps.

We needed a coordination layer that ensures:
1. Steps execute in the correct order
2. No step can be skipped
3. Failed steps are detected and recoverable
4. The entire pipeline is observable and auditable
5. Replay is possible for backtesting

## Decision

We chose to build a **Pipeline Execution Engine** rather than a simple Finite State Machine (FSM).

### Why not a simple FSM?

A pure FSM would only model state-to-state transitions. It would:
- Not validate preconditions before transitions
- Not validate postconditions after transitions
- Not enforce invariants per state
- Not handle recovery strategies
- Not support replay mode
- Not produce observability metrics

### What the Execution Engine provides

The engine implements an 11-step execution flow for every transition:

```
1. Get current state       → Read from DB (defaults to CREATED)
2. Transition guard        → Check NEVER_ALLOWED + backward transition rules
3. Find transition def     → Lookup in TRANSITION_MAP
4. Validate reason         → Only allowed reasons per transition
5. Validate preconditions  → From Reliability Contract
6. Execute step            → Delegated (LIVE or REPLAY mode)
7. Validate postconditions → From Reliability Contract
8. Validate invariants     → DB-level consistency checks per state
9. Persist event           → pipeline_events table (event sourcing)
10. Update fixture state   → matches.pipeline_state + version
11. Emit metrics           → For Prometheus/OpenTelemetry
```

### State Definitions

```
CREATED → FEATURES_READY → PREDICTED → OPENING_CAPTURED → TRACKING
→ CLOSING_CAPTURED → SETTLED → CLV_READY → LEDGER_WRITTEN → ARCHIVED
```

### Why replay uses the same engine

The engine accepts `mode: 'LIVE' | 'REPLAY'`. In REPLAY mode:
- The same transition flow executes
- Pre/postcondition validation still runs
- Events are still persisted (for audit)
- The step execution function logs without producing side effects

This ensures replay determinism without maintaining a separate pipeline.

## Event Sourcing (Lightweight)

Every transition produces an event in `pipeline_events`:
```sql
(fixture_id, step, previous_state, new_state, event, reason,
 timestamp, duration_ms, mode, version, success, metadata)
```

This is lightweight event sourcing — not full CQRS/ES — but sufficient for:
- Debugging (full transition history per fixture)
- Latency tracking (avg/p50/p99 per step)
- Health monitoring (success/failure per step)
- Audit trails

## Invariant Philosophy

Each state has a set of **invariants** that must hold. These are DB-backed checks:
- `PREDICTED` → prediction must exist, model version recorded
- `CLOSING_CAPTURED` → closing_odds must exist, opening odds for movement calc
- `LEDGER_WRITTEN` → ledger entry with chain hash, prediction exists, CLV exists

Invariants do not block transitions (postconditions do), but they produce warnings
so the dashboard can flag inconsistencies.

## Idempotency Strategy

Three schemes used across steps:

1. **Idempotency Key** (prediction, settlement, ledger): Key on `fixture_id + version`
   → Ensures exactly-once semantics
2. **Upsert** (capture_closing): Key on `match_id + market_type + phase + provider`
   → Latest capture always wins
3. **Dedup Window** (capture_opening): 24h window on `fixture_id + market_type`
   → Only one opening capture per fixture per day

## Recovery Strategy

| Failure Type | Recovery | Detail |
|---|---|---|
| Prediction | Manual | Blocking step, cannot proceed without manual fix |
| Opening capture | DLQ | Non-blocking, retried by cron |
| Closing capture | DLQ | Non-blocking, retried at next phase |
| Settlement | Manual | Blocking step |
| CLV | DLQ | Non-blocking, recomputed by `recomputeCLV()` |
| Ledger | Manual | Blocking step |

## Known Trade-offs

1. **Performance**: The engine runs all 11 steps synchronously per transition.
   For a pipeline handling thousands of fixtures, this introduces sequential delay.
   Mitigation: CaptureEngine runs phases in parallel per match; only state transitions
   are sequential per fixture.

2. **DB Dependency**: Every transition reads/writes DB. If DB is unavailable,
   the engine returns graceful errors with full context (no crashes).

3. **No Distributed Transactions**: If a transition succeeds but the state update
   fails, the system will retry via the next cron run. The event log contains
   the successful transition for debugging.

4. **Mock Step Execution**: In the current implementation, `executeStep()` generates
   synthetic output fields to satisfy postconditions. Production deployment requires
   wiring actual business logic into each step handler.

## Consequences

1. Migration `0005_pipeline_execution_engine.sql` adds columns to `matches` and creates `pipeline_events` table
2. All fixture state changes must go through `PipelineExecutionEngine.executeTransition()`
3. Future steps (e.g., notification, webhook) can be added by defining contracts and transitions
4. Shadow Replay can use the same engine with `mode='REPLAY'`