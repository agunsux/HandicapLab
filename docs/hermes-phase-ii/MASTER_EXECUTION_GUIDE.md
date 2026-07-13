# Operation HERMES Phase II — Master Execution Guide

**Codename:** HERMES II  
**Mission:** Build the Operational Intelligence Layer that connects HandicapLab's Research Layer to Production Operations  
**Status:** 🚀 Planning Phase  
**Target Completion:** Q4 2026  

---

## Architecture Overview

```
Research Layer (DONE)
─────────────────────────────────────────────────
Historical Evidence | Replay | Baseline | Probability
Feature | Decision | Shadow Research
    │
    ▼
Operational Intelligence Layer (NEXT)
─────────────────────────────────────────────────
┌─────────────────────────────────────────────┐
│  EPIC 22 — Live Data Intelligence Platform   │
│  (Provider Abstraction, Canonical Data,      │
│   Quality Scoring, Raw Archival, Registry)   │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│  EPIC 23 — Operations Intelligence Platform  │
│  (Scheduler, Queue, Worker Pool, Retry,     │
│   Alert, Notification, Audit, Metrics)      │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│  EPIC 24 — Production Intelligence Platform  │
│  (Observability, Dashboards, Drift,         │
│   Structured Logging, Tracing, Reports)     │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│ EPIC 24.5 — Platform Reliability & SRE       │
│  (Config, Secrets, Feature Flags, SLI/SLO,  │
│   DR, Backup, Capacity, Security)           │
└─────────────────────────────────────────────┘
    │
    ▼
Commercial Layer (NEXT)
─────────────────────────────────────────────────
Pricing Tiers | User Management | API Gateway | Billing
```

---

## Execution Strategy

### Principle: Build, Validate, Then Scale

Each EPIC must be:
1. **Implemented** — All modules built and unit tested
2. **Deployed** — Running in production environment
3. **Validated** — Shadow mode confirmation of correctness
4. **Stabilized** — Observing behavior before proceeding

### Recommended Sequence

```
Phase II-A: Data Foundation (Weeks 1–4)
├── EPIC 22 — Live Data Intelligence Platform
├── Deploy & Test Shadow Mode with Live Data
└── Validate: All providers flow through abstraction layer

Phase II-B: Operations Automation (Weeks 5–8)
├── EPIC 23 — Operations Intelligence Platform
├── Deploy & Observe Workers, Scheduler, Queue
└── Validate: Full pipeline runs without manual intervention

Phase II-C: Observability & Control (Weeks 9–12)
├── EPIC 24 — Production Intelligence Platform
├── EPIC 24.5 — Platform Reliability & SRE
├── Deploy Dashboards & Alerting
└── Validate: Single-dashboard platform health visibility

Phase II-D: Shadow Mode Validation (Weeks 13–20)
├── 4–8 Weeks of Shadow Mode Operation
├── Collect Operational Evidence
└── Gate Decision: Proceed to Commercial Layer
```

### Critical Gate Criteria

| Gate | Criteria | Evidence Required |
|------|----------|-------------------|
| **Gate 1** | EPIC 22 Complete | All providers go through adapter layer, canonical data flows, quality scoring active |
| **Gate 2** | EPIC 23 Complete | Full pipeline automation, zero manual steps for 48 hours |
| **Gate 3** | EPIC 24 Complete | All dashboards display real-time data, alerts fire correctly |
| **Gate 4** | EPIC 24.5 Complete | DR tested, SLI/SLO defined, runbooks documented |
| **Gate 5** | Shadow Mode Pass | 4+ weeks continuous operation, zero critical incidents, metrics stable |

---

## Dependency Map

```
EPIC 22 (Provider Layer) → No dependencies on other EPICs
    │
    ▼
EPIC 23 (Operations)    → Depends on EPIC 22 for data sources
    │
    ▼
EPIC 24 (Observability) → Depends on EPIC 22 + EPIC 23 for metrics
    │
    ▼
EPIC 24.5 (SRE)         → Depends on all above for SLI baselines
```

---

## Architecture Invariants (Additions to Project Constitution)

These invariants extend the existing [Architecture Invariants](../ARCHITECTURE_INVARIANTS.md):

### Invariant O1 — Single Provider Access Point
No module outside EPIC 22 may directly access any external data provider. All external data access must go through the Provider Abstraction Layer.

### Invariant O2 — Immutable Raw Payloads
All raw provider responses must be archived verbatim before any transformation. No transformation may overwrite the original payload.

### Invariant O3 — Canonical Data is the Single Source of Truth
All business logic must consume canonical data. Provider-specific formats are never consumed outside the adapter layer.

### Invariant O4 — Every Job Has a Lifecycle
Every scheduled or triggered job must have: status, retry count, execution time, dependency tracking, and immutable execution log.

### Invariant O5 — Observability is Not Optional
Every module must emit structured logs, metrics, and traces. No module may be deployed without observability instrumentation.

### Invariant O6 — Configuration is Externalized
No hardcoded configuration in code. All configuration must come from environment variables, config files, or configuration management.

---

## Cross-Cutting Concerns

### Security
- Secrets via environment variables or Secret Management (EPIC 24.5)
- API keys stored in secure config, never in code
- Provider credentials rotated regularly

### Performance
| Area | Target |
|------|--------|
| Provider response → canonical | < 500ms p95 |
| Odds merge + dedup | < 200ms per fixture |
| Schedule dispatch latency | < 1s |
| Queue throughput | > 1000 jobs/minute |
| Dashboard load time | < 2s |
| Alert delivery | < 30s from trigger |

### Data Retention
- Raw provider payloads: 90 days
- Canonical data: indefinite
- Metrics: 13 months
- Logs (structured): 30 days
- Audit trail: indefinite

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Provider API changes break adapter | High | Medium | Adapter pattern isolates changes; test harness catches breaks |
| Queue backlog causes data gaps | High | Medium | Dead letter queue, alert on backlog threshold, auto-scaling workers |
| Shadow mode reveals calibration drift | Medium | Medium | Drift detection in EPIC 24; auto-alert before degradation |
| Resource exhaustion under load | High | Low | Resource monitoring, capacity planning, auto-scaling |
| Data quality issues cascade | High | Low | Quality scoring prevents bad data from entering pipeline |

---

## Documentation Structure

```
docs/hermes-phase-ii/
├── MASTER_EXECUTION_GUIDE.md                    ← This file
├── EPIC_22_LIVE_DATA_INTELLIGENCE.md            ← Provider abstraction
├── EPIC_23_OPERATIONS_INTELLIGENCE.md           ← Automation layer
├── EPIC_24_PRODUCTION_INTELLIGENCE.md           ← Observability layer
├── EPIC_24_5_PLATFORM_RELIABILITY_SRE.md        ← SRE foundation
└── SHADOW_MODE_OPERATIONS.md                    ← Shadow mode guide
```

---

## Definition of Done (Each EPIC)

An EPIC is complete only when ALL of the following pass:

1. ✅ `npx tsc --noEmit` — zero TypeScript errors
2. ✅ `npx vitest run` — all unit + integration tests pass
3. ✅ `npx madge --circular` — zero circular dependencies
4. ✅ Architecture invariants preserved (no regressions)
5. ✅ Public API documented
6. ✅ ADR updated for architectural changes
7. ✅ Benchmark before/after — no performance regressions
8. ✅ All artifacts reproducible from configuration
9. ✅ Verification report generated
10. ✅ Shadow mode validated (where applicable)

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| EPIC 22: Provider failover time | < 5s | Health check timing |
| EPIC 23: Pipeline automation rate | 100% | Manual steps per week = 0 |
| EPIC 24: Dashboard data latency | < 30s | End-to-end timing |
| EPIC 24.5: Platform uptime | 99.9% | Uptime monitoring |
| Overall: Shadow mode runtime | 4+ weeks | Continuous operation |
| Overall: Critical incidents | 0 | Incident log |

---

## Rollback Plan

If any EPIC causes production instability:

1. **Immediate**: Revert to last known good state via Git
2. **Assessment**: Root cause analysis within 24 hours
3. **Fix**: Implement corrective measures
4. **Re-deploy**: With additional validation gates
5. **Verify**: Shadow mode confirmation before full activation

---

## Sign-off Checklist

Before proceeding to Commercial Layer:

- [ ] EPIC 22 — Live Data Intelligence: ✅ Operational for 4+ weeks
- [ ] EPIC 23 — Operations Intelligence: ✅ Automated for 4+ weeks
- [ ] EPIC 24 — Production Intelligence: ✅ Dashboard live 24/7
- [ ] EPIC 24.5 — Platform Reliability & SRE: ✅ Runbooks tested
- [ ] Shadow Mode: ✅ 4+ weeks continuous operation
- [ ] Incident Response: ✅ Documented and tested
- [ ] DR Test: ✅ Successfully executed
- [ ] Performance Benchmarks: ✅ All targets met
- [ ] Architecture Audit: ✅ No invariant violations
- [ ] Stakeholder Review: ✅ Approved