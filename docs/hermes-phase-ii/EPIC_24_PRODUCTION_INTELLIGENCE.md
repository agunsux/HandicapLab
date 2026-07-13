# EPIC 24 — Production Intelligence Platform

**Category:** Operational Intelligence Layer  
**Dependencies:** EPIC 22 (Data Layer) + EPIC 23 (Operations Layer)  
**Target Completion:** Phase II-C (Weeks 9–12)  
**Critical Path:** Single-dashboard observability for the entire platform  
**Codename:** HERMES-24

---

## Mission Statement

Build the "control tower" of HandicapLab — a comprehensive observability platform that provides real-time visibility into every aspect of the system. From provider health to model calibration, from queue depth to CLV degradation, every metric is collected, visualized, and alerted.

**Target outcome:** Any operator can understand the full state of the platform by looking at a single dashboard. Incidents are detected before they impact users. Trends are visible before they become problems.

---

## Architecture

```
EPIC 22 Metrics ──┐
EPIC 23 Metrics ──┤
System Metrics ───┤
Model Metrics ────┤
Database Metrics ─┤
Cache Metrics ────┤
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                 Production Intelligence Platform              │
│                                                               │
│  ┌─────────────────────┐    ┌─────────────────────────────┐  │
│  │  Metrics Registry    │    │    Structured Logging       │  │
│  │  - Metric definition │    │  - Structured JSON format   │  │
│  │  - Dimensional tags  │    │  - Correlation IDs          │  │
│  │  - Aggregation rules │    │  - Log levels               │  │
│  │  - Retention policy  │    │  - Search & filter          │  │
│  └─────────┬───────────┘    └─────────────┬───────────────┘  │
│            │                              │                   │
│            ▼                              ▼                   │
│  ┌─────────────────────┐    ┌─────────────────────────────┐  │
│  │  Distributed Tracing │    │      Event Timeline          │  │
│  │  - Trace context     │    │  - System events            │  │
│  │  - Span collection   │    │  - Incident events          │  │
│  │  - Parent/child      │    │  - Deployment events         │  │
│  │  - Latency breakdown │    │  - Timeline visualization   │  │
│  └─────────┬───────────┘    └─────────────┬───────────────┘  │
│            │                              │                   │
│            ▼                              ▼                   │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    Dashboards (16)                       │ │
│  │                                                          │ │
│  │  System Health    │  Prediction Health  │  Provider      │ │
│  │  Queue            │  Database           │  Cache         │ │
│  │  Scheduler        │  Worker             │  Error         │ │
│  │  Drift            │  CLV                │  ROI           │ │
│  │  Research         │  Model              │  Decision      │ │
│  │  Feature          │  ──────────────────  │                │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌─────────────────────┐    ┌─────────────────────────────┐  │
│  │     Alert System    │    │     Operational Reports      │  │
│  │  - Provider Down    │    │  - Daily / Weekly / Monthly  │  │
│  │  - Calibration Drift│    │  - Auto-generated            │  │
│  │  - ROI Collapse     │    │  - Metric summaries          │  │
│  │  - CLV Degradation  │    │  - Trend analysis            │  │
│  └─────────────────────┘    └─────────────────────────────┘  │
│                                                               │
│  ┌─────────────────────┐    ┌─────────────────────────────┐  │
│  │  Performance Timeline│    │    Resource Timeline        │  │
│  │  - CPU/Memory/Disk   │    │  - Capacity trends          │  │
│  │  - Throughput graph  │    │  - Usage patterns           │  │
│  │  - Latency heatmap   │    │  - Forecast                 │  │
│  └─────────────────────┘    └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
Alert Channels (EPIC 23) → Slack, Email, PagerDuty
```

---

## Detailed Module Specifications

### 1. Structured Logging

**Purpose:** Every module emits structured JSON logs with consistent fields. Enables search, filtering, correlation, and analytics.

```typescript
interface ILogger {
  debug(message: string, meta?: LogMeta): void;
  info(message: string, meta?: LogMeta): void;
  warn(message: string, meta?: LogMeta): void;
  error(message: string, error?: Error, meta?: LogMeta): void;
  fatal(message: string, error?: Error, meta?: LogMeta): void;
  child(meta: Partial<LogMeta>): ILogger;  // Create child logger with inherited fields
  flush(): Promise<void>;
}

interface LogMeta {
  correlationId?: string;
  component?: string;
  module?: string;
  operation?: string;
  durationMs?: number;
  status?: string;
  recordId?: string;
  provider?: string;
  jobId?: string;
  workerId?: string;
  userId?: string;
  tags?: string[];
  [key: string]: unknown;               // Extensible
}

interface LogEntry {
  timestamp: string;                     // ISO 8601 with timezone
  level: LogLevel;                       // DEBUG, INFO, WARN, ERROR, FATAL
  message: string;
  meta: LogMeta;
  error?: {
    name: string;
    message: string;
    stack: string;
    cause?: string;
  };
  environment: string;
  service: string;
  version: string;
  host: string;
}

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

interface LogQuery {
  timeRange: TimeRange;
  levels?: LogLevel[];
  components?: string[];
  correlationId?: string;
  search?: string;                       // Full-text search in message
  limit?: number;
  offset?: number;
  sortOrder?: 'asc' | 'desc';
}
```

**Log Format (JSON):**
```json
{
  "timestamp": "2026-07-13T15:30:00.123Z",
  "level": "INFO",
  "message": "Odds sync completed for EPL",
  "meta": {
    "correlationId": "corr_abc123",
    "component": "provider",
    "module": "odds-sync",
    "operation": "syncFixtures",
    "durationMs": 2345,
    "status": "success",
    "provider": "api-football",
    "league": "EPL",
    "fixturesProcessed": 10
  },
  "environment": "production",
  "service": "handicaplab",
  "version": "1.22.0",
  "host": "worker-3"
}
```

### 2. Metrics Registry

**Purpose:** Central registry of all metrics. Defines metric names, types, tags, aggregation rules, and retention.

```typescript
interface IMetricsRegistry {
  registerMetric(definition: MetricDefinition): void;
  counter(name: string, value?: number, tags?: MetricTags): void;
  gauge(name: string, value: number, tags?: MetricTags): void;
  histogram(name: string, value: number, tags?: MetricTags): void;
  timing(name: string, durationMs: number, tags?: MetricTags): void;
  getMetric(name: string, tags?: MetricTags): Promise<MetricValue>;
  query(query: MetricQuery): Promise<MetricDataPoint[]>;
  getDefinitions(): MetricDefinition[];
}

interface MetricDefinition {
  name: string;
  type: MetricType;                      // COUNTER, GAUGE, HISTOGRAM, TIMING
  description: string;
  unit: string;                          // "count", "ms", "percent", "bytes", "rate"
  tags: string[];                        // Allowed tag keys
  aggregation: AggregationType;          // SUM, AVG, P50, P95, P99, MAX, MIN, COUNT
  retentionDays: number;
  labels?: Record<string, string>;
}

type MetricType = 'COUNTER' | 'GAUGE' | 'HISTOGRAM' | 'TIMING';
type AggregationType = 'SUM' | 'AVG' | 'P50' | 'P95' | 'P99' | 'MAX' | 'MIN' | 'COUNT' | 'RATE';

interface MetricTags {
  [key: string]: string;
}

interface MetricDataPoint {
  timestamp: string;
  name: string;
  value: number;
  tags: MetricTags;
  aggregation: AggregationType;
}
```

**Core Metrics (Initial Registry):**

| Category | Metric | Type | Tags | Description |
|----------|--------|------|------|-------------|
| **Provider** | `provider.availability` | GAUGE | provider | Availability % over 24h |
| | `provider.latency_avg` | TIMING | provider, endpoint | Average response time |
| | `provider.latency_p95` | TIMING | provider, endpoint | P95 response time |
| | `provider.error_rate` | GAUGE | provider | Error rate over 5min |
| | `provider.quota_remaining` | GAUGE | provider | Remaining API quota |
| | `provider.requests_total` | COUNTER | provider, status | Total requests |
| **Queue** | `queue.depth` | GAUGE | queue, priority | Current queue depth |
| | `queue.enqueue_rate` | GAUGE | queue, type | Enqueue rate per min |
| | `queue.dequeue_rate` | GAUGE | queue | Dequeue rate per min |
| | `queue.wait_time` | TIMING | queue | Time job waits in queue |
| | `queue.dlq_count` | GAUGE | queue | Dead letter queue count |
| **Worker** | `worker.active` | GAUGE | pool | Active worker count |
| | `worker.idle` | GAUGE | pool | Idle worker count |
| | `worker.utilization` | GAUGE | pool | Worker utilization % |
| | `worker.jobs_processed` | COUNTER | worker, type | Jobs processed |
| | `worker.jobs_failed` | COUNTER | worker, type | Jobs failed |
| **Scheduler** | `schedule.runs_total` | COUNTER | schedule | Total schedule runs |
| | `schedule.runs_failed` | COUNTER | schedule | Failed schedule runs |
| | `schedule.missed` | COUNTER | schedule | Missed schedule runs |
| | `schedule.duration` | TIMING | schedule | Schedule execution time |
| **Database** | `db.connections_active` | GAUGE | database | Active connections |
| | `db.connections_idle` | GAUGE | database | Idle connections |
| | `db.query_duration` | TIMING | database, type | Query execution time |
| | `db.rows_affected` | COUNTER | database, table | Rows affected |
| | `db.size_bytes` | GAUGE | database, table | Table size |
| **Cache** | `cache.hit_rate` | GAUGE | cache | Cache hit rate |
| | `cache.miss_rate` | GAUGE | cache | Cache miss rate |
| | `cache.size` | GAUGE | cache | Cache size |
| | `cache.eviction_rate` | GAUGE | cache | Eviction rate |
| **Prediction** | `prediction.total` | COUNTER | model, market | Total predictions |
| | `prediction.settled` | COUNTER | model, market | Settled predictions |
| | `prediction.failure_rate` | GAUGE | model | Prediction failure rate |
| | `prediction.processing_time` | TIMING | model | Prediction generation time |
| **Model** | `model.calibration_ece` | GAUGE | model | Expected Calibration Error |
| | `model.calibration_mce` | GAUGE | model | Max Calibration Error |
| | `model.brier_score` | GAUGE | model, market | Brier score |
| | `model.accuracy` | GAUGE | model, market | Prediction accuracy |
| **CLV** | `clv.average` | GAUGE | league, market | Average CLV |
| | `clv.beat_rate` | GAUGE | league, market | Rate of beating CLV |
| | `clv.stability` | GAUGE | league | CLV stability metric |
| **ROI** | `roi.total` | GAUGE | market, staking | Total ROI |
| | `roi.rolling_30d` | GAUGE | market, staking | 30-day rolling ROI |
| | `roi.sharpe` | GAUGE | market, staking | Sharpe ratio |
| | `roi.sortino` | GAUGE | market, staking | Sortino ratio |
| | `roi.max_drawdown` | GAUGE | market | Max drawdown |
| **System** | `system.cpu_usage` | GAUGE | host | CPU usage % |
| | `system.memory_usage` | GAUGE | host | Memory usage % |
| | `system.disk_usage` | GAUGE | host, mount | Disk usage % |
| | `system.network_in` | COUNTER | host, interface | Network bytes in |
| | `system.network_out` | COUNTER | host, interface | Network bytes out |
| **Research** | `research.active_experiments` | GAUGE | status | Active experiment count |
| | `research.completed_experiments` | COUNTER | result | Completed experiments |
| | `research.datasets_total` | GAUGE | type | Total datasets |

### 3. Distributed Tracing

**Purpose:** Trace requests across multiple services, components, and operations. Provides end-to-end latency breakdown.

```typescript
interface ITracer {
  startSpan(name: string, options?: SpanOptions): Span;
  injectContext(span: Span): TraceContext;    // Serialize for propagation
  extractContext(context: TraceContext): Span | null;  // Deserialize
  flush(): Promise<void>;
}

interface SpanOptions {
  parent?: Span;
  traceId?: string;
  spanId?: string;
  startTime?: string;
  attributes?: Record<string, string | number | boolean>;
  links?: SpanLink[];                    // Link to other traces
}

interface Span {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  name: string;
  status: SpanStatus;
  startTime: string;
  endTime: string | null;
  durationMs: number | null;
  attributes: Record<string, string | number | boolean>;
  events: SpanEvent[];
  links: SpanLink[];
  end(): void;
  setAttribute(key: string, value: string | number | boolean): void;
  addEvent(name: string, attributes?: Record<string, unknown>): void;
  setStatus(status: SpanStatus): void;
}

type SpanStatus = 'OK' | 'ERROR' | 'UNSET';

interface SpanEvent {
  timestamp: string;
  name: string;
  attributes: Record<string, unknown>;
}

interface SpanLink {
  traceId: string;
  spanId: string;
  type: 'FOLLOWS_FROM' | 'CHILD_OF';
}

interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  attributes: Record<string, string | number | boolean>;
}

interface TraceQuery {
  traceId?: string;
  service?: string;
  operation?: string;
  minDurationMs?: number;
  maxDurationMs?: number;
  status?: SpanStatus;
  timeRange: TimeRange;
  limit?: number;
}
```

**Trace Examples:**
```
Fixture Sync Trace:
  ├── provider.resolve("api-football")          [5ms]
  ├── adapter.getFixtures({league: "EPL"})      [2345ms]
  │   ├── rateLimiter.acquire()                 [2ms]
  │   ├── circuitBreaker.call()                 [0ms]
  │   ├── http.get("api-football.com/fixtures") [2200ms]
  │   ├── rawArchiver.archive()                [15ms]
  │   ├── qualityScorer.score()                 [50ms]
  │   └── dataLineage.record()                 [10ms]
  └── storeFixtures(canonical)                  [100ms]

Odds Collection Trace:
  ├── scheduler.trigger("odds-sync-epl")        [5ms]
  ├── queue.enqueue({type: "odds_sync"})        [8ms]
  ├── worker.dequeue("odds_sync")               [3ms]
  ├── for each fixture (10x):
  │   ├── provider.getOdds({fixtureId})         [500ms avg]
  │   ├── oddsMerger.merge()                    [50ms]
  │   └── storeOdds()                           [30ms]
  └── queue.acknowledge()                       [2ms]
```

### 4. Event Timeline

**Purpose:** Stream of all significant events in the system. Used for incident reconstruction and system understanding.

```typescript
interface IEventTimeline {
  record(event: TimelineEvent): Promise<string>;
  query(filter: TimelineFilter): Promise<TimelineEvent[]>;
  getIncidentTimeline(incidentId: string): Promise<TimelineEvent[]>;
  getSystemTimeline(timeRange: TimeRange): Promise<TimelineEvent[]>;
  getDeploymentTimeline(timeRange: TimeRange): Promise<TimelineEvent[]>;
}

interface TimelineEvent {
  id: string;
  timestamp: string;
  type: EventType;
  severity: EventSeverity;
  category: EventCategory;
  title: string;
  description: string;
  source: string;
  correlationId: string;
  tags: string[];
  metadata: Record<string, unknown>;
}

type EventType =
  | 'DEPLOYMENT' | 'CONFIG_CHANGE' | 'FEATURE_FLAG'
  | 'INCIDENT_CREATED' | 'INCIDENT_RESOLVED'
  | 'ALERT_FIRED' | 'ALERT_RESOLVED'
  | 'PROVIDER_CHANGE' | 'PROVIDER_FAILOVER'
  | 'SCHEDULER_MISS' | 'SCHEDULER_FAILURE'
  | 'QUEUE_BACKLOG' | 'QUEUE_DRAINED'
  | 'WORKER_CRASH' | 'WORKER_RECOVERY'
  | 'DATABASE_MIGRATION' | 'DATABASE_FAILURE'
  | 'MODEL_DEPLOYED' | 'MODEL_PROMOTED'
  | 'THRESHOLD_BREACHED' | 'THRESHOLD_RECOVERED'
  | 'MANUAL_INTERVENTION';

type EventSeverity = 'INFO' | 'WARNING' | 'CRITICAL' | 'EMERGENCY';
type EventCategory = 'SYSTEM' | 'OPERATIONS' | 'MODEL' | 'DATA' | 'SECURITY';

interface TimelineFilter {
  timeRange: TimeRange;
  types?: EventType[];
  severities?: EventSeverity[];
  categories?: EventCategory[];
  source?: string;
  tags?: string[];
}
```

### 5. Dashboards

**Purpose:** 16 specialized dashboards providing real-time visibility into every aspect of the platform.

#### 5.1 System Health Dashboard
```
┌─────────────────────────────────────────────────────────────┐
│  System Health                       Status: HEALTHY         │
├─────────────────┬───────────────────┬───────────────────────┤
│  CPU: 45%       │  Memory: 62%      │  Disk: 71%           │
│  ████████░░░    │  ███████████░░░░  │  ████████████░░░░░░  │
│  Warning: 80%   │  Warning: 80%     │  Warning: 80%        │
├─────────────────┴───────────────────┴───────────────────────┤
│  Uptime: 14d 6h 23m    │  Active Workers: 4/10             │
│  Last Incident: 2d ago  │  Active Alerts: 2 (WARNING)      │
├─────────────────────────────────────────────────────────────┤
│  Component Health:                                           │
│  ✅ Database          ✅ Queue Engine    ✅ Worker Pool      │
│  ✅ Provider Registry ✅ Cache           ✅ Scheduler       │
│  ✅ File System       ✅ Network         ✅ DNS             │
└─────────────────────────────────────────────────────────────┘
```

#### 5.2 Provider Dashboard
```
┌─────────────────────────────────────────────────────────────┐
│  Provider Health Dashboard              Last updated: 30s ago│
├───────────┬────────┬────────┬────────┬───────┬─────────────┤
│ Provider  │ Avail  │ Latency│ Err %  │ Quota │ Circuit     │
├───────────┼────────┼────────┼────────┼───────┼─────────────┤
│ API-⚽    │ 99.8%  │ 450ms  │ 0.2%  │ 45%  │ CLOSED      │
│ Football  │ 97.2%  │ 890ms  │ 2.1%  │ 12%  │ CLOSED      │
│ Odds API  │ 99.9%  │ 320ms  │ 0.1%  │ 78%  │ CLOSED      │
│ Pinnacle  │ 100%   │ 280ms  │ 0.0%  │ 34%  │ CLOSED      │
├───────────┴────────┴────────┴────────┴───────┴─────────────┤
│  Latency Trend (24h):                                       │
│  ▁▁▃▄▆▇██▇▆▄▃▂▁▁▂▃▅▇██▇▅▃▂                                  │
│  ▲ Warning: API-Football latency spike at 14:32             │
└─────────────────────────────────────────────────────────────┘
```

#### 5.3 Prediction Health Dashboard
```
┌─────────────────────────────────────────────────────────────┐
│  Prediction Health                    Period: Last 30 days  │
├──────────────────────┬──────────────────┬───────────────────┤
│  Total Predictions   │  Settled         │  Unsettled        │
│  1,245               │  892             │  353              │
├──────────────────────┴──────────────────┴───────────────────┤
│  Success Rate: 98.7%   │  Avg Processing: 320ms             │
│  Failure Rate: 1.3%    │  P95 Processing: 890ms             │
├─────────────────────────────────────────────────────────────┤
│  Predictions Over Time:                                     │
│  ██▇▇▆▆▅▅▆▇██▇▆▅▅▆▇▇██▇▆▅▅▆▇                                │
│  ────────────────────────────────────►                      │
│  ▲ Alert: Prediction failure rate > 5% on Jul 12            │
└─────────────────────────────────────────────────────────────┘
```

#### 5.4 Queue Dashboard
```
┌─────────────────────────────────────────────────────────────┐
│  Queue Dashboard                         Active Jobs: 28   │
├───────────┬────────┬────────┬────────┬────────┬─────────────┤
│ Queue     │ Depth  │ Wait   │ Process│ Through│ DLQ        │
├───────────┼────────┼────────┼────────┼────────┼─────────────┤
│ Critical  │ 0      │ 0ms    │ 120ms  │ 5/min  │ 0          │
│ High      │ 3      │ 45ms   │ 850ms  │ 12/min │ 0          │
│ Medium    │ 22     │ 2.3s   │ 1.2s   │ 8/min  │ 2          │
│ Low       │ 3      │ 5.1s   │ 3.4s   │ 3/min  │ 5          │
├───────────┴────────┴────────┴────────┴────────┴─────────────┤
│  Queue Depth Trend (1h):                                    │
│  ▁▁▁▃▅▇█▇▅▃▃▂▁▁▁▂▃▅▇█▇▅▃▂▁▁                               │
│  ▲ Warning: Medium queue depth > 20 for 15+ minutes         │
└─────────────────────────────────────────────────────────────┘
```

#### 5.5 Database Dashboard
```
┌─────────────────────────────────────────────────────────────┐
│  Database Dashboard                     Connections: 12/50 │
├───────────────────┬──────────────────┬──────────────────────┤
│  Active: 8         │  Idle: 4         │  Waiting: 0         │
├───────────────────┴──────────────────┴──────────────────────┤
│  Query Performance (p95):                                   │
│  ● SELECT: 15ms    ● INSERT: 45ms    ● UPDATE: 35ms        │
│  ● DELETE: 12ms    ● Complex: 180ms                         │
├─────────────────────────────────────────────────────────────┤
│  Table Sizes:                                               │
│  fixtures:       1.2 GB   │  odds_snapshots:  8.5 GB       │
│  predictions:    3.4 GB   │  audit_trail:     2.1 GB       │
│  operations_jobs: 850 MB   │  metrics:          1.8 GB      │
├─────────────────────────────────────────────────────────────┤
│  Slow Queries (last 24h): 12                                │
│  ● Avg 2.3s — SELECT FROM odds_snapshots WHERE ...         │
│  ● Avg 1.8s — INSERT INTO audit_trail (batch) ...          │
└─────────────────────────────────────────────────────────────┘
```

#### 5.6 Cache Dashboard
```
┌─────────────────────────────────────────────────────────────┐
│  Cache Dashboard                              Hit Rate: 87% │
├───────────────────┬──────────────────┬──────────────────────┤
│  Total Keys: 45K   │  Memory: 234 MB  │  Eviction: 12/min   │
├───────────────────┴──────────────────┴──────────────────────┤
│  Hit Rate by Cache Type:                                    │
│  ● Fixture Cache:    94%  ● Odds Cache:      91%           │
│  ● Prediction Cache: 88%  ● Feature Cache:   82%           │
│  ● Session Cache:    76%  ● Query Cache:     95%           │
├─────────────────────────────────────────────────────────────┤
│  Miss Rate Trend (24h):                                     │
│  ▂▂▃▄▅▇█▇▅▄▃▂▂▁▂▃▄▅▇█▇▅▄▃▂                                   │
└─────────────────────────────────────────────────────────────┘
```

#### 5.7 Scheduler Dashboard
```
┌─────────────────────────────────────────────────────────────┐
│  Scheduler Dashboard                     Healthy: 13/13    │
├───────────────────┬──────────────────┬──────────────────────┤
│  Active: 13        │  Paused: 0       │  Failed: 0         │
├───────────────────┴──────────────────┴──────────────────────┤
│  Next Runs:                                                │
│  ● odds-sync-epl:       3.2 min     ● (every 5 min)        │
│  ● odds-sync-laliga:    4.8 min     ● (every 5 min)        │
│  ● result-sync:         2.1 hours   ● (every 6 hours)      │
│  ● fixture-sync:        18.3 hours  ● (daily)              │
│  ● data-quality-audit:  5.8 hours   ● (daily)              │
│  ● cleanup-raw-archive: 6.9 days    ● (weekly)             │
├─────────────────────────────────────────────────────────────┤
│  Scheduler Misses (24h): 0     Avg Scheduling Latency: 8ms │
└─────────────────────────────────────────────────────────────┘
```

#### 5.8 Worker Dashboard
```
┌─────────────────────────────────────────────────────────────┐
│  Worker Dashboard                    Pool Size: 4/10       │
├──────────┬────────┬────────┬────────┬────────┬─────────────┤
│ Worker   │ Status │ Jobs   │ Failed │ Avg    │ Memory     │
├──────────┼────────┼────────┼────────┼────────┼─────────────┤
│ w-001    │ BUSY   │ 1,234  │ 12     │ 450ms  │ 128 MB     │
│ w-002    │ BUSY   │ 1,201  │ 15     │ 520ms  │ 145 MB     │
│ w-003    │ IDLE   │ 1,189  │ 8      │ 390ms  │ 95 MB      │
│ w-004    │ BUSY   │ 1,215  │ 10     │ 410ms  │ 112 MB     │
├──────────┴────────┴────────┴────────┴────────┴─────────────┤
│  Worker Utilization: 75%     Throughput: 28 jobs/min        │
│  ▲ Auto-scale: Queue depth > 100 → Adding worker 5         │
└─────────────────────────────────────────────────────────────┘
```

#### 5.9 Error Dashboard
```
┌─────────────────────────────────────────────────────────────┐
│  Error Dashboard                       Last 24 hours       │
├───────────┬────────┬────────┬────────┬─────────────────────┤
│ Error     │ Count  │ Rate   │ Trend  │ Last Occurrence     │
├───────────┼────────┼────────┼────────┼─────────────────────┤
│ 500       │ 23     │ 0.02%  │ ↓ 45%  │ 3 min ago           │
│ 429 (RL)  │ 12     │ 0.01%  │ ↑ 20%  │ 12 min ago          │
│ Timeout   │ 8      │ 0.01%  │ ↓ 60%  │ 45 min ago          │
│ DB Error  │ 3      │ 0.003% │ ↓ 80%  │ 2.3 hours ago       │
│ Provider  │ 15     │ 0.01%  │ ↑ 10%  │ 5 min ago           │
├───────────┴────────┴────────┴────────┴─────────────────────┤
│  Error Rate Over Time (24h):                                │
│  ▁▁▁▄▇████▇▅▃▂▁▁▁▂▃▅▇███▇▅▃▂                                 │
│  Event: Spikes correlated with provider API-Football issues  │
└─────────────────────────────────────────────────────────────┘
```

#### 5.10 Drift Dashboard
```
┌─────────────────────────────────────────────────────────────┐
│  Drift Dashboard                       Monitoring: Active  │
├───────────────────┬──────────────────┬──────────────────────┤
│  Data Drift: 0.12  │  Concept Drift:  │  Feature Drift:     │
│  (PSI)             │  0.08 (KL)       │  xG: 0.15, Form:   │
│  Threshold: 0.20   │  Threshold: 0.15 │  0.08, ELO: 0.05    │
├───────────────────┴──────────────────┴──────────────────────┤
│  Calibration Drift:                                         │
│  Current ECE: 0.042    │  Baseline: 0.038    │  Change: +10%│
│  Status: WARNING (threshold: 0.05)                         │
├─────────────────────────────────────────────────────────────┤
│  League Drift:                                              │
│  ● EPL:      0.03 (stable)    ● La Liga: 0.04 (stable)    │
│  ● Serie A:  0.12 (⚠️ drift)  ● Bundesliga:0.02 (stable)  │
│  ● Ligue 1:  0.05 (stable)                                  │
├─────────────────────────────────────────────────────────────┤
│  ▲ Alert: Serie A calibration drift exceeding threshold     │
└─────────────────────────────────────────────────────────────┘
```

#### 5.11 CLV Dashboard
```
┌─────────────────────────────────────────────────────────────┐
│  CLV Dashboard                              Period: 30d    │
├───────────┬──────────┬──────────┬──────────┬────────────────┤
│ League    │ Avg CLV  │ Beat Rt  │ Stability│ Predictions   │
├───────────┼──────────┼──────────┼──────────┼────────────────┤
│ EPL       │ +0.023   │ 58%      │ 0.87     │ 345           │
│ La Liga   │ +0.018   │ 55%      │ 0.82     │ 278           │
│ Serie A   │ -0.005   │ 48%      │ 0.65     │ 198           │
│ Bundesliga│ +0.031   │ 61%      │ 0.91     │ 210           │
│ Ligue 1   │ +0.015   │ 54%      │ 0.79     │ 145           │
├───────────┴──────────┴──────────┴──────────┴────────────────┤
│  CLV Trend (30d):                                           │
│  ▁▂▃▄▅▆▇█▇▆▅▄▃▂▁▂▃▄▅▆▇█▇▆▅▄▃                                │
│  ▲ Warning: Serie A CLV negative for 7+ days                │
└─────────────────────────────────────────────────────────────┘
```

#### 5.12 ROI Dashboard
```
┌─────────────────────────────────────────────────────────────┐
│  ROI Dashboard                              Period: 30d    │
├───────────────────┬──────────────────┬──────────────────────┤
│  Total ROI: +8.3% │  ROI (30d): +2.1%│  ROI (90d): +7.2%   │
├───────────────────┴──────────────────┴──────────────────────┤
│  Sharpe: 1.45     │  Sortino: 1.82   │  Max DD: -5.2%      │
├─────────────────────────────────────────────────────────────┤
│  ROI by Market:                                             │
│  ● Moneyline:     +9.1%  ● Asian Handicap: +7.8%          │
│  ● Over/Under:    +6.5%  ● BTTS:           +4.2%          │
│  ● Double Chance: +3.1%  ● Correct Score:  -2.3%          │
├─────────────────────────────────────────────────────────────┤
│  ROI Trend (30d):                                           │
│  ▄▅▆▇██▇▆▅▆▇██▇▆▅▆▇██▇▆▅▄▃▅▆                                │
│  ▲ Warning: ROI flat for 5 days                             │
└─────────────────────────────────────────────────────────────┘
```

#### 5.13 Research Dashboard
```
┌─────────────────────────────────────────────────────────────┐
│  Research Dashboard                     Active: 3           │
├───────────────────┬──────────────────┬──────────────────────┤
│  Active Exp: 3    │  Completed: 15   │  Failed: 2          │
├───────────────────┴──────────────────┴──────────────────────┤
│  Active Experiments:                                        │
│  ● exp_000045: CatBoost vs LightGBM (60% complete)          │
│  ● exp_000046: Feature ablation test (35% complete)         │
│  ● exp_000047: Calibration tuning (12% complete)            │
├─────────────────────────────────────────────────────────────┤
│  Recent Results:                                            │
│  ● exp_000044: Poisson baseline — Brier: 0.212 ( 🏆 champion)│
│  ● exp_000043: Ensemble v2 — Brier: 0.218                  │
│  ● exp_000042: Neural net — Brier: 0.224                   │
└─────────────────────────────────────────────────────────────┘
```

#### 5.14 Model Dashboard
```
┌─────────────────────────────────────────────────────────────┐
│  Model Dashboard                             Champion: Base │
├───────────────────┬──────────────────┬──────────────────────┤
│  Active Models: 3 │  Challengers: 2  │  Retired: 5         │
├───────────────────┴──────────────────┴──────────────────────┤
│  Model Performance:                                         │
│  ● Base Poisson:         Brier 0.212 ● ECE 0.038  (🏆)     │
│  ● Enhanced Poisson:     Brier 0.208 ● ECE 0.035  (CHA)    │
│  ● LightGBM:             Brier 0.215 ● ECE 0.042           │
├─────────────────────────────────────────────────────────────┤
│  Calibration Curves:                                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ████░░░░ Perfect   ████░░░  ████░░                 │   │
│  │  ██░░████ Current   ██░░███  ██░░███                │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  │  0.0    0.2    0.4    0.6    0.8    1.0            │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

#### 5.15 Decision Dashboard
```
┌─────────────────────────────────────────────────────────────┐
│  Decision Dashboard                      Period: 24h       │
├───────────────────┬──────────────────┬──────────────────────┤
│  Decisions Made:  │  Executed:       │  Skipped (low conf):│
│  23               │  18              │  5                  │
├───────────────────┴──────────────────┴──────────────────────┤
│  Decision Breakdown:                                        │
│  ● Moneyline:     8  ● Asian Handicap:  5                 │
│  ● Over/Under:    4  ● BTTS:           1                  │
├─────────────────────────────────────────────────────────────┤
│  Confidence Distribution:                                   │
│  ████████░░ High (≥80%):    12                             │
│  ████░░░░░░ Medium (60-79%): 8                             │
│  ██░░░░░░░░ Low (<60%):     3                             │
└─────────────────────────────────────────────────────────────┘
```

#### 5.16 Feature Dashboard
```
┌─────────────────────────────────────────────────────────────┐
│  Feature Dashboard                       Total Features: 48│
├───────────────────┬──────────────────┬──────────────────────┤
│  Active: 45        │  Deprecated: 3   │  In Development: 0  │
├───────────────────┴──────────────────┴──────────────────────┤
│  Feature Health:                                            │
│  ● xG_home:        Available    ● xG_away:     Available   │
│  ● form_home:      Available    ● form_away:   Available   │
│  ● elo_home:       Available    ● elo_away:    Available   │
│  ● injuries_home:  Stale (2h)  ● injuries_away: Available │
├─────────────────────────────────────────────────────────────┤
│  Feature Generation Time:                                   │
│  ● Avg: 45ms/fixture    ● P95: 120ms    ● P99: 280ms      │
└─────────────────────────────────────────────────────────────┘
```

### 6. Operational Reports

#### Daily Operational Report
```typescript
interface IDailyReport {
  generate(date: string): Promise<DailyReport>;
  getLatest(): Promise<DailyReport>;
  getHistory(days: number): Promise<DailyReport[]>;
  export(date: string, format: 'json' | 'markdown' | 'pdf'): Promise<ReadableStream>;
}

interface DailyReport {
  date: string;
  generatedAt: string;
  summary: string;                      // Auto-generated narrative summary
  period: 'daily';
  
  metrics: {
    predictionsGenerated: number;
    predictionsSettled: number;
    oddsSnapshots: number;
    fixturesProcessed: number;
    providerCalls: number;
    providerErrors: number;
    queueJobsProcessed: number;
    queueJobsFailed: number;
    alertsFired: number;
    alertsResolved: number;
  };
  
  health: {
    systemStatus: HealthStatus;
    componentHealth: ComponentHealth[];
    incidents: IncidentSummary[];
    uptimePercent: number;
  };
  
  performance: {
    avgResponseTime: number;
    p95ResponseTime: number;
    queueWaitTime: number;
    workerUtilization: number;
    cacheHitRate: number;
  };
  
  changes: {
    deployments: string[];
    configChanges: string[];
    modelChanges: string[];
  };
  
  trends: TrendSummary[];
  recommendations: string[];
}
```

#### Weekly Operational Report
```typescript
interface WeeklyReport extends DailyReport {
  period: 'weekly';
  weekStart: string;
  weekEnd: string;
  
  comparison: {                          // Week-over-week
    predictionsChangePercent: number;
    providerErrorsChangePercent: number;
    queueThroughputChangePercent: number;
    avgResponseTimeChange: number;
  };
  
  modelMetrics: {
    avgBrierScore: number;
    avgECE: number;
    avgCLV: number;
    avgROI: number;
    bestModel: string;
    worstModel: string;
  };
  
  topIncidents: IncidentSummary[];
  actionItems: ActionItem[];
}
```

#### Monthly Operational Report
```typescript
interface MonthlyReport extends WeeklyReport {
  period: 'monthly';
  monthStart: string;
  monthEnd: string;
  
  monthlySummary: string;               // Executive summary
  keyAchievements: string[];
  challengesFaced: string[];
  
  trends: {
    providerLatency: TrendAnalysis;
    queueDepth: TrendAnalysis;
    predictionVolume: TrendAnalysis;
    modelPerformance: TrendAnalysis;
    resourceUsage: TrendAnalysis;
  };
  
  costAnalysis: {
    totalApiCalls: number;
    estimatedCost: number;
    costByProvider: Record<string, number>;
    costTrend: 'increasing' | 'stable' | 'decreasing';
  };
  
  slaMetrics: {
    uptimePercent: number;
    predictionSLA: number;              // % predictions within SLA
    alertResponseTime: number;
    incidentResolutionTime: number;
  };
  
  recommendations: StrategicRecommendation[];
}
```

### 7. Alert System (Production-Specific)

**Extends EPIC 23 Alert Engine with production-specific rules:**

| Alert Rule | Condition | Severity | Channel |
|------------|-----------|----------|---------|
| Provider Down | Provider health = DOWN ≥ 5 min | CRITICAL | Slack + Email + PagerDuty |
| Provider Slow | P95 latency > 5s for 5 min | WARNING | Slack |
| High Latency | P95 latency > 10s | CRITICAL | Slack + PagerDuty |
| Queue Backlog | Queue depth > 5000 for 5 min | CRITICAL | Slack + PagerDuty |
| DJL Overflow | DLQ count > 100 | WARNING | Slack (daily digest) |
| Prediction Failure | Failure rate > 10% in 1h | CRITICAL | Slack + PagerDuty |
| Database Down | Database unreachable | EMERGENCY | Slack + Email + SMS + PagerDuty |
| Scheduler Miss | Schedule missed > 5 in 1h | WARNING | Slack |
| Calibration Drift | ECE increase > 20% over baseline | MEDIUM | Slack (weekly review) |
| Performance Degradation | P95 response time > 2x baseline | WARNING | Slack |
| ROI Collapse | 30d ROI < -10% | CRITICAL | Slack + Email |
| CLV Degradation | 30d avg CLV negative for 7+ days | WARNING | Slack |
| Resource Exhaustion | CPU > 95% for 10 min | CRITICAL | Slack + PagerDuty |
| Memory Critical | Memory > 95% | CRITICAL | Slack + PagerDuty |
| Disk Space Critical | Disk > 95% | EMERGENCY | Slack + Email + PagerDuty |

### 8. Timelines

**Incident Timeline:**
```
12:00:00 — System healthy
12:15:23 — Alert: API-Football latency spike (p95: 8.2s)
12:15:25 — Circuit breaker opens (failure count: 5)
12:15:26 — Failover to Football-Data provider
12:15:30 — Alert: Provider failover occurred
12:16:00 — Queue backlog growing (depth: 150)
12:17:00 — All providers degraded (secondary also slow)
12:17:30 — Alert: High Latency (CRITICAL)
12:18:00 — Incident created (inc_000023)
12:18:30 — Manual intervention: Rate limit reduced
12:20:00 — API-Football latency returning to normal
12:21:00 — Circuit breaker half-open → test request succeeds
12:22:00 — Circuit breaker closed, primary restored
12:23:00 — Queue drained to normal levels
12:24:00 — Incident resolved (MTTR: 6 min)
```

**Performance Timeline:**
```
┌─────────────────────────────────────────────────────────────┐
│  Performance Timeline (24h)                                  │
├─────────────────────────────────────────────────────────────┤
│  CPU: ▁▂▃▄▅▆▇██▇▆▅▄▃▂▁▂▃▄▅▆▇██▇    Max: 92%  Avg: 45%    │
│  Mem: ▇▇▇▇▇▇▇▇▆▆▆▆▇▇▇▇▇▇▇▇▆▆▆▆▇    Max: 78%  Avg: 62%    │
│  Disk: ▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇   Max: 72%  Avg: 71%    │
│  Net:  ▁▂▃▄▅▆▇█▇▆▅▄▃▂▁▂▃▄▅▆▇█▇▆▅    Peak: 45 MB/s          │
│       06:00  09:00  12:00  15:00  18:00  21:00              │
└─────────────────────────────────────────────────────────────┘
```

**Resource Timeline:**
```
┌─────────────────────────────────────────────────────────────┐
│  Resource Timeline (30 days)                                 │
├─────────────────────────────────────────────────────────────┤
│  Daily Active Workers:                                      │
│  ▂▂▃▄▅▆▇█▇▆▅▄▃▂▂▃▄▅▆▇█▇▆▅▄▃▂▂▃▄    Avg: 4.2  Max: 8      │
│  Daily API Calls (K):                                       │
│  ▂▂▃▃▄▄▅▅▆▆▇▇██▇▇▆▆▅▅▄▄▃▃▂▂▃▃▄▄     Avg: 12K  Max: 22K    │
│  Daily Predictions:                                         │
│  ▂▂▃▃▄▄▅▅▆▆▇▇██▇▇▆▆▅▅▄▄▃▃▂▂▃▃▄▄     Avg: 85   Max: 145    │
│        Week 1  Week 2  Week 3  Week 4                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Notes

### Metrics Collection Pattern
```typescript
// Every module uses the same pattern:
export async function processOdds(fixtureId: string): Promise<void> {
  const startTime = performance.now();
  
  try {
    metrics.counter('odds.processing_started', 1, { fixtureId });
    tracer.startSpan('odds.process', { attributes: { fixtureId } });
    
    // ... actual processing ...
    
    metrics.timing('odds.processing_time', performance.now() - startTime, { fixtureId });
    metrics.counter('odds.processed', 1, { fixtureId });
    tracer.endSpan('ok');
  } catch (error) {
    metrics.counter('odds.processing_error', 1, { fixtureId, errorType: error.name });
    tracer.endSpan('error');
    throw error;
  }
}
```

### Dashboard Data Source
Dashboards consume data from:
1. **Metrics Registry** — Time-series metrics (gauges, counters, histograms)
2. **Event Timeline** — System events (deployments, incidents, config changes)
3. **Operations DB** — Job data, schedule status, worker status
4. **Provider Registry** — Provider health and status
5. **Model Registry** — Model performance metrics
6. **Research Registry** — Experiment status and results

### Report Generation Schedule
| Report | Schedule | Retention |
|--------|----------|-----------|
| Daily | Every day at 23:59 UTC | 90 days |
| Weekly | Every Sunday at 23:59 UTC | 52 weeks |
| Monthly | Last day of month 23:59 UTC | 24 months |
| On-demand | Triggered via API | 30 days |

---

## Directory Structure

```
src/
├── observability/
│   ├── interfaces/
│   │   ├── ILogger.ts
│   │   ├── IMetricsRegistry.ts
│   │   ├── ITracer.ts
│   │   ├── IEventTimeline.ts
│   │   ├── IDashboardDataProvider.ts
│   │   └── IOperationalReport.ts
│   ├── logging/
│   │   ├── Logger.ts
│   │   ├── LogTransport.ts
│   │   ├── ConsoleTransport.ts
│   │   ├── FileTransport.ts
│   │   └── LogQuery.ts
│   ├── metrics/
│   │   ├── MetricsRegistry.ts
│   │   ├── MetricAggregator.ts
│   │   └── MetricExport.ts
│   ├── tracing/
│   │   ├── Tracer.ts
│   │   └── SpanExporter.ts
│   ├── events/
│   │   └── EventTimeline.ts
│   ├── dashboards/
│   │   ├── providers/
│   │   │   ├── SystemHealthProvider.ts
│   │   │   ├── ProviderDashboardProvider.ts
│   │   │   ├── QueueDashboardProvider.ts
│   │   │   ├── DatabaseDashboardProvider.ts
│   │   │   ├── CacheDashboardProvider.ts
│   │   │   ├── SchedulerDashboardProvider.ts
│   │   │   ├── WorkerDashboardProvider.ts
│   │   │   ├── ErrorDashboardProvider.ts
│   │   │   ├── DriftDashboardProvider.ts
│   │   │   ├── CLVDashboardProvider.ts
│   │   │   ├── ROIDashboardProvider.ts
│   │   │   ├── PredictionDashboardProvider.ts
│   │   │   ├── ResearchDashboardProvider.ts
│   │   │   ├── ModelDashboardProvider.ts
│   │   │   ├── DecisionDashboardProvider.ts
│   │   │   └── FeatureDashboardProvider.ts
│   │   └── DashboardRouter.ts
│   ├── reports/
│   │   ├── DailyReportGenerator.ts
│   │   ├── WeeklyReportGenerator.ts
│   │   ├── MonthlyReportGenerator.ts
│   │   └── ReportFormatter.ts
│   ├── incidents/
│   │   └── IncidentTimeline.ts
│   ├── types/
│   │   ├── MetricTypes.ts
│   │   ├── LogTypes.ts
│   │   ├── EventTypes.ts
│   │   └── ReportTypes.ts
│   └── __tests__/
│       ├── Logger.test.ts
│       ├── MetricsRegistry.test.ts
│       ├── Tracer.test.ts
│       ├── EventTimeline.test.ts
│       ├── DashboardProvider.test.ts
│       └── ReportGenerator.test.ts
├── app/
│   └── dashboard/
│       ├── system/route.ts
│       ├── provider/route.ts
│       ├── queue/route.ts
│       ├── database/route.ts
│       ├── cache/route.ts
│       ├── scheduler/route.ts
│       ├── worker/route.ts
│       ├── error/route.ts
│       ├── drift/route.ts
│       ├── clv/route.ts
│       ├── roi/route.ts
│       ├── prediction/route.ts
│       ├── research/route.ts
│       ├── model/route.ts
│       ├── decision/route.ts
│       ├── feature/route.ts
│       └── reports/route.ts
```

---

## Database Tables (Metrics & Events)

```sql
-- Metric Data Points (time-series)
CREATE TABLE observability_metrics (
  id BIGSERIAL,
  name TEXT NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  tags JSONB NOT NULL DEFAULT '{}',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (name, timestamp, id)
) PARTITION BY RANGE (timestamp);

-- Create monthly partitions
CREATE TABLE observability_metrics_2026_07 PARTITION OF observability_metrics
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

-- Traces
CREATE TABLE observability_traces (
  trace_id TEXT NOT NULL,
  span_id TEXT NOT NULL,
  parent_span_id TEXT,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration_ms INTEGER,
  attributes JSONB NOT NULL DEFAULT '{}',
  events JSONB NOT NULL DEFAULT '[]',
  PRIMARY KEY (trace_id, span_id)
);

-- Events Timeline
CREATE TABLE observability_events (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  source TEXT NOT NULL,
  correlation_id TEXT,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}'
);

-- Operational Reports
CREATE TABLE observability_reports (
  id TEXT PRIMARY KEY,
  period TEXT NOT NULL,                 -- 'daily', 'weekly', 'monthly'
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  report JSONB NOT NULL,
  format TEXT NOT NULL DEFAULT 'json'
);

-- Logs (structured)
CREATE TABLE observability_logs (
  id BIGSERIAL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}',
  error JSONB,
  environment TEXT NOT NULL,
  service TEXT NOT NULL,
  version TEXT NOT NULL,
  host TEXT NOT NULL,
  PRIMARY KEY (timestamp, id)
);

CREATE INDEX idx_metrics_name_time ON observability_metrics(name, timestamp DESC);
CREATE INDEX idx_metrics_tags ON observability_metrics USING GIN (tags);
CREATE INDEX idx_traces_trace_id ON observability_traces(trace_id);
CREATE INDEX idx_events_type_time ON observability_events(type, timestamp DESC);
CREATE INDEX idx_events_severity ON observability_events(severity, timestamp DESC);
CREATE INDEX idx_logs_level ON observability_logs(level, timestamp DESC);
CREATE INDEX idx_logs_meta ON observability_logs USING GIN (meta jsonb_path_ops);
CREATE INDEX idx_reports_period ON observability_reports(period, period_start DESC);
```

---

## Verification Checklist

- [ ] Structured logging implemented with consistent JSON format across all modules
- [ ] Metrics registry with all defined metrics (providers, queue, workers, database, cache, predictions, models, CLV, ROI, system, research)
- [ ] Distributed tracing with span context propagation
- [ ] Event timeline capturing all system events
- [ ] System Health dashboard operational
- [ ] Provider dashboard operational (availability, latency, error rate, quota)
- [ ] Queue dashboard operational (depth, wait times, throughput, DLQ)
- [ ] Database dashboard operational (connections, query perf, table sizes)
- [ ] Cache dashboard operational (hit/miss rates, size, eviction)
- [ ] Scheduler dashboard operational (status, next runs, misses)
- [ ] Worker dashboard operational (pool status, utilization, throughput)
- [ ] Error dashboard operational (error types, rates, trends)
- [ ] Drift dashboard operational (data, concept, calibration, league drift)
- [ ] CLV dashboard operational (avg CLV, beat rate, stability by league)
- [ ] ROI dashboard operational (total, rolling, Sharpe, Sortino, MaxDD)
- [ ] Prediction health dashboard operational
- [ ] Research dashboard operational (experiment status)
- [ ] Model dashboard operational (champion/challenger, calibration curves)
- [ ] Decision dashboard operational (confidence distribution)
- [ ] Feature dashboard operational (health, generation time)
- [ ] Daily operational report auto-generated
- [ ] Weekly operational report auto-generated
- [ ] Monthly operational report auto-generated
- [ ] All production alerts configured and tested
- [ ] Incident timeline captures full incident lifecycle
- [ ] Performance timeline shows resource trends
- [ ] Resource timeline shows capacity trends
- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npx vitest run` — all tests pass
- [ ] `npx madge --circular` — zero circular dependencies
- [ ] ADR updated for observability architecture
- [ ] Verification report generated

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Metrics storage grows unbounded | Partitioned tables; retention policies; auto-purge |
| Dashboard queries slow down system | Dedicated read replicas; cached aggregations; materialized views |
| Alert fatigue from too many alerts | Cooldown periods; suppression rules; severity-based routing |
| Log volume overwhelms storage | Configurable log levels per component; sampling for debug logs |
| Trace overhead impacts performance | Low-overhead sampling; configurable trace rate; async export |
| Report generation blocks other operations | Reports generated as background tasks; avoids peak hours |