# HandicapLab Observability Architecture

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                         │
│  API Routes │ Cron Jobs │ Pipelines │ Workers               │
└────────────────────┬────────────────────────────────────────┘
                     │ logs │ metrics │ traces │ errors
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   OBSERVABILITY MODULE                       │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌───────────────┐    │
│  │ Logger   │ │ Metrics  │ │ Timer  │ │ PipelineTrace  │    │
│  │ (JSON)   │ │(counter/ │ │(ms)    │ │(stage events)  │    │
│  │          │ │ histo)   │ │        │ │               │    │
│  └──────────┘ └──────────┘ └────────┘ └───────────────┘    │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌───────────────┐    │
│  │ Errors   │ │ Health   │ │ Correl │ │ Diagnostics   │    │
│  │(taxonomy)│ │(subsys)  │ │(IDs)   │ │(slow ops)     │    │
│  └──────────┘ └──────────┘ └────────┘ └───────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### Request Flow
```
HTTP Request
  │
  ├─ Generate Correlation IDs (correlation.ts)
  ├─ Start Timer (timing.ts)
  ├─ Increment API counter (metrics.ts)
  │
  ├─ [Business Logic]
  │   ├─ Log stages (structuredLogger.ts)
  │   ├─ Trace pipeline (pipelineTrace.ts)
  │   └─ Catch errors (errors.ts)
  │
  └─ End Timer
  └─ Log completion
```

### Cron Flow
```
Cron Trigger
  │
  ├─ Create CronCorrelationIds
  ├─ Start Timer
  ├─ Increment Cron counter
  │
  ├─ [Execute Job]
  │   ├─ Pipeline Trace each stage
  │   └─ Record diagnostics
  │
  ├─ Audit log (auditLog.ts)
  └─ End Timer
  └─ Record success/failure
```

## Module Responsibilities

| Module | Responsibility |
|---|---|
| `structuredLogger.ts` | JSON log output with context |
| `correlation.ts` | ID generation and propagation |
| `timing.ts` | Duration measurement |
| `errors.ts` | Typed error hierarchy |
| `metrics.ts` | Counter/histogram/gauge registry |
| `health.ts` | Subsystem health checks |
| `pipelineTrace.ts` | Pipeline stage event tracing |
| `auditLog.ts` | Immutable audit trail |
| `diagnostics.ts` | Slow operation detection |

## Future: OpenTelemetry Integration

The architecture supports wrapping all observability into OpenTelemetry spans:

```typescript
// Future interface
export interface TraceProvider {
  startSpan(name: string, context?: CorrelationIds): Span;
}

// Current Timer class can be adapted as a Span