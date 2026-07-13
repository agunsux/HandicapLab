# EPIC 23 — Operations Intelligence Platform

**Category:** Operational Intelligence Layer  
**Dependencies:** EPIC 22 — Live Data Intelligence Platform  
**Target Completion:** Phase II-B (Weeks 5–8)  
**Critical Path:** Automation foundation for EPIC 24  
**Codename:** HERMES-23

---

## Mission Statement

Transform HandicapLab into a system that runs autonomously without manual intervention. Every data fetch, prediction generation, settlement, health check, and alert must be scheduled, executed, tracked, and logged by the Operations Intelligence Platform.

**Target outcome:** A fully automated pipeline where every job has a lifecycle, every failure has a retry, every incident has an alert, and every execution has an immutable audit trail. Zero manual steps required for routine operations.

---

## Architecture

```
EPIC 22 → Canonical Data Stream
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│                   Operations Intelligence Platform             │
│                                                               │
│  ┌─────────────────────┐    ┌─────────────────────────────┐  │
│  │   Scheduler Engine   │    │       Job Registry          │  │
│  │  - Cron Management   │    │  - Job lifecycle tracking   │  │
│  │  - Task Prioritiz.   │    │  - Job history (immutable)  │  │
│  │  - Dependency Resol. │    │  - Execution timeline       │  │
│  └─────────┬───────────┘    └─────────────┬───────────────┘  │
│            │                              │                   │
│            ▼                              │                   │
│  ┌─────────────────────┐                  │                   │
│  │     Queue Engine     │                 │                   │
│  │  - Priority queues   │◄────────────────┘                   │
│  │  - Retry queue       │                                     │
│  │  - Dead letter queue │                                     │
│  │  - Backpressure      │                                     │
│  └─────────┬───────────┘                                      │
│            │                                                   │
│            ▼                                                   │
│  ┌─────────────────────┐    ┌─────────────────────────────┐  │
│  │     Worker Pool      │    │   Background Processing     │  │
│  │  - Dynamic scaling   │    │  - Async task handler       │  │
│  │  - Health check      │    │  - Batch processing         │  │
│  │  - Graceful shutdown │    │  - Stream processing        │  │
│  └─────────┬───────────┘    └─────────────┬───────────────┘  │
│            │                              │                   │
│            ▼                              ▼                   │
│  ┌─────────────────────┐    ┌─────────────────────────────┐  │
│  │  Distributed Lock    │    │      Alert Engine           │  │
│  │  - Lease management  │    │  - Threshold-based alert    │  │
│  │  - Fencing tokens    │    │  - Escalation policy        │  │
│  │  - TTL-based expiry  │    │  - Suppression rules        │  │
│  └─────────────────────┘    └─────────────┬───────────────┘  │
│                                            │                   │
│  ┌─────────────────────┐    ┌──────────────▼────────────────┐ │
│  │   Notification Eng  │    │       Incident Report          │ │
│  │  - Email/Slack/Push │    │  - Auto-generated             │ │
│  │  - Template system  │    │  - Root cause analysis        │ │
│  │  - Rate limiting    │    │  - Timeline reconstruction    │ │
│  └─────────────────────┘    └─────────────────────────────┘  │
│                                                               │
│  ┌─────────────────────┐    ┌─────────────────────────────┐  │
│  │    Audit Trail       │    │   Execution Metrics         │  │
│  │  - Immutable log     │    │  - Throughput tracking      │  │
│  │  - Tamper-evident    │    │  - Latency percentiles      │  │
│  │  - Full capture      │    │  - Success/failure rate     │  │
│  └─────────────────────┘    └─────────────────────────────┘  │
│                                                               │
│  ┌─────────────────────┐    ┌─────────────────────────────┐  │
│  │  Performance Profile │    │    Resource Monitoring      │  │
│  │  - CPU/Memory/IO     │    │  - CPU / Memory / Disk      │  │
│  │  - Hot path detect   │    │  - Network I/O              │  │
│  │  - Bottleneck find   │    │  - Process monitoring       │  │
│  └─────────────────────┘    └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
EPIC 24 → Production Intelligence Platform
```

---

## Detailed Module Specifications

### 1. Scheduler Engine

**Purpose:** Central cron engine that manages all scheduled jobs. Supports cron expressions, one-time schedules, interval-based schedules, and dependency-driven schedules.

```typescript
interface ISchedulerEngine {
  register(schedule: ScheduleDefinition): Promise<ScheduleHandle>;
  unregister(handle: ScheduleHandle): Promise<void>;
  triggerNow(handle: ScheduleHandle): Promise<void>;
  pause(handle: ScheduleHandle): Promise<void>;
  resume(handle: ScheduleHandle): Promise<void>;
  listSchedules(filter?: ScheduleFilter): Promise<ScheduleInfo[]>;
  getScheduleStatus(handle: ScheduleHandle): Promise<ScheduleStatus>;
  getExecutionHistory(handle: ScheduleHandle, limit?: number): Promise<ExecutionRecord[]>;
}

interface ScheduleDefinition {
  id: string;
  name: string;
  description?: string;
  jobType: JobType;
  trigger: ScheduleTrigger;
  priority: JobPriority;             // CRITICAL, HIGH, MEDIUM, LOW
  maxRetries: number;
  retryDelayMs: number;
  timeoutMs: number;
  dependencies?: string[];           // Other schedule IDs that must complete first
  config: Record<string, unknown>;   // Job-specific configuration
  tags: string[];                    // For filtering and grouping
  enabled: boolean;
}

type ScheduleTrigger =
  | { type: 'cron'; expression: string; timezone: string }
  | { type: 'interval'; intervalMs: number; startImmediately: boolean }
  | { type: 'oneShot'; scheduledAt: string }
  | { type: 'dependency'; sourceScheduleId: string; delayMs?: number }
  | { type: 'event'; eventType: string; filter?: Record<string, unknown> };

interface ScheduleStatus {
  id: string;
  name: string;
  state: ScheduleState;              // ACTIVE, PAUSED, FAILED, COMPLETED
  lastRunAt: string | null;
  lastRunStatus: ExecutionStatus;
  nextRunAt: string | null;
  runCount: number;
  failureCount: number;
  avgDurationMs: number;
  p95DurationMs: number;
  lastError: string | null;
}

enum ScheduleState {
  ACTIVE = 'active',
  PAUSED = 'paused',
  FAILED = 'failed',
  COMPLETED = 'completed',
  DISABLED = 'disabled',
}

enum JobPriority {
  CRITICAL = 0,    // Odds capture near kickoff
  HIGH = 1,        // Regular odds sync, result settlement
  MEDIUM = 2,      // Fixture sync, standings update
  LOW = 3,         // Data quality audit, cleanup tasks
}
```

**Scheduled Jobs (Initial Registry):**
| Job | Trigger | Priority | Description |
|-----|---------|----------|-------------|
| `fixture-sync` | Cron (daily 00:00) | MEDIUM | Sync fixtures for all active leagues |
| `odds-sync-epl` | Interval (5 min) | HIGH | Capture odds for EPL fixtures |
| `odds-sync-laliga` | Interval (5 min) | HIGH | Capture odds for La Liga fixtures |
| `odds-sync-seriea` | Interval (5 min) | HIGH | Capture odds for Serie A fixtures |
| `odds-sync-bundesliga` | Interval (5 min) | HIGH | Capture odds for Bundesliga fixtures |
| `odds-sync-ligue1` | Interval (5 min) | HIGH | Capture odds for Ligue 1 fixtures |
| `result-sync` | Cron (every 6h) | HIGH | Sync match results |
| `prediction-generate` | Dependency (on odds-sync) | HIGH | Generate predictions |
| `prediction-settle` | Event (result.available) | HIGH | Settle predictions on result |
| `data-quality-audit` | Cron (daily 06:00) | LOW | Audit data quality scores |
| `provider-health-check` | Interval (1 min) | CRITICAL | Check all provider health |
| `cleanup-raw-archive` | Cron (weekly 03:00) | LOW | Purge old raw archives |
| `db-vacuum` | Cron (weekly 04:00) | LOW | Database maintenance |

### 2. Queue Engine

**Purpose:** Multi-queue system with priority handling, retry queue, and dead letter queue. Ensures jobs are processed in order of priority and that failed jobs are retried appropriately.

```typescript
interface IQueueEngine {
  enqueue(job: Job): Promise<string>;       // Returns job ID
  enqueueBatch(jobs: Job[]): Promise<string[]>;
  dequeue(queueName?: string): Promise<Job | null>;
  acknowledge(jobId: string): Promise<void>;
  requeue(jobId: string, delayMs?: number): Promise<void>;
  sendToDLQ(jobId: string, reason: string): Promise<void>;
  getQueueDepth(queueName?: string): Promise<number>;
  getDLQCount(): Promise<number>;
  getQueueMetrics(): Promise<QueueMetrics>;
}

interface Job {
  id: string;                              // jb_xxxxxx
  type: JobType;
  priority: JobPriority;
  status: JobStatus;
  payload: Record<string, unknown>;
  metadata: JobMetadata;
  createdAt: string;
  scheduledAt: string;
  startedAt: string | null;
  completedAt: string | null;
  retryCount: number;
  maxRetries: number;
  lastError: string | null;
  parentJobId: string | null;              // For workflow tracking
  tags: string[];
}

interface JobMetadata {
  source: string;                           // "scheduler", "api", "manual"
  scheduleId?: string;
  correlationId: string;                    // For tracing across jobs
  createdBy: string;
  version: string;
}

enum JobStatus {
  QUEUED = 'queued',
  SCHEDULED = 'scheduled',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying',
  CANCELLED = 'cancelled',
  DLQ = 'dead_letter',
}

enum JobType {
  FIXTURE_SYNC = 'fixture_sync',
  ODDS_SYNC = 'odds_sync',
  RESULT_SYNC = 'result_sync',
  PREDICTION_GENERATE = 'prediction_generate',
  PREDICTION_SETTLE = 'prediction_settle',
  DATA_QUALITY_AUDIT = 'data_quality_audit',
  PROVIDER_HEALTH_CHECK = 'provider_health_check',
  CLEANUP = 'cleanup',
  MAINTENANCE = 'maintenance',
  ALERT = 'alert',
  NOTIFICATION = 'notification',
  CUSTOM = 'custom',
}

interface QueueMetrics {
  queues: QueueDetail[];
  totalQueued: number;
  totalRunning: number;
  totalCompleted24h: number;
  totalFailed24h: number;
  totalDLQ: number;
  avgWaitTimeMs: number;
  avgProcessingTimeMs: number;
  throughputPerMinute: number;
}
```

**Queue Architecture:**
```
                    ┌──────────────┐
                    │  Incoming Job │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  Router      │ ← Routes by priority + type
                    └──────┬───────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
   ┌────────────┐   ┌────────────┐   ┌────────────┐
   │ Critical Q │   │  High Q    │   │ Medium Q    │
   │ (priority 0)│   │ (priority 1)│   │ (priority 2)│
   └──────┬─────┘   └──────┬─────┘   └──────┬─────┘
          │                │                │
          └────────────────┼────────────────┘
                           ▼
                    ┌──────────────┐
                    │  Worker Pool │
                    │  (consumes    │
                    │   priority    │
                    │   order)      │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ Complete  │ │  Retry   │ │   DLQ    │
        │ (success) │ │ (with    │ │ (failed   │
        │           │ │  backoff)│ │  > retry) │
        └──────────┘ └──────────┘ └──────────┘
```

### 3. Worker Pool

**Purpose:** Managed pool of workers that process queue jobs. Supports dynamic scaling, health checking, graceful shutdown, and concurrency control.

```typescript
interface IWorkerPool {
  start(): Promise<void>;
  stop(): Promise<void>;
  scaleTo(count: number): Promise<void>;
  getStatus(): WorkerPoolStatus;
  getWorkerMetrics(): WorkerMetrics;
  getWorkerDetails(): WorkerDetail[];
  pauseWorker(workerId: string): Promise<void>;
  resumeWorker(workerId: string): Promise<void>;
}

interface WorkerPoolConfig {
  minWorkers: number;                  // Default: 2
  maxWorkers: number;                  // Default: 10
  idleTimeoutMs: number;               // Default: 60_000
  pollIntervalMs: number;              // Default: 100
  maxConcurrencyPerWorker: number;     // Default: 5
  healthCheckIntervalMs: number;       // Default: 30_000
  gracefulShutdownTimeoutMs: number;   // Default: 30_000
  scaling: ScalingConfig;
}

interface ScalingConfig {
  enabled: boolean;
  metric: ScalingMetric;              // QUEUE_DEPTH, CPU_USAGE, LATENCY
  scaleUpThreshold: number;           // e.g., queue depth > 100
  scaleDownThreshold: number;         // e.g., queue depth < 10
  cooldownMs: number;                  // Min time between scaling events
  maxScaleUpPerMinute: number;        // Prevent rapid scaling
}

interface WorkerDetail {
  id: string;
  status: WorkerStatus;               // IDLE, BUSY, PAUSED, STOPPED, ERROR
  startedAt: string;
  currentJobId: string | null;
  jobsProcessed: number;
  jobsFailed: number;
  avgProcessingTimeMs: number;
  memoryUsageMb: number;
  cpuUsagePercent: number;
  lastHealthCheck: string;
  lastError: string | null;
}

enum WorkerStatus {
  IDLE = 'idle',
  BUSY = 'busy',
  PAUSED = 'paused',
  STOPPED = 'stopped',
  ERROR = 'error',
}

interface WorkerMetrics {
  activeWorkers: number;
  idleWorkers: number;
  totalJobsProcessed: number;
  totalJobsFailed: number;
  avgProcessingTimeMs: number;
  p95ProcessingTimeMs: number;
  p99ProcessingTimeMs: number;
  throughputPerMinute: number;
  workerUtilizationPercent: number;
}
```

**Worker Lifecycle:**
```
Created → Idle → Assigned Job → Busy Processing
                                  ↓
                            ┌─────┴─────┐
                            ▼           ▼
                         Success     Failure
                            │           │
                            ▼           ├── Retry available → Requeue
                         Idle          │
                                        ├── No retries → DLQ
                                        │
                                        ▼
                                     Idle/Error
```

### 4. Retry Queue

**Purpose:** Dedicated queue for retrying failed jobs. Implements exponential backoff and configurable max retry count.

```typescript
interface IRetryQueue {
  scheduleRetry(job: Job, delayMs: number): Promise<void>;
  processRetries(): Promise<number>;     // Returns number of requeued jobs
  getRetryMetrics(): RetryMetrics;
  getPendingRetries(): RetryJobInfo[];
  cancelRetry(jobId: string): Promise<void>;
}

interface RetryJobInfo {
  jobId: string;
  originalQueue: string;
  retryCount: number;
  maxRetries: number;
  nextRetryAt: string;
  delayMs: number;
  lastError: string;
  createdAt: string;
}

interface RetryMetrics {
  pendingRetries: number;
  avgRetryDelayMs: number;
  retrySuccessRate: number;             // % of retries that succeed
  avgRetriesPerJob: number;
  maxRetriesObserved: number;
}
```

**Retry Backoff Strategy:**
```
Attempt 0: initial execution
Attempt 1: delay = 1 second
Attempt 2: delay = 2 seconds
Attempt 3: delay = 4 seconds
Attempt 4: delay = 8 seconds
...
Attempt N: delay = min(maxDelay, baseDelay * 2^attempt) + jitter

Default: maxRetries = 3, baseDelay = 1s, maxDelay = 60s
```

### 5. Dead Letter Queue (DLQ)

**Purpose:** Holds jobs that have exhausted all retries. Prevents infinite retry loops and preserves failed jobs for analysis.

```typescript
interface IDeadLetterQueue {
  send(job: Job, reason: string): Promise<void>;
  list(filter?: DLQFilter): Promise<DLQEntry[]>;
  replay(jobId: string): Promise<void>;
  replayBatch(jobIds: string[]): Promise<void>;
  purge(before: string): Promise<number>;
  getDLQStats(): DLQStats;
}

interface DLQEntry {
  job: Job;
  reason: string;
  failedAt: string;
  failedAfterAttempts: number;
  errorHistory: ErrorRecord[];
  originalQueue: string;
  correlationId: string;
}

interface ErrorRecord {
  attempt: number;
  timestamp: string;
  error: string;
  stackTrace: string;
}

interface DLQStats {
  totalEntries: number;
  oldestEntry: string | null;
  newestEntry: string | null;
  topErrorTypes: { error: string; count: number }[];
  replayCount24h: number;
  purgeCount24h: number;
}
```

**DLQ Retention Policy:**
- Keep entries for 30 days
- Auto-purge entries older than 30 days
- Alert when DLQ count exceeds threshold (default: 100)
- Weekly manual review recommended

### 6. Job Registry

**Purpose:** Complete lifecycle tracking for every job that runs in the system. Provides job history, execution timeline, and lookup capabilities.

```typescript
interface IJobRegistry {
  createJobRecord(job: Job): Promise<JobRecord>;
  updateJobStatus(jobId: string, status: JobStatus, details?: Partial<JobRecord>): Promise<void>;
  getJob(jobId: string): Promise<JobRecord | null>;
  findJobs(filter: JobFilter): Promise<JobRecord[]>;
  getJobHistory(jobId: string): Promise<ExecutionRecord[]>;
  getJobTimeline(jobId: string): Promise<JobTimeline>;
  getJobStats(timeRange: TimeRange): Promise<JobStats>;
}

interface JobRecord {
  id: string;
  type: JobType;
  status: JobStatus;
  priority: JobPriority;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  retryCount: number;
  maxRetries: number;
  workerId: string | null;
  scheduleId: string | null;
  parentJobId: string | null;
  correlationId: string;
  tags: string[];
  metadata: Record<string, unknown>;
}

interface JobTimeline {
  jobId: string;
  entries: TimelineEntry[];
  totalDurationMs: number;
  workerDurationMs: number;
  queueWaitMs: number;
  retryDelayMs: number;
}

interface TimelineEntry {
  timestamp: string;
  event: string;                       // "created", "queued", "started", "retrying", "completed", "failed"
  detail: string;
  durationMs?: number;
}

interface JobStats {
  totalJobs: number;
  byStatus: Record<JobStatus, number>;
  byType: Record<JobType, number>;
  avgDurationMs: number;
  p50DurationMs: number;
  p95DurationMs: number;
  p99DurationMs: number;
  successRate: number;
  failureRate: number;
  throughputPerMinute: number;
}
```

### 7. Distributed Lock

**Purpose:** Prevent concurrent execution of the same job across multiple workers. Critical for single-instance jobs (e.g., fixture sync, database migrations).

```typescript
interface IDistributedLock {
  acquire(lockKey: string, ttlMs: number, options?: LockOptions): Promise<Lock | null>;
  release(lock: Lock): Promise<void>;
  extend(lock: Lock, ttlMs: number): Promise<boolean>;
  isLocked(lockKey: string): Promise<boolean>;
  getLockInfo(lockKey: string): Promise<LockInfo | null>;
  forceRelease(lockKey: string, fencingToken: string): Promise<void>;
}

interface Lock {
  lockKey: string;
  fencingToken: string;                // Unique per lock acquisition
  acquiredAt: string;
  ttlMs: number;
  owner: string;                       // Worker/host identifier
}

interface LockOptions {
  retryCount?: number;                 // How many times to retry if locked
  retryDelayMs?: number;               // Wait between retries
  stealIfExpired?: boolean;            // Take lock if TTL expired
}

interface LockInfo {
  lockKey: string;
  owner: string;
  acquiredAt: string;
  expiresAt: string;
  isExpired: boolean;
  fencingToken: string;
}
```

**Lock Usage Pattern:**
```typescript
const lock = await lockService.acquire('fixture-sync-epl', 300_000); // 5 min TTL
if (lock) {
  try {
    await executeFixtureSync('EPL');
    // Periodically extend lock for long operations
    await lockService.extend(lock, 300_000);
  } finally {
    await lockService.release(lock);
  }
}
```

### 8. Task Prioritization

**Purpose:** Ensure critical jobs are processed before non-critical ones, even if they arrived later.

```typescript
interface IPriorityManager {
  setPriority(jobId: string, priority: JobPriority): Promise<void>;
  getSchedulePriority(scheduleId: string): JobPriority;
  calculateEffectivePriority(job: Job): Promise<number>;  // Base priority + urgency boost
  getPriorityQueueDepth(priority: JobPriority): Promise<number>;
  getPriorityDistribution(): Promise<Record<JobPriority, number>>;
}
```

**Priority Boost Rules:**
- Jobs near kickoff time get +1 priority boost
- Jobs that have been waiting longer than threshold get +1 priority boost
- Failed jobs on retry get original priority (no boost)
- DLQ replay jobs get +1 priority boost

### 9. Background Processing

**Purpose:** Handle long-running, non-blocking tasks that don't need immediate execution.

```typescript
interface IBackgroundProcessor {
  submit(task: BackgroundTask): Promise<string>;
  getStatus(taskId: string): Promise<TaskStatus>;
  cancel(taskId: string): Promise<void>;
  getProgress(taskId: string): Promise<TaskProgress>;
  listActiveTasks(): Promise<BackgroundTask[]>;
}

interface BackgroundTask {
  id: string;
  type: string;
  handler: string;                     // Registered handler name
  params: Record<string, unknown>;
  priority: TaskPriority;
  timeoutMs: number;
  retryOnFailure: boolean;
}

interface TaskStatus {
  id: string;
  state: TaskState;                    // PENDING, RUNNING, COMPLETED, FAILED, CANCELLED
  progress: number;                    // 0–100
  startedAt: string | null;
  completedAt: string | null;
  result: unknown | null;
  error: string | null;
  workerId: string | null;
}

enum TaskPriority {
  FOREGROUND = 'foreground',           // User-facing, < 30s
  BACKGROUND = 'background',           // System task, < 5min
  BATCH = 'batch',                     // Bulk operation, < 60min
  MAINTENANCE = 'maintenance',         // Housekeeping, no SLA
}
```

**Background Task Handlers:**
| Handler | Description | Timeout |
|---------|-------------|---------|
| `bulk-prediction-generate` | Generate predictions for all pending fixtures | 30 min |
| `bulk-prediction-settle` | Settle all pending predictions | 30 min |
| `data-audit-full` | Full data quality audit across all records | 60 min |
| `report-generate` | Generate operational report | 10 min |
| `export-dataset` | Export dataset for analysis | 30 min |
| `archive-rotation` | Rotate and compress archives | 30 min |

### 10. Cron Management

**Purpose:** Centralized management of all cron schedules with health checking, overlap prevention, and audit.

```typescript
interface ICronManager {
  addJob(schedule: CronSchedule): Promise<void>;
  removeJob(jobName: string): Promise<void>;
  listJobs(): Promise<CronJobInfo[]>;
  getJobLogs(jobName: string, limit?: number): Promise<CronLogEntry[]>;
  pauseJob(jobName: string): Promise<void>;
  resumeJob(jobName: string): Promise<void>;
  triggerJob(jobName: string): Promise<void>;
  getCronHealth(): Promise<CronHealth>;
  detectOverlaps(): Promise<CronOverlapReport>;
}

interface CronSchedule {
  name: string;
  expression: string;                  // Cron expression
  timezone: string;                    // Default: UTC
  description: string;
  handler: string;                     // Registered handler
  maxConcurrentRuns: number;           // 0 = unlimited, 1 = prevent overlap
  enabled: boolean;
  notifyOnFailure: boolean;
  notifyOnMiss: boolean;               // Alert if scheduled run was skipped
}

interface CronJobInfo {
  name: string;
  expression: string;
  timezone: string;
  enabled: boolean;
  lastRunAt: string | null;
  lastRunDuration: string | null;
  lastRunStatus: ExecutionStatus;
  nextRunAt: string | null;
  runCount: number;
  failureCount: number;
  avgDurationMs: number;
}

interface CronHealth {
  totalJobs: number;
  activeJobs: number;
  pausedJobs: number;
  failedJobs: number;
  missedRuns24h: number;
  avgSchedulingLatencyMs: number;
}
```

### 11. Health Check

**Purpose:** System-wide health monitoring. Each component reports its health, and the health check aggregates them into a system health status.

```typescript
interface IHealthCheck {
  register(component: HealthComponent): void;
  unregister(componentName: string): void;
  checkAll(): Promise<SystemHealth>;
  checkComponent(name: string): Promise<ComponentHealth>;
  getHealthHistory(componentName: string, hours: number): Promise<HealthSnapshot[]>;
  getDegradedComponents(): Promise<ComponentHealth[]>;
}

interface SystemHealth {
  status: HealthStatus;                // HEALTHY, DEGRADED, CRITICAL, DOWN
  timestamp: string;
  uptime: number;                      // Seconds since last critical
  components: ComponentHealth[];
  summary: string;
}

interface ComponentHealth {
  name: string;
  status: HealthStatus;
  lastCheck: string;
  responseTimeMs: number;
  details: Record<string, unknown>;
  lastFailure: string | null;
  consecutiveFailures: number;
}

type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'DOWN';
```

**Registered Health Components:**
| Component | Check Method | Interval |
|-----------|-------------|----------|
| Database | Ping query | 30s |
| Queue Engine | Depth check | 15s |
| Worker Pool | Worker status | 15s |
| Provider Registry | Provider health (aggregated) | 30s |
| Scheduler Engine | Last run time | 30s |
| Cache | Ping | 30s |
| File System | Write test | 60s |
| Memory | Usage % | 30s |
| CPU | Load average | 30s |
| Disk | Space remaining | 60s |

### 12. Alert Engine

**Purpose:** Rule-based alerting system. Evaluates conditions against metrics and triggers alerts when thresholds are breached.

```typescript
interface IAlertEngine {
  registerRule(rule: AlertRule): Promise<string>;
  unregisterRule(ruleId: string): Promise<void>;
  evaluateAll(): Promise<AlertEvaluationResult[]>;
  evaluateRule(ruleId: string): Promise<AlertEvaluationResult>;
  acknowledgeAlert(alertId: string, userId: string): Promise<void>;
  resolveAlert(alertId: string): Promise<void>;
  getActiveAlerts(): Promise<Alert[]>;
  getAlertHistory(filter?: AlertFilter): Promise<Alert[]>;
  getAlertStats(timeRange: TimeRange): Promise<AlertStats>;
}

interface AlertRule {
  id: string;
  name: string;
  description: string;
  severity: AlertSeverity;            // INFO, WARNING, CRITICAL, EMERGENCY
  condition: AlertCondition;
  evaluationIntervalMs: number;
  cooldownMs: number;                  // Min time between alerts for same rule
  enabled: boolean;
  autoResolveAfterMs: number | null;   // Auto-resolve if condition clears
  escalationDelayMs: number;           // Escalate if not acknowledged in time
  notifyChannels: NotificationChannel[];
}

type AlertCondition =
  | { type: 'threshold'; metric: string; operator: '>' | '<' | '>=' | '<=' | '==' | '!='; value: number; window: string }
  | { type: 'rate'; metric: string; ratePerMinute: number; window: string }
  | { type: 'missing'; metric: string; missingSince: string }
  | { type: 'composite'; conditions: AlertCondition[]; logic: 'AND' | 'OR' }
  | { type: 'custom'; evaluator: string };       // Custom evaluation function name

interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: AlertSeverity;
  status: AlertStatus;                // FIRING, ACKNOWLEDGED, RESOLVED, ESCALATED
  message: string;
  details: Record<string, unknown>;
  firedAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  escalatedAt: string | null;
  value: number;
  threshold: number;
  component: string;
}
```

**Alert Rules (Initial):**
| Rule | Condition | Severity | Cooldown |
|------|-----------|----------|----------|
| Provider Down | Provider health = DOWN | CRITICAL | 5 min |
| Provider Slow | Latency > 2000ms for 5 min | WARNING | 10 min |
| High Latency | P95 latency > 5000ms | CRITICAL | 5 min |
| Queue Backlog | Queue depth > 1000 | WARNING | 5 min |
| Queue Critical | Queue depth > 5000 | CRITICAL | 2 min |
| DLQ Overflow | DLQ count > 100 | WARNING | 30 min |
| Prediction Failure | Failure rate > 10% in 1h | WARNING | 15 min |
| Database Down | Database health = DOWN | EMERGENCY | 1 min |
| Scheduler Miss | Schedule missed > 5 in 1h | WARNING | 15 min |
| Worker Crash | Workers < minWorkers | CRITICAL | 2 min |
| Memory High | Memory usage > 85% | WARNING | 5 min |
| Memory Critical | Memory usage > 95% | CRITICAL | 2 min |
| Disk Space Low | Disk usage > 80% | WARNING | 30 min |
| Disk Space Critical | Disk usage > 95% | CRITICAL | 5 min |

### 13. Notification Engine

**Purpose:** Deliver alerts and notifications through multiple channels with rate limiting and template support.

```typescript
interface INotificationEngine {
  send(notification: Notification): Promise<string>;
  sendBatch(notifications: Notification[]): Promise<string[]>;
  registerChannel(channel: NotificationChannel): void;
  getDeliveryStatus(notificationId: string): Promise<DeliveryStatus>;
  getChannelHealth(channel: ChannelType): Promise<ChannelHealth>;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  channel: NotificationChannel;
  template?: string;                   // Template name for formatting
  templateData?: Record<string, unknown>;
  source: string;                      // "alert-engine", "system", "manual"
  correlationId: string;
  metadata: Record<string, unknown>;
  scheduledAt: string | null;          // For delayed delivery
}

interface NotificationChannel {
  type: ChannelType;
  enabled: boolean;
  config: ChannelConfig;
  rateLimit: { maxPerMinute: number; maxPerHour: number };
  health: ChannelHealth;
}

type ChannelType = 'email' | 'slack' | 'webhook' | 'push' | 'sms' | 'pagerduty';

interface ChannelConfig {
  // Email
  recipients?: string[];
  from?: string;
  
  // Slack
  webhookUrl?: string;
  channel?: string;
  botName?: string;
  
  // Webhook
  url?: string;
  headers?: Record<string, string>;
  
  // Push
  deviceTokens?: string[];
  
  // SMS
  phoneNumbers?: string[];
  
  // PagerDuty
  serviceKey?: string;
  routingKey?: string;
}

enum DeliveryStatus {
  PENDING = 'pending',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  RATE_LIMITED = 'rate_limited',
  SUPPRESSED = 'suppressed',
}

interface ChannelHealth {
  type: ChannelType;
  enabled: boolean;
  lastDeliveryAt: string | null;
  lastFailureAt: string | null;
  totalSent24h: number;
  totalFailed24h: number;
  successRate: number;
  rateLimitRemaining: number;
}
```

### 14. Incident Report

**Purpose:** Auto-generated incident reports that capture the full timeline, root cause, and affected components.

```typescript
interface IIncidentReporter {
  createFromAlert(alert: Alert): Promise<IncidentReport>;
  createManual(summary: string, severity: AlertSeverity): Promise<IncidentReport>;
  updateReport(incidentId: string, updates: Partial<IncidentReport>): Promise<void>;
  resolveIncident(incidentId: string, resolution: string): Promise<void>;
  getReport(incidentId: string): Promise<IncidentReport>;
  listReports(filter?: IncidentFilter): Promise<IncidentReport[]>;
  generateSummary(incidentId: string): Promise<string>;
}

interface IncidentReport {
  id: string;                          // inc_xxxxx
  title: string;
  severity: AlertSeverity;
  status: IncidentStatus;              // OPEN, INVESTIGATING, MITIGATED, RESOLVED, CLOSED
  createdAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  duration: number | null;             // Time to resolve (seconds)
  affectedComponents: string[];
  timeline: IncidentTimelineEntry[];
  rootCause: string | null;
  resolution: string | null;
  relatedAlerts: string[];             // Alert IDs
  relatedJobs: string[];               // Job IDs
  metrics: IncidentMetrics;
  postmortem: Postmortem | null;
}

interface IncidentTimelineEntry {
  timestamp: string;
  event: string;
  detail: string;
  source: string;
}

interface IncidentMetrics {
  timeToDetectSeconds: number;
  timeToAckSeconds: number;
  timeToMitigateSeconds: number;
  timeToResolveSeconds: number;
  totalAffectedRecords: number;
  totalMissedSyncs: number;
}

interface Postmortem {
  summary: string;
  whatWentWrong: string[];
  whatWentWell: string[];
  actionItems: ActionItem[];
  lessonsLearned: string[];
}

interface ActionItem {
  id: string;
  description: string;
  owner: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED';
  dueDate: string;
}
```

### 15. Audit Trail

**Purpose:** Immutable, tamper-evident log of every operation in the system.

```typescript
interface IAuditTrail {
  record(entry: AuditEntry): Promise<string>;
  getEntry(entryId: string): Promise<AuditEntry>;
  query(filter: AuditFilter): Promise<AuditEntry[]>;
  verifyChain(from: string, to: string): Promise<ChainVerification>;
  export(format: 'json' | 'csv'): Promise<ReadableStream>;
  getStats(): Promise<AuditStats>;
}

interface AuditEntry {
  id: string;                          // aud_xxxxx
  timestamp: string;
  action: AuditAction;
  actor: AuditActor;
  resource: AuditResource;
  details: Record<string, unknown>;    // Action-specific details
  previousHash: string;                // SHA-256 of previous entry (chain)
  hash: string;                        // SHA-256 of this entry
  signature: string | null;            // Optional digital signature
  version: number;
  correlationId: string;
}

type AuditAction =
  | { type: 'CREATE'; target: string }
  | { type: 'UPDATE'; target: string; changes: Record<string, unknown> }
  | { type: 'DELETE'; target: string }
  | { type: 'READ'; target: string }
  | { type: 'EXECUTE'; target: string; result: string }
  | { type: 'FAIL'; target: string; error: string }
  | { type: 'CONFIG_CHANGE'; target: string; oldValue: unknown; newValue: unknown };

interface AuditActor {
  type: 'USER' | 'SYSTEM' | 'SCHEDULER' | 'WORKER' | 'API';
  id: string;
  name: string;
  ip?: string;
  userAgent?: string;
}

interface AuditResource {
  type: string;                        // "fixture", "odds", "job", "schedule", "prediction"
  id: string;
  name: string;
  parentType?: string;
  parentId?: string;
}

interface ChainVerification {
  valid: boolean;
  entriesChecked: number;
  firstEntry: string;
  lastEntry: string;
  brokenAt: string | null;
}
```

**Audit Events Captured (Complete List):**
| Action Type | Events |
|-------------|--------|
| CREATE | Fixture created, odds snapshot taken, prediction generated, job created, schedule created, config created |
| UPDATE | Fixture status changed, odds updated, prediction updated, schedule modified, config changed |
| DELETE | Fixture removed, odds purged, schedule removed, expired data purged |
| EXECUTE | Job started, job completed, scheduler triggered, worker assigned, health check ran |
| FAIL | Job failed, provider error, scheduler miss, queue overflow, alert fired |
| CONFIG_CHANGE | Provider added/removed, threshold changed, schedule modified, rate limit changed |

### 16. Execution Metrics

**Purpose:** Track detailed execution metrics for every job, worker, and schedule.

```typescript
interface IExecutionMetrics {
  recordJobExecution(jobId: string, metrics: JobExecutionMetrics): Promise<void>;
  recordWorkerMetric(workerId: string, metrics: WorkerExecutionMetrics): Promise<void>;
  recordScheduleMetric(scheduleId: string, metrics: ScheduleExecutionMetrics): Promise<void>;
  getJobMetrics(jobId: string): Promise<JobExecutionMetrics>;
  getAggregatedMetrics(timeRange: TimeRange, groupBy?: string): Promise<AggregatedMetrics>;
  getHeatmapData(timeRange: TimeRange): Promise<HeatmapData>;
  getMetricTrend(metric: string, timeRange: TimeRange, granularity: string): Promise<TrendData>;
}

interface JobExecutionMetrics {
  jobId: string;
  type: JobType;
  status: JobStatus;
  queueWaitMs: number;
  processingTimeMs: number;
  totalDurationMs: number;
  retryCount: number;
  workerId: string | null;
  memoryDeltaMb: number;               // Memory change during execution
  cpuDeltaPercent: number;             // CPU change during execution
  ioBytes: number;                     // I/O during execution
  dbQueries: number;
  apiCalls: number;
  apiCallsFailed: number;
  startedAt: string;
  completedAt: string;
}

interface AggregatedMetrics {
  timeRange: TimeRange;
  totalJobs: number;
  successCount: number;
  failureCount: number;
  avgQueueWaitMs: number;
  avgProcessingTimeMs: number;
  p50ProcessingTimeMs: number;
  p95ProcessingTimeMs: number;
  p99ProcessingTimeMs: number;
  throughputPerMinute: number;
  successRate: number;
  avgRetriesPerJob: number;
  totalApiCalls: number;
  totalDbQueries: number;
}
```

### 17. Performance Profiling

**Purpose:** Identify slow code paths, hot spots, and bottlenecks in the system.

```typescript
interface IPerformanceProfiler {
  startProfile(label: string): ProfileContext;
  endProfile(context: ProfileContext): ProfileResult;
  getProfileSummary(timeRange: TimeRange): Promise<ProfileSummary>;
  getHotPaths(timeRange: TimeRange, topN: number): Promise<HotPath[]>;
  getPerformanceReport(timeRange: TimeRange): Promise<PerformanceReport>;
  detectBottlenecks(timeRange: TimeRange): Promise<Bottleneck[]>;
}

interface ProfileContext {
  id: string;
  label: string;
  startedAt: string;
  metadata: Record<string, unknown>;
}

interface ProfileResult {
  context: ProfileContext;
  endedAt: string;
  durationMs: number;
  memoryStartMb: number;
  memoryEndMb: number;
  allocationCount: number;
  gcPausesMs: number;
  asyncContextSwitches: number;
}

interface HotPath {
  label: string;
  totalDurationMs: number;
  callCount: number;
  avgDurationMs: number;
  p95DurationMs: number;
  percentageOfTotalTime: number;
}

interface Bottleneck {
  component: string;
  metric: string;
  currentValue: number;
  threshold: number;
  impact: string;
  recommendation: string;
}
```

### 18. Resource Monitoring

**Purpose:** Monitor system resources across all components.

```typescript
interface IResourceMonitor {
  startMonitoring(intervalMs?: number): Promise<void>;
  stopMonitoring(): Promise<void>;
  getCurrentUsage(): Promise<ResourceUsage>;
  getHistory(timeRange: TimeRange): Promise<ResourceHistory>;
  getPrediction(hours: number): Promise<ResourceForecast>;
  setThresholds(thresholds: ResourceThresholds): void;
  getResourceReport(timeRange: TimeRange): Promise<ResourceReport>;
}

interface ResourceUsage {
  timestamp: string;
  cpu: {
    overallPercent: number;
    perCore: number[];
    loadAverage1m: number;
    loadAverage5m: number;
    loadAverage15m: number;
  };
  memory: {
    totalMb: number;
    usedMb: number;
    freeMb: number;
    cachedMb: number;
    buffersMb: number;
    swapUsedMb: number;
    swapTotalMb: number;
  };
  disk: {
    mounts: DiskUsage[];
    totalReadBytes: number;
    totalWriteBytes: number;
    iops: number;
  };
  network: {
    interfaces: NetworkUsage[];
    totalBytesIn: number;
    totalBytesOut: number;
    connectionsCount: number;
  };
  process: {
    pid: number;
    name: string;
    cpuPercent: number;
    memoryMb: number;
    threads: number;
    openFiles: number;
    uptimeSeconds: number;
  };
}

interface ResourceThresholds {
  cpuWarningPercent: number;           // Default: 80
  cpuCriticalPercent: number;          // Default: 95
  memoryWarningPercent: number;        // Default: 80
  memoryCriticalPercent: number;       // Default: 95
  diskWarningPercent: number;          // Default: 80
  diskCriticalPercent: number;         // Default: 95
  diskIOPSWarning: number;             // Default: 1000
  diskIOPSCritical: number;            // Default: 5000
  networkWarningBps: number;
  networkCriticalBps: number;
}
```

---

## Job Lifecycle (Complete)

```
                          ┌──────────────────┐
                          │   Job Created     │
                          │   (status: queued)│
                          └────────┬─────────┘
                                   │
                                   ▼
                          ┌──────────────────┐
                          │   Enqueued        │
                          │                   │
                          └────────┬─────────┘
                                   │
                                   ▼
                          ┌──────────────────┐
                    ─────►│   Dequeued        │
                   │      │   (status: running)│
                   │      └────────┬─────────┘
                   │               │
                   │               ▼
                   │      ┌──────────────────┐
                   │      │   Processing      │
                   │      │                   │
                   │      └────────┬─────────┘
                   │         ┌─────┴─────┐
                   │         ▼           ▼
                   │   ┌──────────┐ ┌──────────┐
                   │   │ Success  │ │ Failure  │
                   │   └────┬─────┘ └────┬─────┘
                   │        │            │
                   │        ▼            ├──────────────┐
                   │  ┌──────────┐      ▼              ▼
                   │  │Completed │  ┌──────────┐ ┌──────────┐
                   │  │(archived)│  │ Retry    │ │ DLQ      │
                   │  └──────────┘  │ (if ≤    │ │ (if >    │
                   │                │  maxRetry)│ │  maxRetry)│
                   │                └────┬─────┘ └──────────┘
                   │                     │
                   └─────────────────────┘
```

---

## Test Requirements

### Unit Tests
| Module | Test Cases | Coverage |
|--------|------------|----------|
| Scheduler Engine | Schedule registration, cron parsing, trigger evaluation, dependency resolution | 95% |
| Queue Engine | Enqueue, dequeue, priority ordering, batch operations | 95% |
| Worker Pool | Scaling, health check, graceful shutdown, concurrency | 95% |
| Retry Queue | Backoff timing, max retries, cancellation | 100% |
| Dead Letter Queue | Send, replay, purge, stats | 100% |
| Job Registry | CRUD, history, timeline, filtering | 95% |
| Distributed Lock | Acquire, release, extend, fencing, expiration | 100% |
| Priority Manager | Priority calculation, boost rules | 95% |
| Background Processing | Submit, status, cancel, progress | 95% |
| Cron Management | Add, remove, overlap detection, health | 95% |
| Health Check | Component registration, aggregation, history | 95% |
| Alert Engine | Rule evaluation, threshold conditions, cooldown, escalation | 100% |
| Notification Engine | Channel delivery, rate limiting, templates | 95% |
| Incident Report | Creation, timeline, postmortem | 95% |
| Audit Trail | Recording, chain verification, export | 100% |
| Execution Metrics | Recording, aggregation, trends | 95% |
| Performance Profiler | Profiling, hot path detection, bottlenecks | 95% |
| Resource Monitor | Monitoring, thresholds, forecasting | 95% |

### Integration Tests
- End-to-end: Schedule → Queue → Worker → Complete
- Retry flow: Job fails → Retry queue → Re-execute → Complete
- DLQ flow: Job fails all retries → DLQ → Replay → Complete
- Distributed lock: Two workers attempt same lock → Only one acquires
- Alert flow: Threshold breached → Alert fires → Notification sent → Acknowledged → Resolved
- Audit chain: Multiple records → Chain verification passes
- Worker scaling: Queue depth increases → Workers scale up → Scale down when cleared

### Stress Tests
| Scenario | Load | Expected |
|----------|------|----------|
| Queue burst | 10,000 jobs in 1 minute | Process within 5 minutes |
| Worker scaling | 100→1000 queue depth | Scale from 2→20 workers |
| Alert storm | 100 alerts firing simultaneously | Rate limiting prevents flood |
| Resource spike | 95% CPU for 5 minutes | Alert fires, no crash |
| Concurrent locks | 50 workers trying same lock | Only 1 acquires, others wait |

---

## Performance Targets

| Operation | Target (p50) | Target (p95) | Max |
|-----------|--------------|--------------|-----|
| Job enqueue | < 5ms | < 20ms | 50ms |
| Job dequeue | < 5ms | < 10ms | 30ms |
| Schedule evaluation | < 10ms | < 50ms | 100ms |
| Lock acquire (uncontested) | < 10ms | < 30ms | 50ms |
| Lock acquire (contested) | < 100ms | < 500ms | 1000ms |
| Alert evaluation | < 50ms | < 200ms | 500ms |
| Notification delivery (email) | < 1s | < 5s | 10s |
| Notification delivery (slack) | < 500ms | < 2s | 5s |
| Audit record | < 10ms | < 30ms | 50ms |
| Audit chain verify (1000 entries) | < 100ms | < 500ms | 1000ms |
| Health check (all components) | < 500ms | < 2s | 5s |
| Metrics aggregation (24h) | < 1s | < 5s | 10s |

---

## Directory Structure

```
src/
├── operations/
│   ├── interfaces/
│   │   ├── ISchedulerEngine.ts
│   │   ├── IQueueEngine.ts
│   │   ├── IWorkerPool.ts
│   │   ├── IRetryQueue.ts
│   │   ├── IDeadLetterQueue.ts
│   │   ├── IJobRegistry.ts
│   │   ├── IDistributedLock.ts
│   │   ├── IPriorityManager.ts
│   │   ├── IBackgroundProcessor.ts
│   │   ├── ICronManager.ts
│   │   ├── IHealthCheck.ts
│   │   ├── IAlertEngine.ts
│   │   ├── INotificationEngine.ts
│   │   ├── IIncidentReporter.ts
│   │   ├── IAuditTrail.ts
│   │   ├── IExecutionMetrics.ts
│   │   ├── IPerformanceProfiler.ts
│   │   └── IResourceMonitor.ts
│   ├── scheduler/
│   │   ├── SchedulerEngine.ts
│   │   └── CronManager.ts
│   ├── queue/
│   │   ├── QueueEngine.ts
│   │   ├── RetryQueue.ts
│   │   └── DeadLetterQueue.ts
│   ├── worker/
│   │   ├── WorkerPool.ts
│   │   └── BackgroundProcessor.ts
│   ├── registry/
│   │   └── JobRegistry.ts
│   ├── lock/
│   │   └── DistributedLock.ts
│   ├── priority/
│   │   └── PriorityManager.ts
│   ├── monitoring/
│   │   ├── HealthCheck.ts
│   │   ├── ResourceMonitor.ts
│   │   ├── ExecutionMetrics.ts
│   │   └── PerformanceProfiler.ts
│   ├── alert/
│   │   ├── AlertEngine.ts
│   │   └── IncidentReporter.ts
│   ├── notify/
│   │   └── NotificationEngine.ts
│   ├── audit/
│   │   └── AuditTrail.ts
│   ├── types/
│   │   ├── Job.ts
│   │   ├── Schedule.ts
│   │   ├── Alert.ts
│   │   └── enums.ts
│   └── __tests__/
│       ├── SchedulerEngine.test.ts
│       ├── QueueEngine.test.ts
│       ├── WorkerPool.test.ts
│       ├── RetryQueue.test.ts
│       ├── DeadLetterQueue.test.ts
│       ├── JobRegistry.test.ts
│       ├── DistributedLock.test.ts
│       ├── PriorityManager.test.ts
│       ├── BackgroundProcessor.test.ts
│       ├── CronManager.test.ts
│       ├── HealthCheck.test.ts
│       ├── AlertEngine.test.ts
│       ├── NotificationEngine.test.ts
│       ├── IncidentReporter.test.ts
│       ├── AuditTrail.test.ts
│       ├── ExecutionMetrics.test.ts
│       ├── PerformanceProfiler.test.ts
│       └── ResourceMonitor.test.ts
```

---

## Data Model (Database Tables)

```sql
-- Schedules
CREATE TABLE operations_schedules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  job_type TEXT NOT NULL,
  trigger_type TEXT NOT NULL,           -- cron, interval, oneShot, dependency, event
  trigger_config JSONB NOT NULL,
  priority INTEGER NOT NULL DEFAULT 2,
  max_retries INTEGER NOT NULL DEFAULT 3,
  retry_delay_ms INTEGER NOT NULL DEFAULT 1000,
  timeout_ms INTEGER NOT NULL DEFAULT 300000,
  dependencies TEXT[],                  -- Array of schedule IDs
  config JSONB NOT NULL DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Jobs
CREATE TABLE operations_jobs (
  id TEXT PRIMARY KEY,                   -- jb_xxxxx
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  priority INTEGER NOT NULL,
  payload JSONB NOT NULL,
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  worker_id TEXT,
  schedule_id TEXT REFERENCES operations_schedules(id),
  parent_job_id TEXT REFERENCES operations_jobs(id),
  correlation_id TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}'
);

-- DLQ
CREATE TABLE operations_dlq (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES operations_jobs(id),
  reason TEXT NOT NULL,
  failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  failed_after_attempts INTEGER NOT NULL,
  error_history JSONB NOT NULL,
  original_queue TEXT NOT NULL,
  correlation_id TEXT NOT NULL
);

-- Distributed Locks
CREATE TABLE operations_locks (
  lock_key TEXT PRIMARY KEY,
  fencing_token TEXT NOT NULL,
  owner TEXT NOT NULL,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_expired BOOLEAN NOT NULL DEFAULT false
);

-- Audit Trail (immutable, append-only)
CREATE TABLE operations_audit (
  id TEXT PRIMARY KEY,                   -- aud_xxxxx
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  action_type TEXT NOT NULL,
  action_target TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  resource_name TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  previous_hash TEXT NOT NULL,
  hash TEXT NOT NULL,
  signature TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  correlation_id TEXT NOT NULL
);

-- Alerts
CREATE TABLE operations_alerts (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL,
  rule_name TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  fired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  escalated_at TIMESTAMPTZ,
  value DOUBLE PRECISION,
  threshold DOUBLE PRECISION,
  component TEXT NOT NULL
);

-- Incident Reports
CREATE TABLE operations_incidents (
  id TEXT PRIMARY KEY,                   -- inc_xxxxx
  title TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  affected_components TEXT[] NOT NULL DEFAULT '{}',
  timeline JSONB NOT NULL DEFAULT '[]',
  root_cause TEXT,
  resolution TEXT,
  related_alerts TEXT[] DEFAULT '{}',
  related_jobs TEXT[] DEFAULT '{}',
  postmortem JSONB
);

-- Execution Metrics
CREATE TABLE operations_metrics (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES operations_jobs(id),
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  queue_wait_ms INTEGER NOT NULL DEFAULT 0,
  processing_time_ms INTEGER NOT NULL DEFAULT 0,
  total_duration_ms INTEGER NOT NULL DEFAULT 0,
  retry_count INTEGER NOT NULL DEFAULT 0,
  worker_id TEXT,
  memory_delta_mb DOUBLE PRECISION,
  cpu_delta_percent DOUBLE PRECISION,
  io_bytes BIGINT,
  db_queries INTEGER,
  api_calls INTEGER,
  api_calls_failed INTEGER,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ
);

-- Notification Log
CREATE TABLE operations_notifications (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL,
  channel TEXT NOT NULL,
  delivery_status TEXT NOT NULL,
  source TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error TEXT,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_jobs_status ON operations_jobs(status);
CREATE INDEX idx_jobs_type ON operations_jobs(type);
CREATE INDEX idx_jobs_priority ON operations_jobs(priority);
CREATE INDEX idx_jobs_created ON operations_jobs(created_at);
CREATE INDEX idx_alerts_status ON operations_alerts(status);
CREATE INDEX idx_alerts_fired ON operations_alerts(fired_at);
CREATE INDEX idx_audit_timestamp ON operations_audit(timestamp);
CREATE INDEX idx_audit_resource ON operations_audit(resource_type, resource_id);
CREATE INDEX idx_metrics_completed ON operations_metrics(completed_at);
```

---

## Verification Checklist

- [ ] Scheduler Engine: supports cron, interval, oneShot, dependency, event triggers
- [ ] Queue Engine: priority-based dequeuing, batch enqueue, router
- [ ] Worker Pool: dynamic scaling, health check, graceful shutdown, concurrency control
- [ ] Retry Queue: exponential backoff, configurable max retries, jitter
- [ ] Dead Letter Queue: storage, replay, purge, stats
- [ ] Job Registry: lifecycle tracking, history, timeline
- [ ] Distributed Lock: acquire, release, extend, fencing, expiration
- [ ] Task Prioritization: priority levels, boost rules for urgent jobs
- [ ] Background Processing: submit, status, cancel, progress tracking
- [ ] Cron Management: add/remove, overlap detection, miss detection
- [ ] Health Check: component registration, aggregation, history
- [ ] Alert Engine: rule-based, threshold, rate, missing, composite, custom conditions
- [ ] Notification Engine: email, slack, webhook, push, SMS, PagerDuty
- [ ] Incident Report: auto-creation from alerts, timeline, postmortem
- [ ] Audit Trail: immutable, hash-chained, tamper-evident
- [ ] Execution Metrics: per-job, aggregated, heatmaps, trends
- [ ] Performance Profiler: hot path detection, bottleneck identification
- [ ] Resource Monitor: CPU, memory, disk, network, process
- [ ] Zero manual steps required for routine operations for 48+ hours
- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npx vitest run` — all tests pass
- [ ] `npx madge --circular` — zero circular dependencies
- [ ] ADR updated for operations platform architecture
- [ ] Verification report generated

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Queue backlog causes data loss | DLQ preserves all failed jobs; alert on backlog thresholds |
| Worker crash during job processing | Job status is persisted; another worker can pick up; idempotency keys |
| Distributed lock deadlock | TTL-based expiry; fencing tokens prevent stale lock usage |
| Alert storm overwhelms notifications | Rate limiting per channel; suppression rules; cooldown periods |
| Audit trail grows unbounded | Partitioned by month; archival policy; compression |
| Scheduler misses due to clock skew | Use monotonic timestamps; health check monitors drift |