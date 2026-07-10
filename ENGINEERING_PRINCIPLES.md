# HandicapLab — Engineering Principles

**Type:** Implementation Standards  
**Status:** Active  
**Last Updated:** 2026-07-10  

---

## Purpose

This document defines the **day-to-day implementation standards** that every module must follow. Unlike `ARCHITECTURE_INVARIANTS.md` (which describes what must never change architecturally), this document describes **how code should be written**.

These principles ensure consistency across 50+ modules contributed by different engineers over time.

---

## Principle 1 — Every Module Has Unit Tests

- Every source file in `src/lib/` must have corresponding tests
- Tests must cover: happy path, error cases, edge cases
- Tests must be deterministic (no flaky tests)
- Minimum bar: all existing tests must pass before submission

**Rationale:** Untested code is technical debt. Module-level tests catch regressions before they reach integration.

---

## Principle 2 — Every Public API Has Contract Tests

- Public interfaces (`MarketTranslator`, `Predictor`, `FeaturePlugin`) must have contract tests
- Contract tests verify that implementations conform to the interface contract
- Contract tests run against every implementation of the interface

**Rationale:** Interface contracts define the architecture freeze. Contract tests ensure no implementation silently violates the contract.

---

## Principle 3 — No `any` Types

```typescript
// ❌ Wrong
function process(data: any): any { ... }

// ✅ Correct
function process(data: Record<string, unknown>): string { ... }
```

- Use `unknown` instead of `any` when the type is truly dynamic
- Use specific interfaces for domain objects
- Use generics for reusable utilities
- `any` is only allowed in tests for mock data

**Rationale:** `any` disables TypeScript's type checking. Every `any` is a potential runtime bug that the compiler cannot catch.

---

## Principle 4 — No Hidden Singletons

```typescript
// ❌ Wrong — global mutable state
export const cache = new Map<string, Result>();

// ✅ Correct — dependency injection
export class CacheService {
  constructor(private store: Map<string, Result>) {}
}
```

- All dependencies must be injectable
- No module-level mutable state
- Registry singletons (`experimentRegistry`, `modelRegistry`) are the only exceptions

**Rationale:** Hidden singletons make testing impossible (state leaks between tests) and cause subtle concurrency bugs.

---

## Principle 5 — All Logs Are Structured

```typescript
// ❌ Wrong
console.log('Prediction failed:', err);

// ✅ Correct
logger.error('prediction_failed', 'Prediction could not be generated', err, { matchId });
```

- Use `StructuredLogger` from `lib/observability`
- Every log has: severity, event name, message, context metadata, optional error
- Never use `console.log` in production code

**Rationale:** Unstructured logs cannot be queried, filtered, or alerted on. Structured JSON logs enable full observability.

---

## Principle 6 — All Errors Are Typed

```typescript
// ❌ Wrong
throw new Error('Database connection failed');

// ✅ Correct
throw new DatabaseError('Connection failed', { table: 'predictions' });
```

- Use typed errors from `lib/observability/errors`
- Every error has: code, severity, retryable flag, user-safe message, internal message, context

**Rationale:** Typed errors enable automated error handling (retry vs fail fast vs alert) and make debugging faster.

---

## Principle 7 — All Dependencies Are Injected

```typescript
// ❌ Wrong — hardcoded dependency
class ExperimentRunner {
  private registry = new ExperimentRegistry();
}

// ✅ Correct
class ExperimentRunner {
  constructor(private readonly registry: ExperimentRegistry) {}
}
```

- Constructor injection for all services
- No `new` inside business logic classes
- Factory pattern for complex object creation

**Rationale:** Hardcoded dependencies make unit testing impossible (cannot substitute mocks) and violate the Single Responsibility Principle.

---

## Principle 8 — All Plugins Have Metadata and Version

```typescript
// Every plugin must expose:
interface MyFeaturePlugin implements FeaturePlugin {
  readonly name: string;        // "expected-goals"
  readonly version: string;     // "1.0.0"
  readonly description: string;
  readonly dependencies: string[];
}
```

No plugin may exist without metadata and version.

**Rationale:** Untracked plugins cannot be benchmarked, compared, or reproduced. Version metadata enables the experiment lineage graph.

---

## Principle 9 — No Global Mutable State in Tests

```typescript
// ❌ Wrong — test mutates global state
beforeEach(() => {
  experimentRegistry.create(...);  // mutates global singleton
});

// ✅ Correct — local registry per test
const registry = new ExperimentRegistry();
```

Always create fresh instances in tests. Never depend on global singletons between tests.

**Rationale:** Tests that share state through singletons are order-dependent and flaky. A test that passes in isolation may fail when run in a suite.

---

## Principle 10 — Modules Are Self-Contained

Each module should be understandable without reading other modules:

- One clear responsibility
- Well-defined public API (index.ts barrel export)
- Internal implementation details are NOT exported
- No circular dependencies with other modules

**Rationale:** Self-contained modules can be developed, tested, and maintained independently. Low coupling is the foundation of scalable architecture.

---

## Principle 11 — Functions Are Pure Where Possible

```typescript
// ❌ Wrong — side effects make testing hard
function computeMetrics(data: Input): Metrics {
  saveToDatabase(data);
  return transform(data);
}

// ✅ Correct — pure computation
function computeMetrics(data: Input): Metrics {
  return transform(data);
}
```

- Pure functions (no side effects, same input → same output) are preferred
- Side effects should be isolated at the boundary layer
- I/O should never mix with business logic

**Rationale:** Pure functions are trivial to test, parallelize, and reason about. Side effects make all three significantly harder.

---

## Principle 12 — Feature Toggles Over Branching

- New features should be behind feature flags, not long-lived branches
- Feature flags must be configurable at runtime
- Dead feature flags must be cleaned up when the feature is stable

**Rationale:** Long-lived branches diverge and create merge hell. Feature flags enable continuous deployment with controlled rollout.

---

## Compliance Checklist

Use this when reviewing any module implementation:

| # | Principle | Check |
|---|---|---|
| 1 | Unit tests exist | ☐ |
| 2 | Public API contract tests exist | ☐ |
| 3 | No `any` types | ☐ |
| 4 | No hidden singletons | ☐ |
| 5 | Structured logging | ☐ |
| 6 | Typed errors | ☐ |
| 7 | Dependency injection | ☐ |
| 8 | Plugin metadata + version | ☐ |
| 9 | No global mutable state in tests | ☐ |
| 10 | Self-contained module | ☐ |
| 11 | Pure functions where possible | ☐ |
| 12 | Feature flags for new features | ☐ |