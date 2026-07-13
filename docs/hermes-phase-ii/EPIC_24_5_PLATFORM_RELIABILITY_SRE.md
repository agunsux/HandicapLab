# EPIC 24.5 — Platform Reliability & SRE

**Category:** Operational Intelligence Layer  
**Dependencies:** EPIC 22 + EPIC 23 + EPIC 24  
**Target Completion:** Phase II-C (Weeks 9–12)  
**Critical Path:** Long-term platform stability and operational maturity  
**Codename:** HERMES-24.5

---

## Mission Statement

Invest in the foundational reliability infrastructure that enables HandicapLab to operate 24/7/365 without requiring constant manual supervision. This EPIC is not about user-facing features — it is about operational maturity, incident resilience, and the confidence that the platform can survive and recover from failures automatically.

**Target outcome:** HandicapLab meets 99.9% uptime SLA. Every component has defined reliability targets. Recovery from any single failure is automated. Runbooks exist for every known failure mode. The platform can be deployed, configured, and recovered by any operator with the documented procedures.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              Platform Reliability & SRE Layer                 │
│                                                               │
│  ┌─────────────────────┐    ┌─────────────────────────────┐  │
│  │ Configuration Mgmt  │    │   Secret Management         │  │
│  │ - Centralized config│    │  - Encrypted storage        │  │
│  │ - Versioned configs │    │  - Rotation policies        │  │
│  │ - Schema validation │    │  - Access audit             │  │
│  │ - Environment vars  │    │  - Provider credentials     │  │
│  └─────────┬───────────┘    └─────────────┬───────────────┘  │
│            │                              │                   │
│            ▼                              ▼                   │
│  ┌─────────────────────┐    ┌─────────────────────────────┐  │
│  │ Environment Val.    │    │   Feature Flag Management   │  │
│  │ - Pre-flight checks │    │  - Toggle-based deployment  │  │
│  │ - Dependency check  │    │  - Gradual rollout          │  │
│  │ - Config validation │    │  - Kill switch              │  │
│  │ - Health gate       │    │  - A/B testing support      │  │
│  └─────────┬───────────┘    └─────────────┬───────────────┘  │
│            │                              │                   │
│            ▼                              ▼                   │
│  ┌─────────────────────┐    ┌─────────────────────────────┐  │
│  │ Release Management  │    │   Deployment Verification   │  │
│  │ - Version tracking  │    │  - Health check gates       │  │
│  │ - Changelog auto    │    │  - Smoke tests              │  │
│  │ - Rollback triggers │    │  - Metrics validation       │  │
│  │ - Release notes     │    │  - Rollback decision        │  │
│  └─────────┬───────────┘    └─────────────┬───────────────┘  │
│            │                              │                   │
│            ▼                              ▼                   │
│  ┌─────────────────────┐    ┌─────────────────────────────┐  │
│  │ Canary Deployment   │    │   Rollback Automation       │  │
│  │ - Gradual traffic   │    │  - One-click rollback       │  │
│  │ - Metrics watching  │    │  - Auto-rollback triggers   │  │
│  │ - Auto-promote/roll │    │  - Version revert           │  │
│  │ - Canary analysis   │    │  - Database migration revert│  │
│  └─────────────────────┘    └─────────────────────────────┘  │
│                                                               │
│  ┌─────────────────────┐    ┌─────────────────────────────┐  │
│  │ Backup & Restore    │    │   Disaster Recovery         │  │
│  │ - Automated backups │    │  - RTO/RPO definitions      │  │
│  │ - Point-in-time     │    │  - DR runbooks              │  │
│  │ - Encryption        │    │  - Multi-region failover    │  │
│  │ - Restore testing   │    │  - DR drills               │  │
│  └─────────────────────┘    └─────────────────────────────┘  │
│                                                               │
│  ┌─────────────────────┐    ┌─────────────────────────────┐  │
│  │ SLI/SLO Framework   │    │   Error Budget             │  │
│  │ - Service indicators│    │  - Budget calculation      │  │
│  │ - Objective targets │    │  - Budget tracking         │  │
│  │ - Measurement method│    │  - Burn rate alerting      │  │
│  │ - SLO dashboard     │    │  - Policy enforcement      │  │
│  └─────────────────────┘    └─────────────────────────────┘  │
│                                                               │
│  ┌─────────────────────┐    ┌─────────────────────────────┐  │
│  │ Capacity Planning   │    │   Cost Monitoring           │  │
│  │ - Resource trending │    │  - Cost allocation          │  │
│  │ - Growth forecasting│    │  - Budget tracking          │  │
│  │ - Scaling thresholds│    │  - Cost optimization        │  │
│  │ - Bottleneck ID     │    │  - Anomaly detection        │  │
│  └─────────────────────┘    └─────────────────────────────┘  │
│                                                               │
│  ┌─────────────────────┐    ┌─────────────────────────────┐  │
│  │ Dependency Health   │    │   Security Audit            │  │
│  │ - External services │    │  - Dependency scanning      │  │
│  │ - Internal modules  │    │  - Vulnerability assessment │  │
│  │ - Version tracking  │    │  - Access control review    │  │
│  │ - Deprecation watch │    │  - Compliance checking      │  │
│  └─────────────────────┘    └─────────────────────────────┘  │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              Operational Runbooks                        │ │
│  │  - Incident response  │  - Recovery procedures          │ │
│  │  - Maintenance tasks  │  - Onboarding guide             │ │
│  │  - Known issues       │  - Escalation paths             │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Detailed Module Specifications

### 1. Configuration Management

**Purpose:** Centralized, validated, versioned configuration management. No hardcoded configuration anywhere in the codebase.

```typescript
interface IConfigManager {
  get<T>(key: string): T;
  getOrDefault<T>(key: string, defaultValue: T): T;
  set(key: string, value: unknown): Promise<void>;
  getAll(): Record<string, unknown>;
  validate(config: Record<string, unknown>): ConfigValidationResult;
  watch(key: string, callback: (value: unknown) => void): void;
  getSchema(): ConfigSchema;
  export(): string;                    // Export as JSON/YAML
  import(config: string): Promise<void>;
}

interface ConfigValidationResult {
  valid: boolean;
  errors: ConfigError[];
  warnings: ConfigWarning[];
}

interface ConfigError {
  path: string;
  message: string;
  expected: string;
  actual: unknown;
}

interface ConfigSchema {
  version: string;
  properties: Record<string, ConfigProperty>;
  required: string[];
}

interface ConfigProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  default?: unknown;
  required: boolean;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    enum?: unknown[];
  };
  sensitive: boolean;                  // Whether this value is secret
}
```

**Configuration Hierarchy (Priority: highest → lowest):**
```
1. Environment variables (runtime override)
2. Feature flags (runtime dynamic)
3. Config file (config/<env>.json)
4. Default configuration (code constants)
```

**Configuration Categories:**
| Category | Examples | Source |
|----------|----------|--------|
| Provider | API keys, endpoints, rate limits | Secrets + Config |
| Database | Connection string, pool size | Environment |
| Queue | Concurrency, retry settings | Config |
| Scheduler | Cron expressions, timeouts | Config |
| Observability | Log level, metric export | Config + Environment |
| Feature | Feature flags | Config + API |
| Security | JWT secret, encryption keys | Secrets |
| Deployment | Environment, version, host | Environment |

### 2. Secret Management

**Purpose:** Securely store, rotate, and audit all sensitive credentials. Never expose secrets in logs, error messages, or configuration exports.

```typescript
interface ISecretManager {
  getSecret(key: string): Promise<string>;
  setSecret(key: string, value: string): Promise<void>;
  rotateSecret(key: string): Promise<string>;   // Generate new value
  deleteSecret(key: string): Promise<void>;
  listSecrets(): Promise<string[]>;              // Names only, not values
  getSecretMetadata(key: string): Promise<SecretMetadata>;
  validateAllSecrets(): Promise<SecretValidationResult>;
}

interface SecretMetadata {
  key: string;
  createdAt: string;
  lastRotatedAt: string;
  rotationRequired: boolean;
  maxAgeDays: number;
  accessedBy: string[];               // Last 10 accessors
  lastAccessedAt: string;
  version: number;
}

interface SecretValidationResult {
  valid: boolean;
  missingSecrets: string[];
  expiredSecrets: string[];
  expiringSecrets: { key: string; expiresInDays: number }[];
  warnings: string[];
}
```

**Secrets Inventory:**
| Secret | Rotation | Max Age | Used By |
|--------|----------|---------|---------|
| `API_FOOTBALL_KEY` | Monthly | 90 days | ApiFootballAdapter |
| `FOOTBALL_DATA_KEY` | Monthly | 90 days | FootballDataAdapter |
| `ODDS_API_KEY` | Monthly | 90 days | OddsApiAdapter |
| `DATABASE_URL` | Quarterly | 365 days | Database connection |
| `JWT_SECRET` | Quarterly | 365 days | Authentication |
| `SLACK_WEBHOOK` | As needed | — | Notification Engine |
| `PAGERDUTY_KEY` | Quarterly | 365 days | Incident response |
| `SUPABASE_ANON_KEY` | Quarterly | 365 days | Supabase client |
| `SUPABASE_SERVICE_KEY` | Quarterly | 365 days | Admin operations |
| `ENCRYPTION_KEY` | Annually | 730 days | Data at rest |

**Secret Storage Options:**
- **Development**: `.env` file (gitignored)
- **Production**: Vault / AWS Secrets Manager / GCP Secret Manager
- **Local**: Encrypted file with master password

### 3. Environment Validation

**Purpose:** Every environment (development, staging, production) must pass validation before the application starts. Prevents misconfiguration from reaching production.

```typescript
interface IEnvironmentValidator {
  validate(): Promise<EnvironmentValidationResult>;
  validatePreFlight(): Promise<PreFlightResult>;
  checkDependencies(): Promise<DependencyCheckResult>;
  checkConfig(): Promise<ConfigValidationResult>;
  checkSecrets(): Promise<SecretValidationResult>;
  checkNetwork(): Promise<NetworkCheckResult>;
  checkDatabase(): Promise<DatabaseCheckResult>;
  runAll(): Promise<FullValidationResult>;
}

interface EnvironmentValidationResult {
  valid: boolean;
  environment: string;
  timestamp: string;
  checks: {
    dependencies: boolean;
    config: boolean;
    secrets: boolean;
    network: boolean;
    database: boolean;
    disk: boolean;
    memory: boolean;
    timezone: boolean;
  };
  errors: string[];
  warnings: string[];
}

interface PreFlightResult {
  canStart: boolean;                   // Gate: must be true to start
  blockingIssues: string[];
  recommendations: string[];
  estimatedFixTime: string;            // "5 minutes", "requires deployment"
}

interface DependencyCheckResult {
  dependencies: DependencyStatus[];
  allAvailable: boolean;
  unavailableCount: number;
}

interface DependencyStatus {
  name: string;
  type: 'internal' | 'external' | 'database' | 'network';
  required: boolean;
  available: boolean;
  version: string;
  expectedVersion: string;
  latencyMs: number;
  error: string | null;
}
```

**Validation Gates:**
```
Application Start → Environment Validation → Gate: All Critical Checks Pass → Ready
                         │                                              │
                         └── Failed → Log error / Alert / Exit          │
                                                                        ▼
                                                              Start accepting traffic
```

**Critical Checks (must pass):**
- Database reachable with valid credentials
- All provider API keys present and not expired
- Required environment variables set
- Disk space > 10% free
- Memory > 512MB available
- Timezone set correctly (UTC)
- All internal module dependencies installed
- Config file valid and matches schema
- Required ports available

### 4. Feature Flag Management

**Purpose:** Enable gradual rollout, kill switches, and A/B testing of features without code deploys.

```typescript
interface IFeatureFlagManager {
  isEnabled(flag: string, context?: FlagContext): boolean;
  getVariant(flag: string, context?: FlagContext): string;
  setFlag(flag: string, config: FlagConfig): Promise<void>;
  deleteFlag(flag: string): Promise<void>;
  listFlags(): Promise<FeatureFlag[]>;
  getFlagHistory(flag: string): Promise<FlagChange[]>;
}

interface FeatureFlag {
  name: string;
  description: string;
  enabled: boolean;
  owner: string;
  createdAt: string;
  updatedAt: string;
  rollout: FlagRollout;
  variants?: Record<string, number>;    // For A/B testing
  dependencies?: string[];              // Must be enabled first
  expiryDate?: string;                  // Auto-disable on date
}

interface FlagRollout {
  type: 'global' | 'percentage' | 'userGroup' | 'environment';
  percentage?: number;                   // 0–100
  userGroups?: string[];
  environments?: string[];
  targetingRules?: TargetingRule[];     // Custom logic
}

interface FlagContext {
  userId?: string;
  environment?: string;
  userGroup?: string;
  [key: string]: unknown;
}

type FlagChange = {
  timestamp: string;
  changedBy: string;
  before: Partial<FlagConfig>;
  after: Partial<FlagConfig>;
  reason: string;
}
```

**Feature Flag Examples:**
| Flag | Description | Default | Rollout |
|------|-------------|---------|---------|
| `new-provider-failover` | Enable new failover algorithm | disabled | Percentage (50%) |
| `enhanced-odds-merge` | Enable enhanced odds merger | disabled | Environment (staging) |
| `drift-detection-v2` | Enable v2 drift detection | disabled | Percentage (25%) |
| `canary-model-v2` | Route 5% to model v2 | disabled | Percentage (5%) |
| `kill-switch-prediction` | Kill all predictions | enabled | Global |
| `debug-logging` | Enable debug logging | disabled | User group (admin) |
| `shadow-mode` | Enable shadow mode | enabled | Global |

### 5. Release Management

**Purpose:** Track every release with version, changelog, and verification status.

```typescript
interface IReleaseManager {
  createRelease(version: string, config: ReleaseConfig): Promise<Release>;
  promoteRelease(version: string, environment: string): Promise<void>;
  rollbackRelease(version: string, environment: string): Promise<void>;
  getRelease(version: string): Promise<Release>;
  listReleases(filter?: ReleaseFilter): Promise<Release[]>;
  getCurrentVersion(environment: string): Promise<string>;
  compareVersions(v1: string, v2: string): Promise<ReleaseDiff>;
}

interface Release {
  version: string;                      // SemVer
  gitCommit: string;
  gitTag: string;
  buildId: string;
  buildTime: string;
  deployedAt: string | null;
  deployedBy: string | null;
  environment: string;
  status: ReleaseStatus;                // PENDING, DEPLOYING, ACTIVE, ROLLED_BACK, FAILED
  changelog: ChangeLogEntry[];
  verificationResults: VerificationResult[];
  rollbackVersion: string | null;
  artifacts: ReleaseArtifact[];
  notes: string;
}

interface ChangeLogEntry {
  type: 'feature' | 'fix' | 'improvement' | 'config' | 'dependency';
  description: string;
  component: string;
  author: string;
  issueRef?: string;
  breaking: boolean;
}

interface VerificationResult {
  test: string;
  passed: boolean;
  durationMs: number;
  details: string;
  timestamp: string;
}

interface ReleaseArtifact {
  name: string;
  type: 'docker' | 'npm' | 'binary' | 'config';
  version: string;
  hash: string;
  sizeBytes: number;
  url: string;
}

type ReleaseStatus = 'PENDING' | 'DEPLOYING' | 'ACTIVE' | 'ROLLED_BACK' | 'FAILED' | 'SKIPPED';
```

**Release Promotion Path:**
```
Development → Staging → Canary (5%) → Production (25%) → Production (100%)
     │            │           │              │                 │
     ▼            ▼           ▼              ▼                 ▼
  Unit tests   Integration  Canary smoke  Metrics check     Full validation
                tests        tests
```

### 6. Deployment Verification

**Purpose:** Automated verification that a deployment is healthy before marking it complete.

```typescript
interface IDeploymentVerifier {
  verify(deploymentId: string): Promise<VerificationResult>;
  runSmokeTests(deploymentId: string): Promise<SmokeTestResult>;
  checkMetrics(deploymentId: string): Promise<MetricsCheckResult>;
  checkHealthEndpoints(deploymentId: string): Promise<HealthCheckResult>;
  compareWithBaseline(deploymentId: string): Promise<BaselineComparison>;
  rollbackIfFailed(deploymentId: string): Promise<void>;
}

interface SmokeTestResult {
  passed: boolean;
  tests: SmokeTest[];
  summary: string;
}

interface SmokeTest {
  name: string;                        // "Home page loads", "API responds"
  endpoint: string;
  expectedStatus: number;
  actualStatus: number;
  responseTimeMs: number;
  maxAllowedMs: number;
  passed: boolean;
  error: string | null;
}

interface MetricsCheckResult {
  passed: boolean;
  metrics: MetricComparison[];
  violations: MetricViolation[];
}

interface MetricComparison {
  name: string;
  preDeployValue: number;
  postDeployValue: number;
  changePercent: number;
  thresholdPercent: number;
  status: 'NORMAL' | 'WARNING' | 'CRITICAL';
}

interface BaselineComparison {
  passed: boolean;
  comparisons: MetricComparison[];
  comment: string;
}
```

**Deployment Verification Gates:**
```
Gate 1: Health endpoints all respond 200 OK
Gate 2: Smoke tests pass (API, DB, Queue, Provider)
Gate 3: Error rate < 2x baseline
Gate 4: Latency p95 < 1.5x baseline
Gate 5: No critical alerts firing
Gate 6: All background workers healthy
Gate 7: Database migrations complete
Gate 8: Feature flags correctly set
```

### 7. Canary Deployment

**Purpose:** Gradually roll out changes to a subset of traffic, monitoring for regressions before full rollout.

```typescript
interface ICanaryDeployment {
  startCanary(config: CanaryConfig): Promise<string>;
  promoteCanary(canaryId: string): Promise<void>;
  rollbackCanary(canaryId: string): Promise<void>;
  getCanaryStatus(canaryId: string): Promise<CanaryStatus>;
  analyzeCanary(canaryId: string): Promise<CanaryAnalysis>;
  listCanaries(): Promise<CanaryInfo[]>;
}

interface CanaryConfig {
  releaseVersion: string;
  targetEnvironment: string;
  initialPercentage: number;            // Default: 5%
  incrementStep: number;                // Default: 10%
  promotionIntervalMs: number;          // Default: 300_000 (5 min)
  maxPercentage: number;                // Default: 50%
  evaluationMetrics: string[];          // Which metrics to watch
  failureThreshold: number;             // Max acceptable degradation
  autoPromote: boolean;                 // Promote if all checks pass
  autoRollback: boolean;                // Rollback if threshold breached
}

interface CanaryStatus {
  id: string;
  releaseVersion: string;
  environment: string;
  status: 'RUNNING' | 'PROMOTED' | 'ROLLED_BACK' | 'FAILED';
  currentPercentage: number;
  targetPercentage: number;
  startedAt: string;
  lastUpdated: string;
  currentPhase: CanaryPhase;
}

interface CanaryPhase {
  number: number;
  percentage: number;
  startedAt: string;
  durationMs: number;
  metrics: Record<string, MetricComparison>;
  status: 'PASSED' | 'FAILED' | 'IN_PROGRESS';
}

interface CanaryAnalysis {
  canaryId: string;
  overall: 'SAFE' | 'RISKY' | 'UNSAFE';
  metricsAnalysis: MetricsAnalysis[];
  recommendation: 'promote' | 'rollback' | 'hold';
  confidence: number;                   // 0–1
  details: string;
}
```

**Canary Phases:**
```
Phase 1: 5% traffic  → Watch 5 min → Auto-analyze
Phase 2: 15% traffic → Watch 5 min → Auto-analyze
Phase 3: 30% traffic → Watch 5 min → Auto-analyze
Phase 4: 50% traffic → Watch 10 min → Auto-analyze
Phase 5: 100% traffic (promote)
Any phase: Degradation detected → Auto-rollback
```

### 8. Rollback Automation

**Purpose:** One-click or automatic rollback to previous version when deployment issues are detected.

```typescript
interface IRollbackManager {
  rollback(environment: string, options?: RollbackOptions): Promise<RollbackResult>;
  getRollbackHistory(environment: string, limit?: number): Promise<RollbackRecord[]>;
  getRollbackReadiness(environment: string): Promise<RollbackReadiness>;
  validateRollbackPlan(environment: string, targetVersion: string): Promise<RollbackPlan>;
  scheduleRollback(environment: string, at: string): Promise<string>;
}

interface RollbackOptions {
  targetVersion?: string;              // Default: previous stable version
  autoRestore?: boolean;               // Auto-restore DB from backup
  notifyChannels?: string[];
  waitForBackup?: boolean;             // Wait for DB backup before rollback
  force?: boolean;                     // Skip readiness checks
}

interface RollbackResult {
  success: boolean;
  rolledBackTo: string;
  fromVersion: string;
  timestamp: string;
  duration: number;
  migrationsReverted: number;
  dataLossWarning: string | null;      // Any potential data loss
  steps: RollbackStep[];
  postRollbackHealth: 'HEALTHY' | 'DEGRADED' | 'FAILED';
}

interface RollbackStep {
  step: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  durationMs: number;
  error: string | null;
}

interface RollbackReadiness {
  ready: boolean;
  previousVersion: string | null;
  backupAvailable: boolean;
  migrationRollbackPossible: boolean;
  estimatedTimeSeconds: number;
  blockingIssues: string[];
}

interface RollbackRecord {
  id: string;
  timestamp: string;
  triggeredBy: string;
  triggerType: 'AUTO' | 'MANUAL' | 'SCHEDULED';
  fromVersion: string;
  toVersion: string;
  reason: string;
  result: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  duration: number;
}
```

**Rollback Triggers:**
| Trigger | Type | Action |
|---------|------|--------|
| Error rate > 5x baseline | AUTO | Immediate rollback |
| P95 latency > 3x baseline | AUTO | Immediate rollback |
| Health check fails | AUTO | Immediate rollback |
| Critical alert fires | AUTO (configurable) | Rollback + notify |
| Manual operator decision | MANUAL | One-click rollback |
| Scheduled maintenance | SCHEDULED | Rollback at specified time |

### 9. Backup & Restore

**Purpose:** Automated, verified backups with point-in-time recovery capability.

```typescript
interface IBackupManager {
  createBackup(config: BackupConfig): Promise<BackupRecord>;
  listBackups(filter?: BackupFilter): Promise<BackupRecord[]>;
  getBackup(id: string): Promise<BackupRecord>;
  verifyBackup(id: string): Promise<BackupVerificationResult>;
  restore(backupId: string, options?: RestoreOptions): Promise<RestoreResult>;
  scheduleBackup(cron: string, config: BackupConfig): Promise<string>;
  getBackupSchedule(): Promise<ScheduledBackup[]>;
}

interface BackupConfig {
  name: string;
  type: 'full' | 'incremental' | 'point_in_time';
  target: 'database' | 'files' | 'config' | 'all';
  compression: boolean;
  encryption: boolean;
  retentionDays: number;
  excludeTables?: string[];             // For database backup
  includePaths?: string[];              // For file backup
}

interface BackupRecord {
  id: string;
  name: string;
  type: string;
  target: string;
  sizeBytes: number;
  compressedSizeBytes: number;
  encrypted: boolean;
  checksum: string;
  createdAt: string;
  retentionUntil: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'VERIFIED';
  metadata: Record<string, unknown>;
}

interface BackupVerificationResult {
  verified: boolean;
  checksumValid: boolean;
  canRestore: boolean;
  estimatedRestoreTime: string;
  warnings: string[];
}

interface RestoreOptions {
  targetTable?: string;                // For partial restore
  pointInTime?: string;                // For PITR
  dryRun?: boolean;                    // Validate without executing
  skipIntegrityCheck?: boolean;
}

interface RestoreResult {
  success: boolean;
  backupId: string;
  restoreTime: string;
  durationMs: number;
  recordsRestored: number;
  warnings: string[];
  verificationPassed: boolean;
}
```

**Backup Schedule:**
| Type | Schedule | Retention | Target |
|------|----------|-----------|--------|
| Full database | Daily (02:00 UTC) | 30 days | Database |
| Incremental | Every 6 hours | 7 days | Database |
| Point-in-time (WAL) | Continuous | 7 days | Database |
| Configuration | On each deploy | 10 deploys | Config files |
| Provider archives | Weekly | 90 days | Raw archives |
| Metrics | Monthly | 13 months | Metrics data |

### 10. Disaster Recovery

**Purpose:** Ensure the platform can recover from catastrophic failures with defined RTO and RPO.

```typescript
interface IDisasterRecovery {
  getDRPlan(): Promise<DRPlan>;
  executeDRPlan(plan: DRPlan): Promise<DRExecutionResult>;
  testDRPlan(plan: DRPlan): Promise<DRTestResult>;
  getDRStatus(): Promise<DRStatus>;
  configureFailover(config: FailoverConfig): Promise<void>;
  triggerFailover(): Promise<FailoverResult>;
  triggerFailback(): Promise<FailbackResult>;
}

interface DRPlan {
  id: string;
  name: string;
  type: 'regional' | 'datacenter' | 'service';
  rto: number;                          // Recovery Time Objective (seconds)
  rpo: number;                          // Recovery Point Objective (seconds)
  triggers: DRTrigger[];
  steps: DRStep[];
  dependencies: string[];
  lastTested: string | null;
  testedSuccessfully: boolean;
}

interface DRStep {
  order: number;
  name: string;
  description: string;
  estimatedDuration: string;
  automated: boolean;
  scriptRef: string | null;            // Reference to automation script
  manualProcedure: string | null;      // Fallback manual procedure
}

interface DRStatus {
  ready: boolean;
  lastDRTest: string | null;
  lastDRTestResult: boolean;
  rto: number;
  rpo: number;
  currentUptime: number;
  failoverActive: boolean;
  warnings: string[];
}

interface FailoverConfig {
  type: 'auto' | 'manual';
  primaryRegion: string;
  secondaryRegion: string;
  autoDetectIntervalMs: number;
  failoverThresholdMs: number;          // Downtime before auto-failover
  failbackPolicy: 'auto' | 'manual';
}
```

**DR Tiers:**
| Tier | RTO | RPO | Coverage |
|------|-----|-----|----------|
| Platinum | < 1 min | < 1 min | Database + core services |
| Gold | < 5 min | < 5 min | All critical services |
| Silver | < 15 min | < 1 hour | Non-critical services |
| Bronze | < 1 hour | < 24 hours | Batch/reporting services |

### 11. SLI/SLO Framework

**Purpose:** Define, measure, and track Service Level Indicators against Service Level Objectives.

```typescript
interface ISLISLOFramework {
  registerSLI(sli: SLIDefinition): Promise<void>;
  recordSLI(name: string, value: number, labels?: Record<string, string>): Promise<void>;
  getSLOCompliance(sloName: string, window: TimeRange): Promise<SLOCompliance>;
  getAllSLOStatus(): Promise<SLOStatus[]>;
  getErrorBudget(sloName: string): Promise<ErrorBudget>;
  checkBurnRate(sloName: string): Promise<BurnRateAlert>;
}

interface SLIDefinition {
  name: string;
  description: string;
  measurementMethod: 'latency' | 'availability' | 'error_rate' | 'throughput' | 'custom';
  unit: string;
  goodEventFilter: string;              // What counts as "good"
  validEventFilter: string;             // What counts as "valid"
  measurementWindowMs: number;
}

interface SLODefinition {
  name: string;
  description: string;
  sliName: string;
  targetPercent: number;                // e.g., 99.9 for 99.9%
  window: SLOWindow;                    // 28d, 30d, 90d, custom
  severity: 'SILVER' | 'GOLD' | 'PLATINUM';
  errorBudgetMinutes: number;
  burnRateAlertThresholds: {
    fastBurnMinutes: number;             // Exhaust in < 2 hours
    slowBurnMinutes: number;             // Exhaust in < 30 days
  };
}

interface SLOCompliance {
  sloName: string;
  window: TimeRange;
  targetPercent: number;
  actualPercent: number;
  compliant: boolean;
  totalEvents: number;
  goodEvents: number;
  badEvents: number;
  errorBudgetRemaining: number;
  errorBudgetConsumed: number;
  remainingBudgetPercent: number;
}

interface ErrorBudget {
  sloName: string;
  totalMinutes: number;
  consumedMinutes: number;
  remainingMinutes: number;
  consumedPercent: number;
  remainingPercent: number;
  burnRate: number;                     // Minutes consumed per hour
  daysUntilExhaustion: number;
  status: 'SAFE' | 'WARNING' | 'CRITICAL';
}

interface BurnRateAlert {
  sloName: string;
  alertType: 'FAST_BURN' | 'SLOW_BURN';
  burnRate: number;
  threshold: number;
  message: string;
  severity: 'WARNING' | 'CRITICAL';
}
```

**SLO Targets (Initial):**

| SLO | SLI | Target | Window | Severity |
|-----|-----|--------|--------|----------|
| Provider Requests | Provider success rate | 99.9% | 30d | GOLD |
| Provider Latency | Provider p95 < 5s | 99.0% | 30d | SILVER |
| Queue Processing | Job completion rate | 99.9% | 30d | GOLD |
| Prediction Generation | Prediction success rate | 99.5% | 30d | GOLD |
| Database Queries | Query error rate | 99.99% | 30d | PLATINUM |
| Database Latency | Query p95 < 1s | 99.5% | 30d | SILVER |
| API Endpoints | HTTP 200 rate | 99.99% | 30d | PLATINUM |
| Dashboard Loading | Dashboard load < 2s | 99.0% | 30d | SILVER |
| Webhook Delivery | Webhook success rate | 99.5% | 30d | GOLD |
| System Uptime | Process alive | 99.9% | 30d | GOLD |

### 12. Error Budget

**Purpose:** Track error budget consumption and enforce consequences when exceeded.

```
Error Budget = (1 - SLO Target) × Time Window

Example: 99.9% SLO over 30 days
  Error Budget = (1 - 0.999) × 30 days × 24h × 60min = 43.2 minutes

Budget Consumption:
  SAFE:     < 50% consumed     → Normal operations
  WARNING:  50–80% consumed    → Increased monitoring
  CRITICAL: > 80% consumed     → Freeze feature releases
  EXHAUSTED: 100% consumed     → Rollback, full incident response
```

**Error Budget Policy:**
| Budget Level | Action |
|-------------|--------|
| SAFE | Normal development pace |
| WARNING | Review reliability improvements; add monitoring |
| CRITICAL | Halt non-critical deployments; focus on reliability |
| EXHAUSTED | Emergency incident; full rollback if applicable |

### 13. Capacity Planning

**Purpose:** Predict resource needs before they become problems.

```typescript
interface ICapacityPlanner {
  getCurrentUsage(): Promise<CapacityUsage>;
  forecast(days: number): Promise<CapacityForecast>;
  getGrowthRate(): Promise<GrowthRate>;
  recommendScaling(): Promise<ScalingRecommendation>;
  getBottlenecks(): Promise<Bottleneck[]>;
  generateReport(): Promise<CapacityReport>;
}

interface CapacityUsage {
  timestamp: string;
  database: {
    sizeGb: number;
    growthRatePerDay: number;
    connectionsUsed: number;
    connectionsMax: number;
    iops: number;
    iopsMax: number;
  };
  api: {
    requestsPerDay: number;
    requestsPerDayGrowth: number;
    byProvider: Record<string, number>;
  };
  queue: {
    avgJobsPerDay: number;
    peakJobsPerHour: number;
    avgProcessingTime: number;
  };
  storage: {
    totalUsedGb: number;
    totalAvailableGb: number;
    byCategory: Record<string, number>;
  };
  memory: {
    usedMb: number;
    availableMb: number;
    growthRatePerDay: number;
  };
  compute: {
    cpuAvg: number;
    cpuPeak: number;
    workerUtilization: number;
  };
}

interface CapacityForecast {
  forecastDate: string;
  predictions: {
    databaseSizeGb: { value: number; confidence: number };
    apiRequestsPerDay: { value: number; confidence: number };
    storageUsedGb: { value: number; confidence: number };
    memoryUsedMb: { value: number; confidence: number };
    workersNeeded: { value: number; confidence: number };
  };
  thresholdWarnings: ThresholdWarning[];
  recommendation: string;
}

interface ScalingRecommendation {
  immediate: ScalingAction[];
  shortTerm: ScalingAction[];           // Next 30 days
  mediumTerm: ScalingAction[];          // Next 90 days
  longTerm: ScalingAction[];            // Next 180 days
}

interface ScalingAction {
  resource: string;                       // "database", "workers", "storage", "memory"
  action: 'scale_up' | 'scale_out' | 'optimize' | 'migrate';
  reason: string;
  urgency: 'IMMEDIATE' | 'THIS_WEEK' | 'THIS_MONTH' | 'NEXT_QUARTER';
  estimatedCost: string;
}
```

**Capacity Triggers:**
| Resource | Warning Threshold | Critical Threshold |
|----------|------------------|-------------------|
| Database size | 70% of capacity | 85% of capacity |
| API requests | 70% of daily limit | 85% of daily limit |
| Storage | 70% of disk | 85% of disk |
| Memory | 70% of RAM | 85% of RAM |
| Worker pool | 60% utilization | 80% utilization |
| Database connections | 60% of max | 80% of max |

### 14. Cost Monitoring

**Purpose:** Track and optimize operational costs across all resources.

```typescript
interface ICostMonitor {
  getCurrentCosts(): Promise<CostSummary>;
  getCostBreakdown(period: TimeRange, granularity: string): Promise<CostBreakdown>;
  getCostByProvider(period: TimeRange): Promise<CostByProvider[]>;
  getCostByCategory(period: TimeRange): Promise<CostByCategory[]>;
  forecastCost(days: number): Promise<CostForecast>;
  detectAnomalies(period: TimeRange): Promise<CostAnomaly[]>;
  getOptimizationRecommendations(): Promise<CostOptimization[]>;
}

interface CostSummary {
  period: TimeRange;
  totalCost: number;
  dailyAverage: number;
  costByProvider: Record<string, number>;
  costByCategory: Record<string, number>;
  costByService: Record<string, number>;
  monthOverMonthChange: number;
  budgetRemaining: number;
  budgetPercentUsed: number;
}

interface CostBreakdown {
  daily: { date: string; cost: number; category: string }[];
  weekly: { week: string; cost: number; category: string }[];
  monthly: { month: string; cost: number; category: string }[];
}

interface CostAnomaly {
  date: string;
  service: string;
  expectedCost: number;
  actualCost: number;
  variancePercent: number;
  probableCause: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface CostOptimization {
  category: string;
  currentCost: number;
  estimatedSaving: number;
  recommendation: string;
  effort: 'LOW' | 'MEDIUM' | 'HIGH';
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
}
```

**Cost Categories:**
| Category | Items |
|----------|-------|
| API Providers | API-Football, Football-Data, Odds API, Pinnacle |
| Database | Supabase/PostgreSQL |
| Hosting | Vercel, serverless functions |
| Storage | Raw archives, backups, logs |
| Monitoring | Observability tools |
| Third-party | Slack, PagerDuty, Sentry |
| Compute | Worker instances, background jobs |

### 15. Dependency Health

**Purpose:** Monitor the health of all internal and external dependencies.

```typescript
interface IDependencyHealth {
  registerDependency(dep: Dependency): void;
  checkAll(): Promise<DependencyHealthReport>;
  checkDependency(name: string): Promise<DependencyStatus>;
  getDependencyGraph(): Promise<DependencyGraph>;
  getUpstreamDependencies(module: string): Promise<string[]>;
  getDownstreamDependencies(module: string): Promise<string[]>;
  watchForDeprecation(): Promise<DeprecationAlert[]>;
}

interface Dependency {
  name: string;
  type: 'internal' | 'external' | 'npm' | 'system';
  version: string;
  minVersion: string;                  // Minimum acceptable version
  maxVersion: string;                  // Maximum tested version
  healthEndpoint?: string;             // For external services
  critical: boolean;
  owner: string;
  notes: string;
}

interface DependencyHealthReport {
  timestamp: string;
  totalDeps: number;
  healthyDeps: number;
  degradedDeps: number;
  downDeps: number;
  dependencies: DependencyStatus[];
}

interface DependencyStatus {
  name: string;
  type: string;
  version: string;
  expectedVersion: string;
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'UNKNOWN';
  latencyMs: number;
  lastCheck: string;
  lastSuccessfulCheck: string;
  uptimePercent: number;
  deprecationWarning: string | null;
}

interface DependencyGraph {
  nodes: { name: string; type: string }[];
  edges: { from: string; to: string; type: 'depends_on' }[];
}

interface DeprecationAlert {
  dependency: string;
  currentVersion: string;
  deprecatedVersion: string;
  endOfLife: string;
  migrationGuide: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
}
```

**Dependencies to Monitor:**
| Dependency | Type | Critical | Version Check |
|------------|------|----------|---------------|
| Node.js | system | Yes | ≥ 18.x |
| PostgreSQL | system | Yes | ≥ 15.x |
| TypeScript | npm | Yes | ≥ 5.x |
| Next.js | npm | Yes | ≥ 14.x |
| supabase-js | npm | Yes | Current |
| API-Football | external | Yes | API version |
| Football-Data | external | No | API version |
| The Odds API | external | No | API version |
| Slack API | external | No | API version |
| PagerDuty API | external | No | API version |

### 16. Security Audit

**Purpose:** Regular security scanning and auditing of the platform.

```typescript
interface ISecurityAuditor {
  runDependencyScan(): Promise<DependencyScanResult>;
  runVulnerabilityScan(): Promise<VulnerabilityScanResult>;
  checkAccessControls(): Promise<AccessControlReport>;
  validateSecrets(): Promise<SecretValidationResult>;
  checkCompliance(): Promise<ComplianceReport>;
  generateAuditReport(): Promise<SecurityReport>;
}

interface DependencyScanResult {
  scanned: number;
  vulnerabilities: Vulnerability[];
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  recommendations: string[];
}

interface Vulnerability {
  package: string;
  version: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  cve: string;
  description: string;
  fixVersion: string;
  cvssScore: number;
  exploitability: 'PROVEN' | 'THEORETICAL' | 'NONE';
}

interface AccessControlReport {
  roles: RoleDefinition[];
  users: UserAccess[];
  permissions: Permission[];
  audit: AccessAuditEntry[];
  violations: AccessViolation[];
}

interface SecurityReport {
  timestamp: string;
  summary: string;
  overallScore: number;                // 0–100
  criticalFindings: number;
  highFindings: number;
  mediumFindings: number;
  lowFindings: number;
  recommendations: SecurityRecommendation[];
  scanResults: {
    dependency: DependencyScanResult;
    vulnerability: VulnerabilityScanResult;
    access: AccessControlReport;
    secrets: SecretValidationResult;
    compliance: ComplianceReport;
  };
}
```

**Security Scan Schedule:**
| Scan | Frequency | Auto-fix |
|------|-----------|----------|
| Dependency vulnerability | Daily | Alert only |
| Secret scanning | On each commit | Block if secrets found |
| Access control audit | Weekly | Alert only |
| Compliance check | Monthly | Report |
| Full security audit | Quarterly | Report + recommendations |
| Penetration test | Annually | External firm |

### 17. Operational Runbooks

**Purpose:** Documented procedures for every known operational scenario. Enables any operator to handle incidents.

**Runbook Structure:**
```typescript
interface Runbook {
  id: string;                            // rbk_xxxxx
  title: string;
  category: RunbookCategory;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'EMERGENCY';
  symptoms: string[];
  affectedComponents: string[];
  prerequisites: string[];               // Tools, access, permissions
  steps: RunbookStep[];
  verificationSteps: string[];           // How to confirm resolution
  rollbackSteps: string[];               // How to undo if needed
  escalationPath: string[];
  relatedRunbooks: string[];
  lastReviewed: string;
  reviewIntervalDays: number;
  timeToExecute: string;                 // Estimated time
  automationRef: string | null;          // Reference to automation script
}

type RunbookCategory =
  | 'INCIDENT_RESPONSE'
  | 'RECOVERY'
  | 'MAINTENANCE'
  | 'DEPLOYMENT'
  | 'CONFIGURATION'
  | 'MONITORING'
  | 'SECURITY';

interface RunbookStep {
  order: number;
  title: string;
  description: string;
  command: string | null;               // CLI command or script reference
  expectedOutput: string | null;
  timeout: string;                       // Max time for this step
  automated: boolean;
  critical: boolean;                     // Must succeed to continue
  parallel: boolean;                     // Can run in parallel with other steps
}
```

**Required Runbooks:**

| # | Runbook | Category | Priority |
|---|---------|----------|----------|
| 1 | Provider outage — API-Football down | INCIDENT | HIGH |
| 2 | Provider outage — All providers down | INCIDENT | HIGH |
| 3 | Database failure — Connection lost | INCIDENT | EMERGENCY |
| 4 | Database failure — Corruption | RECOVERY | EMERGENCY |
| 5 | Queue backlog — Critical queue stalled | INCIDENT | HIGH |
| 6 | Worker crash — All workers down | INCIDENT | HIGH |
| 7 | Memory exhaustion — OOM killer | INCIDENT | HIGH |
| 8 | Disk full — System halt | INCIDENT | EMERGENCY |
| 9 | Deployment failure — Rollback | DEPLOYMENT | HIGH |
| 10 | Feature flag misconfiguration | CONFIGURATION | MEDIUM |
| 11 | Model degradation — Calibration drift | MONITORING | MEDIUM |
| 12 | Performance degradation — General | INCIDENT | MEDIUM |
| 13 | Security incident — Breach response | SECURITY | EMERGENCY |
| 14 | Secret rotation — API keys | MAINTENANCE | MEDIUM |
| 15 | Database migration — Failed | DEPLOYMENT | HIGH |
| 16 | Certificate expiry | MAINTENANCE | MEDIUM |
| 17 | Disaster recovery — Region failover | RECOVERY | EMERGENCY |
| 18 | Backup verification — Monthly test | MAINTENANCE | MEDIUM |
| 19 | New provider onboarding | CONFIGURATION | LOW |
| 20 | New team member onboarding | CONFIGURATION | LOW |

**Runbook Template:**

```markdown
# RUNBOOK: [Title]

## Metadata
- ID: rbk_XXXXX
- Category: [Category]
- Severity: [LOW/MEDIUM/HIGH/EMERGENCY]
- Time to Execute: [Time]
- Last Reviewed: [Date]

## Symptoms
- Symptom 1
- Symptom 2

## Prerequisites
- Access to [System]
- [Tool] installed
- Permission to [Action]

## Steps

### Step 1: [Title]
1. [Detailed instruction]
2. `[Command to run]`
3. Expected: [Expected output]

### Step 2: [Title]
...

## Verification
1. Check [metric] is [expected value]
2. Verify [component] reports [status]

## Rollback
If something goes wrong:
1. `[Rollback command]`

## Escalation
If not resolved in [time]:
1. Contact [Person/Team] via [Channel]

## Notes
- [Additional context]
```

---

## SRE Dashboard

**Purpose:** Single dashboard for SRE metrics — SLI/SLO compliance, error budgets, capacity forecasts, and incident status.

```
┌─────────────────────────────────────────────────────────────┐
│  SRE Dashboard                              Status: HEALTHY │
├─────────────────────────────────────────────────────────────┤
│  SLA Compliance:   99.95% (Target: 99.9%)   ✅ ON TRACK    │
│  Error Budget:     78.3% remaining          ✅ SAFE        │
│  MTTR (30d):       12.5 min                 📉 -15% WoW   │
│  MTBF (30d):       14.2 days                📈 +20% WoW   │
├───────────────────┬───────────────────┬─────────────────────┤
│  SLO Name         │ Compliance        │ Error Budget        │
├───────────────────┼───────────────────┼─────────────────────┤
│  Provider Req     │ 99.93%           │ 82% remaining       │
│  Queue Processing │ 99.97%           │ 91% remaining       │
│  Predictions      │ 99.45% ⚠️       │ 45% remaining ⚠️    │
│  Database Queries │ 99.99%           │ 99% remaining       │
│  API Endpoints    │ 99.99%           │ 98% remaining       │
│  System Uptime    │ 99.98%           │ 95% remaining       │
├───────────────────┴───────────────────┴─────────────────────┤
│  Incident Summary (30d):                                    │
│  ● 3 Incidents (1 critical, 2 minor)                       │
│  ● Avg time to detect: 2.3 min                             │
│  ● Avg time to resolve: 12.5 min                          │
│  ● Total downtime: 37.5 min                                │
├─────────────────────────────────────────────────────────────┤
│  Capacity Forecast:                                         │
│  ● Database: 72% used → 88% in 90d (⚠️ threshold: 85%)    │
│  ● Storage:  64% used → 78% in 90d                        │
│  ● Workers:  45% utilized → 62% in 90d                    │
│  ● API:      12K/day → 18K/day in 90d                     │
├─────────────────────────────────────────────────────────────┤
│  Cost Summary (Current Month):                              │
│  ● Total: $342.50  │  Budget: $500  │  68.5% used         │
│  ● API Providers: $215.80  ● DB: $89.20  ● Hosting: $37.50 │
└─────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
src/
├── sre/
│   ├── interfaces/
│   │   ├── IConfigManager.ts
│   │   ├── ISecretManager.ts
│   │   ├── IEnvironmentValidator.ts
│   │   ├── IFeatureFlagManager.ts
│   │   ├── IReleaseManager.ts
│   │   ├── IDeploymentVerifier.ts
│   │   ├── ICanaryDeployment.ts
│   │   ├── IRollbackManager.ts
│   │   ├── IBackupManager.ts
│   │   ├── IDisasterRecovery.ts
│   │   ├── ISLISLOFramework.ts
│   │   ├── IErrorBudget.ts
│   │   ├── ICapacityPlanner.ts
│   │   ├── ICostMonitor.ts
│   │   ├── IDependencyHealth.ts
│   │   ├── ISecurityAuditor.ts
│   │   └── IRunbookManager.ts
│   ├── config/
│   │   ├── ConfigManager.ts
│   │   ├── ConfigSchema.ts
│   │   └── ConfigValidator.ts
│   ├── secrets/
│   │   ├── SecretManager.ts
│   │   └── SecretRotator.ts
│   ├── environment/
│   │   └── EnvironmentValidator.ts
│   ├── featureflags/
│   │   ├── FeatureFlagManager.ts
│   │   └── FeatureFlagEvaluator.ts
│   ├── release/
│   │   ├── ReleaseManager.ts
│   │   └── ChangelogGenerator.ts
│   ├── deployment/
│   │   ├── DeploymentVerifier.ts
│   │   ├── CanaryDeployment.ts
│   │   └── RollbackManager.ts
│   ├── backup/
│   │   ├── BackupManager.ts
│   │   └── RestoreManager.ts
│   ├── dr/
│   │   └── DisasterRecovery.ts
│   ├── slo/
│   │   ├── SLISLOFramework.ts
│   │   ├── ErrorBudget.ts
│   │   └── BurnRate.ts
│   ├── capacity/
│   │   ├── CapacityPlanner.ts
│   │   └── GrowthForecaster.ts
│   ├── cost/
│   │   ├── CostMonitor.ts
│   │   └── CostAnomalyDetector.ts
│   ├── dependency/
│   │   └── DependencyHealth.ts
│   ├── security/
│   │   └── SecurityAuditor.ts
│   ├── runbooks/
│   │   ├── RunbookManager.ts
│   │   └── runbooks/                    // YAML/MD files
│   │       ├── provider-outage.yaml
│   │       ├── database-failure.yaml
│   │       ├── queue-backlog.yaml
│   │       └── ... (20 runbooks)
│   ├── types/
│   │   ├── ConfigTypes.ts
│   │   ├── SLOTypes.ts
│   │   ├── DRTypes.ts
│   │   └── RunbookTypes.ts
│   └── __tests__/
│       ├── ConfigManager.test.ts
│       ├── SecretManager.test.ts
│       ├── EnvironmentValidator.test.ts
│       ├── FeatureFlagManager.test.ts
│       ├── ReleaseManager.test.ts
│       ├── DeploymentVerifier.test.ts
│       ├── CanaryDeployment.test.ts
│       ├── RollbackManager.test.ts
│       ├── BackupManager.test.ts
│       ├── DisasterRecovery.test.ts
│       ├── SLISLOFramework.test.ts
│       ├── ErrorBudget.test.ts
│       ├── CapacityPlanner.test.ts
│       ├── CostMonitor.test.ts
│       ├── DependencyHealth.test.ts
│       └── SecurityAuditor.test.ts
```

---

## Database Tables (SRE)

```sql
-- Configuration (versioned)
CREATE TABLE sre_config (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  sensitive BOOLEAN NOT NULL DEFAULT false,
  version INTEGER NOT NULL DEFAULT 1,
  schema_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT NOT NULL
);

-- Feature Flags
CREATE TABLE sre_feature_flags (
  name TEXT PRIMARY KEY,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT false,
  owner TEXT NOT NULL,
  rollout_config JSONB NOT NULL DEFAULT '{}',
  variants JSONB,
  dependencies TEXT[] DEFAULT '{}',
  expiry_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Feature Flag Changes (audit log)
CREATE TABLE sre_feature_flag_changes (
  id TEXT PRIMARY KEY,
  flag_name TEXT NOT NULL REFERENCES sre_feature_flags(name),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by TEXT NOT NULL,
  before_state JSONB,
  after_state JSONB,
  reason TEXT NOT NULL
);

-- Releases
CREATE TABLE sre_releases (
  version TEXT PRIMARY KEY,
  git_commit TEXT NOT NULL,
  git_tag TEXT,
  build_id TEXT NOT NULL,
  build_time TIMESTAMPTZ NOT NULL,
  deployed_at TIMESTAMPTZ,
  deployed_by TEXT,
  environment TEXT NOT NULL,
  status TEXT NOT NULL,
  changelog JSONB NOT NULL DEFAULT '[]',
  verification_results JSONB NOT NULL DEFAULT '[]',
  rollback_version TEXT,
  artifacts JSONB DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SLI/SLO
CREATE TABLE sre_sli (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  labels JSONB DEFAULT '{}',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sre_slo (
  name TEXT PRIMARY KEY,
  description TEXT,
  sli_name TEXT NOT NULL,
  target_percent DOUBLE PRECISION NOT NULL,
  window_days INTEGER NOT NULL DEFAULT 30,
  severity TEXT NOT NULL,
  error_budget_minutes DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backups
CREATE TABLE sre_backups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  target TEXT NOT NULL,
  size_bytes BIGINT,
  compressed_size_bytes BIGINT,
  encrypted BOOLEAN NOT NULL DEFAULT false,
  checksum TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retention_until TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'
);

-- Rollbacks
CREATE TABLE sre_rollbacks (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  triggered_by TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  from_version TEXT NOT NULL,
  to_version TEXT NOT NULL,
  reason TEXT NOT NULL,
  result TEXT NOT NULL,
  duration_ms INTEGER NOT NULL
);

-- Dependency Health
CREATE TABLE sre_dependencies (
  name TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  version TEXT NOT NULL,
  expected_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'UNKNOWN',
  latency_ms INTEGER,
  last_check TIMESTAMPTZ,
  last_successful_check TIMESTAMPTZ,
  uptime_percent DOUBLE PRECISION DEFAULT 100,
  deprecation_warning TEXT,
  critical BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_sli_name_time ON sre_sli(name, recorded_at DESC);
CREATE INDEX idx_releases_env ON sre_releases(environment, deployed_at DESC);
CREATE INDEX idx_backups_created ON sre_backups(created_at DESC);
CREATE INDEX idx_rollbacks_time ON sre_rollbacks(timestamp DESC);
```

---

## Verification Checklist

- [ ] Configuration Management: centralized, validated, versioned, hierarchical
- [ ] Secret Management: encrypted storage, rotation policies, access audit
- [ ] Environment Validation: pre-flight checks, dependency validation, config validation
- [ ] Feature Flag Management: toggle-based deployment, gradual rollout, kill switches
- [ ] Release Management: version tracking, changelog generation, promotion path
- [ ] Deployment Verification: health gates, smoke tests, metrics validation
- [ ] Canary Deployment: gradual traffic, metrics watching, auto-promote/rollback
- [ ] Rollback Automation: one-click rollback, auto-rollback triggers, migration revert
- [ ] Backup & Restore: automated backups, point-in-time recovery, restore testing
- [ ] Disaster Recovery: RTO/RPO defined, DR runbooks documented, DR drills
- [ ] SLI/SLO Framework: indicators defined, objectives set, compliance tracked
- [ ] Error Budget: budget calculation, tracking, burn rate alerting, policy enforcement
- [ ] Capacity Planning: resource trending, growth forecasting, scaling recommendations
- [ ] Cost Monitoring: cost allocation, budget tracking, anomaly detection
- [ ] Dependency Health: external/internal monitoring, version tracking, deprecation alerts
- [ ] Security Audit: dependency scanning, vulnerability assessment, access control review
- [ ] Operational Runbooks: 20+ runbooks documented, tested, reviewed
- [ ] SRE dashboard: SLI/SLO compliance, error budgets, capacity, cost
- [ ] DR tested and verified
- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npx vitest run` — all tests pass
- [ ] `npx madge --circular` — zero circular dependencies
- [ ] ADR updated for SRE architecture
- [ ] Verification report generated

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Configuration drift | Versioned configs; validation on every start; alerts on mismatch |
| Secret leakage | Encrypted storage; access audit; automatic rotation; never logged |
| Failed deployment | Canary deployment; deployment verification; automated rollback |
| Data loss | Automated backups; point-in-time recovery; restore testing |
| Catastrophic failure | DR plan; documented failover; regular DR drills |
| Resource exhaustion | Capacity planning; growth forecasting; auto-scaling |
| Cost overrun | Cost monitoring; budget alerts; anomaly detection |
| Dependency failure | Dependency health monitoring; failover circuits |
| Security breach | Regular scanning; vulnerability patching; access audit |
| Operator error | Runbooks; automation; verification gates |