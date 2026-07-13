# EPIC 22 — Live Data Intelligence Platform

**Category:** Operational Intelligence Layer  
**Dependencies:** None (builds directly on existing Research Layer)  
**Target Completion:** Phase II-A (Weeks 1–4)  
**Critical Path:** Foundation for EPIC 23 and 24  
**Codename:** HERMES-22

---

## Mission Statement

Build the single entry point for all external data in HandicapLab. No module outside this EPIC may directly access any external provider. All external data must flow through a unified Provider Abstraction Layer that normalizes, validates, archives, and scores every payload before it reaches business logic.

**Target outcome:** Any developer working on EPIC 23, EPIC 24, or the Commercial Layer can consume data without knowing which provider it came from. Provider switching, failover, and addition are configuration changes, not code changes.

---

## Architecture

```
External Providers
│
├── API-Football ───┐
├── Football-Data ──┤
├── The Odds API ───┤
├── Pinnacle ───────┤
└── [Future] ───────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│              Provider Abstraction Layer              │
│                                                     │
│  ┌─────────────────┐  ┌──────────────────────────┐  │
│  │ Provider Registry│  │ Adapter Factory          │  │
│  │ - Register       │  │ - Resolves provider      │  │
│  │ - Resolve        │  │ - Returns adapter instance│  │
│  │ - Health Check   │  │ - Circuit breaker state   │  │
│  │ - Priority Order │  └──────────────────────────┘  │
│  └─────────────────┘                                 │
│                                                     │
│  ┌─────────────────┐  ┌──────────────────────────┐  │
│  │ Adapters         │  │ Provider Infrastructure  │  │
│  │ - FixtureAdapter │  │ - Circuit Breaker        │  │
│  │ - OddsAdapter    │  │ - Retry Policy           │  │
│  │ - StandingsAdapt │  │ - Exponential Backoff    │  │
│  │ - TeamAdapter    │  │ - Rate Limiting          │  │
│  │ - InjuryAdapter  │  │ - Health Monitoring      │  │
│  │ - LineupAdapter  │  └──────────────────────────┘  │
│  │ - ResultAdapter  │                                 │
│  └─────────────────┘                                 │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│              Data Processing Pipeline                │
│                                                     │
│  ┌─────────────────┐  ┌──────────────────────────┐  │
│  │ Canonical Model  │  │ Odds Merger & Dedup     │  │
│  │ - FixtureSchema  │  │ - Multi-source odds     │  │
│  │ - OddsSchema     │  │ - Timestamp ordering    │  │
│  │ - TeamSchema     │  │ - Best price selection  │  │
│  │ - ResultSchema   │  │ - Consensus computation │  │
│  └─────────────────┘  └──────────────────────────┘  │
│                                                     │
│  ┌─────────────────┐  ┌──────────────────────────┐  │
│  │ Data Quality     │  │ Raw Response Archival    │  │
│  │ - Missing Field  │  │ - Compressed storage     │  │
│  │ - Stale Data     │  │ - Checksum verification  │  │
│  │ - Inconsistency  │  │ - Reproducibility hash   │  │
│  │ - Confidence     │  └──────────────────────────┘  │
│  │ - Composite Score│                                 │
│  └─────────────────┘                                 │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│              Scheduler Orchestration                 │
│                                                     │
│  ┌─────────────────┐  ┌──────────────────────────┐  │
│  │ Fixture Sync     │  │ Odds Sync                │  │
│  │ - Daily schedule │  │ - Configurable interval  │  │
│  │ - League filter  │  │ - Market filter          │  │
│  │ - Season detect  │  │ - Last-minute capture    │  │
│  └─────────────────┘  └──────────────────────────┘  │
│                                                     │
│  ┌─────────────────┐  ┌──────────────────────────┐  │
│  │ Result Sync      │  │ Data Lineage             │  │
│  │ - Post-match     │  │ - Provider tracking      │  │
│  │ - Auto-settle    │  │ - Timestamp per record   │  │
│  │ - Gap detection  │  │ - Adapter version hash   │  │
│  └─────────────────┘  │ - Checksum per payload    │  │
│                        │ - Quality score per rec   │  │
│                        └──────────────────────────┘  │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│              Provider Health Dashboard               │
│                                                     │
│  Metrics per provider: Availability │ Latency        │
│  Error Rate │ Quota Usage │ Rate Limit Hit Count    │
└─────────────────────────────────────────────────────┘
         │
         ▼
   Canonical Data Store
   (Consumed by EPIC 23, 24, and Commercial Layer)
```

---

## Detailed Module Specifications

### 1. Provider Registry

**Purpose:** Central registry of all configured providers. Acts as the service locator for data access.

**Interface:**
```typescript
interface IProviderRegistry {
  register(provider: ProviderConfig): void;
  unregister(providerId: string): void;
  resolve(type: DataType, options?: ProviderResolveOptions): IProviderAdapter;
  getProvider(providerId: string): ProviderStatus;
  listProviders(): ProviderStatus[];
  getHealthSummary(): ProviderHealthSummary;
}

interface ProviderConfig {
  id: string;                    // "api-football", "football-data", etc.
  name: string;
  type: ProviderType;            // API, CSV, Webhook
  priority: number;              // Lower = higher priority for failover
  enabled: boolean;
  config: Record<string, unknown>;
  rateLimit: RateLimitConfig;
  circuitBreaker: CircuitBreakerConfig;
  healthCheck: HealthCheckConfig;
  supportedDataTypes: DataType[]; // FIXTURES, ODDS, RESULTS, STANDINGS, etc.
}

interface ProviderResolveOptions {
  dataType: DataType;
  preferProvider?: string;       // Route to specific provider
  allowFailover?: boolean;       // Allow fallback if primary fails
  qualityThreshold?: number;     // Minimum quality score
}
```

**Provider Priority & Failover Order:**
```
Primary (Priority 1) → Secondary (Priority 2) → Tertiary (Priority 3)
Failover triggers when:
  1. Primary returns error (circuit breaker open)
  2. Primary exceeds latency threshold
  3. Primary data quality score drops below threshold
  4. Primary rate limit exhausted
```

### 2. Provider Adapters

**Purpose:** Each provider implements adapter interfaces. Adapters translate provider-specific response formats into canonical data.

**Base Adapter Interface:**
```typescript
interface IProviderAdapter {
  readonly providerId: string;
  readonly supportedDataTypes: DataType[];
  readonly version: string;
  readonly health: ProviderHealth;

  initialize(): Promise<void>;
  healthCheck(): Promise<HealthStatus>;
  
  // Data access methods
  getFixtures(params: FixtureQuery): Promise<CanonicalFixture[]>;
  getOdds(params: OddsQuery): Promise<CanonicalOdds[]>;
  getStandings(params: StandingsQuery): Promise<CanonicalStandings[]>;
  getTeams(params: TeamQuery): Promise<CanonicalTeam[]>;
  getInjuries(params: InjuryQuery): Promise<CanonicalInjury[]>;
  getLineups(params: LineupQuery): Promise<CanonicalLineup[]>;
  getResults(params: ResultQuery): Promise<CanonicalResult[]>;
  
  // Lifecycle
  shutdown(): Promise<void>;
}
```

**Adapter Implementations Required:**
- `ApiFootballAdapter` — Wraps API-Football (current primary)
- `FootballDataAdapter` — Wraps Football-Data.org
- `OddsApiAdapter` — Wraps The Odds API
- `PinnacleAdapter` — Wraps Pinnacle API (if available)
- `MockProviderAdapter` — For testing without live data

**Adapter Contract:**
- Every adapter must pass its own unit tests against recorded responses
- Every adapter must handle rate limiting without crashing
- Every adapter must implement exponential backoff
- Every adapter must report health status

### 3. Provider Infrastructure

#### Circuit Breaker

```typescript
interface ICircuitBreaker {
  readonly state: CircuitState;  // CLOSED, OPEN, HALF_OPEN
  readonly failureCount: number;
  readonly lastFailureTime: number | null;

  call<T>(fn: () => Promise<T>): Promise<T>;
  recordSuccess(): void;
  recordFailure(): void;
  reset(): void;
}

interface CircuitBreakerConfig {
  failureThreshold: number;          // Default: 5
  successThreshold: number;          // Default: 2 (for half-open)
  timeoutMs: number;                 // Default: 30_000
  halfOpenMaxRequests: number;       // Default: 1
}
```

#### Retry Policy

```typescript
interface IRetryPolicy {
  maxRetries: number;                // Default: 3
  baseDelayMs: number;               // Default: 1_000
  maxDelayMs: number;                // Default: 60_000
  jitterFactor: number;              // Default: 0.1 (10% randomness)
  
  execute<T>(fn: () => Promise<T>, context?: string): Promise<T>;
  getAttemptCount(): number;
  reset(): void;
}

// Exponential backoff formula:
// delay = min(maxDelayMs, baseDelayMs * 2^attempt) * (1 + random(-jitter, +jitter))
```

#### Rate Limiter

```typescript
interface IRateLimiter {
  readonly providerId: string;
  readonly remaining: number;
  readonly resetTime: number;        // Unix timestamp
  readonly limit: number;

  acquire(permits?: number): Promise<void>;
  tryAcquire(permits?: number): boolean;
  release(): void;
  updateLimit(response: RateLimitHeaders): void;
}

interface RateLimitConfig {
  maxRequestsPerSecond: number;
  maxRequestsPerMinute: number;
  maxRequestsPerDay: number;
  burstSize: number;
  cooldownPercentile: number;        // Wait at this percentile of limit window
}
```

#### Health Monitor

```typescript
interface IHealthMonitor {
  readonly providerId: string;
  readonly status: ProviderHealth;

  recordLatency(durationMs: number): void;
  recordError(error: Error): void;
  recordSuccess(): void;
  getHealthSnapshot(): HealthSnapshot;
  checkNow(): Promise<HealthStatus>;
}

interface ProviderHealth {
  status: HealthStatus;              // HEALTHY, DEGRADED, DOWN
  lastCheck: number;
  uptimePercent: number;             // Rolling 24h
  avgLatencyMs: number;              // Rolling 5m
  p95LatencyMs: number;              // Rolling 5m
  errorRate: number;                 // Rolling 5m
  quotaUsed: number;
  quotaRemaining: number;
}
```

### 4. Canonical Data Model

**Purpose:** Every provider produces the same structure. No downstream code ever sees provider-specific formats.

```typescript
// ── Fixture ──
interface CanonicalFixture {
  fixtureId: string;                 // Canonical ID (fxt_xxxxxxxx)
  providerFixtureId: string;         // Original provider ID
  providerId: string;                // Which provider
  league: LeagueInfo;
  season: string;                    // "2024-2025"
  round: string | null;
  date: string;                      // ISO 8601
  kickoffTime: string;               // ISO 8601
  homeTeam: TeamInfo;
  awayTeam: TeamInfo;
  venue: string | null;
  status: FixtureStatus;             // SCHEDULED, LIVE, FINISHED, POSTPONED, CANCELLED
  metadata: Record<string, unknown>; // Provider-specific extras
}

interface LeagueInfo {
  leagueId: string;
  name: string;
  country: string;
  logo?: string;
  seasonStart?: string;
  seasonEnd?: string;
}

interface TeamInfo {
  teamId: string;
  name: string;
  shortName?: string;
  logo?: string;
  country?: string;
}

// ── Odds ──
interface CanonicalOdds {
  oddsId: string;                    // Canonical ID (odd_xxxxxxxx)
  fixtureId: string;                 // Links to fixture
  providerId: string;
  providerOddId: string;
  bookmaker: string;
  marketType: MarketType;            // MONEYLINE, ASIAN_HANDICAP, OVER_UNDER, BTTS, DOUBLE_CHANCE
  line: number;                      // 0 for moneyline, handicap value for AH, total for OU
  timestamp: string;                 // ISO 8601 when captured
  priceHome: number | null;
  priceAway: number | null;
  priceDraw: number | null;
  isOpening: boolean;
  isClosing: boolean;
  vig: number;                       // Calculated vig percentage
  fairProbHome: number;              // Vig-removed probability
  fairProbAway: number;
  fairProbDraw: number | null;
  metadata: Record<string, unknown>;
}

enum MarketType {
  MONEYLINE = 'moneyline',
  ASIAN_HANDICAP = 'asian_handicap',
  OVER_UNDER = 'over_under',
  BTTS = 'btts',
  DOUBLE_CHANCE = 'double_chance',
  CORRECT_SCORE = 'correct_score',
  HALF_TIME = 'half_time',
  PLAYER_PROPS = 'player_props',
}

// ── Standings ──
interface CanonicalStandings {
  standingsId: string;
  leagueId: string;
  season: string;
  teamId: string;
  position: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: string;                      // "WWDLW" format
  metadata: Record<string, unknown>;
}

// ── Team Statistics ──
interface CanonicalTeamStats {
  statsId: string;
  fixtureId: string;
  teamId: string;
  possession: number | null;
  shotsTotal: number | null;
  shotsOnTarget: number | null;
  corners: number | null;
  fouls: number | null;
  yellowCards: number | null;
  redCards: number | null;
  offsides: number | null;
  expectedGoals: number | null;      // xG
  metadata: Record<string, unknown>;
}

// ── Injury ──
interface CanonicalInjury {
  injuryId: string;
  playerId: string;
  playerName: string;
  teamId: string;
  injuryType: string;
  severity: string;                  // MINOR, MODERATE, SEVERE
  expectedReturn: string | null;     // ISO 8601
  status: string;                    // INJURED, DOUBTFUL, QUESTIONABLE
  lastUpdated: string;
  metadata: Record<string, unknown>;
}

// ── Lineup ──
interface CanonicalLineup {
  lineupId: string;
  fixtureId: string;
  teamId: string;
  formation: string;                 // "4-3-3"
  starters: PlayerInfo[];
  substitutes: PlayerInfo[];
  coach: string;
  metadata: Record<string, unknown>;
}

interface PlayerInfo {
  playerId: string;
  name: string;
  position: string;
  number: number;
}

// ── Result ──
interface CanonicalResult {
  resultId: string;
  fixtureId: string;
  homeScore: number;
  awayScore: number;
  homeHalfTimeScore: number | null;
  awayHalfTimeScore: number | null;
  status: string;                    // FINISHED, AWARDED, ABANDONED
  winner: MatchWinner;               // HOME, AWAY, DRAW
  matchDuration: number;             // Minutes played
  metadata: Record<string, unknown>;
}

enum MatchWinner {
  HOME = 'home',
  AWAY = 'away',
  DRAW = 'draw',
}
```

### 5. Odds Merger & Deduplication

**Purpose:** When multiple providers offer odds for the same fixture, merge them into a unified view.

```typescript
interface IOddsMerger {
  merge(oddsList: CanonicalOdds[]): MergedOddsView;
  deduplicate(oddsList: CanonicalOdds[]): CanonicalOdds[];
  computeConsensus(oddsList: CanonicalOdds[]): ConsensusOdds;
  findBestPrices(oddsList: CanonicalOdds[]): BestPrices;
}

interface MergedOddsView {
  fixtureId: string;
  providers: string[];               // Which providers contributed
  bookmakers: BookmakerOdds[];
  consensus: ConsensusOdds;
  bestPrices: BestPrices;
  mergeTimestamp: string;
  mergeVersion: string;
}

interface BookmakerOdds {
  bookmaker: string;
  providerId: string;
  markets: MarketOdds[];
  capturedAt: string;
}

interface MarketOdds {
  marketType: MarketType;
  home: number;
  away: number;
  draw: number | null;
  line: number;
}

interface ConsensusOdds {
  marketType: MarketType;
  home: number;
  away: number;
  draw: number | null;
  providerCount: number;
  variance: number;                  // Low = high agreement
}

interface BestPrices {
  marketType: MarketType;
  home: BestPriceInfo;
  away: BestPriceInfo;
  draw: BestPriceInfo | null;
}

interface BestPriceInfo {
  price: number;
  provider: string;
  bookmaker: string;
}
```

**Deduplication Rules:**
1. Same provider + same fixture + same market + same line + same timestamp = deduplicate (keep latest)
2. Different provider + same fixture + same market = merge, keep both
3. Same provider + same fixture + same market + different timestamp = keep oldest (opening) + newest (closing)
4. Identical payload (by checksum) = skip silently

### 6. Raw Response Archival

**Purpose:** Every raw response from every provider is stored verbatim for reproducibility.

```typescript
interface IRawArchiver {
  archive(providerId: string, response: RawResponse): Promise<ArchiveRecord>;
  getArchive(archiveId: string): Promise<ArchiveRecord>;
  findByProvider(providerId: string, options?: ArchiveQuery): Promise<ArchiveRecord[]>;
  findByChecksum(checksum: string): Promise<ArchiveRecord | null>;
  verifyIntegrity(archiveId: string): Promise<boolean>;
  replay(archiveId: string): Promise<RawResponse>;  // Reconstruct original payload
}

interface RawResponse {
  providerId: string;
  endpoint: string;
  requestParams: Record<string, unknown>;
  responseBody: string;              // Raw JSON/XML
  responseHeaders: Record<string, string>;
  statusCode: number;
  timestamp: string;
  durationMs: number;
}

interface ArchiveRecord {
  archiveId: string;
  providerId: string;
  checksum: string;                  // SHA-256 of raw body
  sizeBytes: number;
  compressedSizeBytes: number;
  storedAt: string;
  expiryAt: string;                  // 90-day retention
  dataType: DataType;
}
```

**Retention Policy:**
- Raw payloads: 90 days
- Compressed using gzip
- Checksum verified on retrieval
- Sharded by provider + date

### 7. Data Quality Scoring

**Purpose:** Every record entering the system receives a quality score. Downstream modules can filter by threshold.

```typescript
interface IDataQualityScorer {
  scoreFixture(fixture: CanonicalFixture): QualityScore;
  scoreOdds(odds: CanonicalOdds[]): QualityScore;
  scoreResult(result: CanonicalResult): QualityScore;
  scoreProviderBatch(providerId: string, batch: DataBatch): QualityScore;
}

interface QualityScore {
  overall: number;                   // 0–100 composite
  components: QualityComponents;
  warnings: QualityWarning[];
  timestamp: string;
  scorerVersion: string;
}

interface QualityComponents {
  completeness: number;              // % of required fields present
  timeliness: number;                // How recent the data is
  consistency: number;               // Internal consistency (e.g., odds sum to vig)
  accuracy: number;                  // Deviations from expected ranges
  providerConfidence: number;        // Provider historical reliability
}

interface QualityWarning {
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  category: string;                  // MISSING_FIELD, STALE_DATA, OUTLIER, INCONSISTENCY
  message: string;
  field?: string;
  value?: unknown;
  threshold?: number;
}
```

**Quality Thresholds:**
| Score Range | Label | Action |
|-------------|-------|--------|
| 90–100 | Excellent | Pass through immediately |
| 70–89 | Good | Pass through with warning |
| 50–69 | Fair | Route for manual review |
| 0–49 | Poor | Block from pipeline |

### 8. Data Lineage

**Purpose:** Every record is traceable to its source.

```typescript
interface IDataLineage {
  recordOrigin(recordId: string): Promise<LineageRecord>;
  traceFixture(fixtureId: string): Promise<FixtureLineage>;
  traceOdds(oddsId: string): Promise<OddsLineage>;
  traceResult(resultId: string): Promise<ResultLineage>;
}

interface LineageRecord {
  recordId: string;
  dataType: DataType;
  providerId: string;
  adapterVersion: string;
  fetchTimestamp: string;
  rawArchiveId: string;
  canonicalVersion: string;
  qualityScore: QualityScore;
  parentRecords: string[];          // IDs of source records
  childRecords: string[];           // IDs of derived records
  checksum: string;                  // SHA-256 of canonical record
  transformChain: TransformStep[];   // Every transformation applied
}

interface TransformStep {
  name: string;
  version: string;
  inputChecksum: string;
  outputChecksum: string;
  durationMs: number;
}
```

### 9. Scheduler Orchestration

**Purpose:** Automate when and how data is fetched.

```typescript
interface IDataScheduler {
  scheduleFixtureSync(config: FixtureSyncConfig): ScheduleHandle;
  scheduleOddsSync(config: OddsSyncConfig): ScheduleHandle;
  scheduleResultSync(config: ResultSyncConfig): ScheduleHandle;
  cancelSchedule(handle: ScheduleHandle): void;
  listActiveSchedules(): ScheduleInfo[];
  getScheduleStatus(handle: ScheduleHandle): ScheduleStatus;
}

interface FixtureSyncConfig {
  leagues: string[];                 // Which leagues to sync
  season?: string;                   // Season filter
  interval: CronExpression;          // "0 0 * * *" = daily at midnight
  autoDetectNewSeasons: boolean;
  providerPriority: string[];        // Provider failover order
}

interface OddsSyncConfig {
  leagues: string[];                 // Which leagues to sync
  marketTypes: MarketType[];         // Which markets
  intervalMinutes: number;           // How often to poll (default: 5)
  captureOpening: boolean;           // Capture opening odds
  captureClosing: boolean;           // Capture closing odds (last before kickoff)
  closingWindowMinutes: number;      // How close to kickoff counts as "closing"
  captureInterval: CaptureInterval;  // FULL, DIFFERENTIAL, LAST_ONLY
}

interface ResultSyncConfig {
  leagues: string[];
  checkInterval: CronExpression;     // "0 */6 * * *" = every 6 hours
  autoSettlePredictions: boolean;    // Auto-trigger settlement on new result
  retryFailedMatches: boolean;       // Retry if result not yet available
  gapDetectionDays: number;          // Alert if no results for this many days
}
```

---

## Provider Health Dashboard (Internal)

**Purpose:** Internal dashboard for monitoring provider health. Not exposed to end users.

**Metrics per Provider:**
| Metric | Source | Refresh |
|--------|--------|---------|
| Availability (24h) | Health monitor | 1 minute |
| Average Latency | Health monitor | 1 minute |
| P95 Latency | Health monitor | 1 minute |
| Error Rate | Health monitor | 1 minute |
| Quota Used | Rate limiter | Per request |
| Quota Remaining | Rate limiter | Per request |
| Rate Limit Hits | Rate limiter | Per request |
| Circuit Breaker State | Circuit breaker | Real-time |
| Data Quality Score | Quality scorer | Per batch |
| Last Successful Fetch | Health monitor | Real-time |
| Fixtures Collected | Data scheduler | Per sync |
| Odds Snapshots | Data scheduler | Per sync |

**Alert Thresholds:**
| Metric | Warning | Critical |
|--------|---------|----------|
| Availability | < 99% | < 95% |
| Avg Latency | > 2000ms | > 5000ms |
| Error Rate | > 5% | > 10% |
| Quota Usage | > 80% | > 95% |
| Data Quality | < 70 | < 50 |
| Circuit Breaker | HALF_OPEN | OPEN |

---

## Data Flow Examples

### Example 1: Fetch Fixtures

```
1. Consumer calls providerRegistry.resolve(DataType.FIXTURES)
2. Registry returns highest-priority healthy provider adapter
3. Consumer calls adapter.getFixtures({ league: 'EPL', season: '2024-2025' })
4. Circuit breaker wraps the call
5. Rate limiter acquires permit
6. Adapter calls external API
7. Raw response is archived (compressed + checksummed)
8. Adapter translates raw → CanonicalFixture[]
9. Quality scorer evaluates each fixture
10. Data lineage record created for each fixture
11. Canonical fixtures returned to consumer
12. Health monitor records latency + success
13. If failed: retry policy executes, circuit breaker records failure
```

### Example 2: Odds Collection Cycle

```
1. Scheduler triggers odds sync for EPL league
2. For each active fixture:
   a. Resolve best odds provider
   b. Call adapter.getOdds({ fixtureId, marketTypes: ['moneyline', 'asian_handicap'] })
   c. Raw response archived
   d. Canonical odds returned
   e. Odds merger deduplicates against existing odds
   f. If opening odds (first capture): tag as opening
   g. If within closing window: tag as closing candidate
   h. Store merged odds view
   i. Update data lineage
3. After all fixtures: log batch summary
4. If any provider failed: trigger failover
```

---

## Testing Requirements

### Unit Tests
| Module | Test Cases | Coverage Target |
|--------|------------|-----------------|
| Provider Registry | Registration, resolution, failover, health check | 95% |
| Adapters | Response parsing, error handling, edge cases | 95% |
| Circuit Breaker | State transitions, failure thresholds, reset | 100% |
| Retry Policy | Backoff timing, max attempts, jitter | 100% |
| Rate Limiter | Permit acquisition, limit enforcement, burst | 100% |
| Health Monitor | Metrics aggregation, status computation | 95% |
| Canonical Model | Validation, serialization, schema conformance | 100% |
| Odds Merger | Deduplication, consensus, best price | 95% |
| Raw Archiver | Archive, retrieve, checksum verify | 100% |
| Quality Scorer | Scoring algorithms, warnings, thresholds | 95% |
| Data Lineage | Record trace, transform chain | 95% |
| Data Scheduler | Schedule management, trigger execution | 95% |

### Integration Tests
- End-to-end: Provider → Adapter → Canonical → Quality → Archive
- Failover: Primary provider fails → Secondary takes over
- Rate limiting: Exceed rate limit → Graceful backoff
- Circuit breaker: Repeated failures → Circuit opens → Half-open → Closed
- Data lineage: Trace a record from canonical back to raw archive
- Odds merge: Multiple sources → Correct consensus

### Mock Provider
A `MockProviderAdapter` must be created for testing:
- Configurable responses per endpoint
- Configurable failure modes
- Simulated latency
- Simulated rate limiting
- Recorded call history for assertions

---

## Performance Targets

| Operation | Target (p50) | Target (p95) | Max |
|-----------|--------------|--------------|-----|
| Provider resolution | < 5ms | < 20ms | 50ms |
| Fixture fetch (single) | < 500ms | < 2000ms | 5000ms |
| Fixture fetch (batch) | < 3000ms | < 10000ms | 30000ms |
| Odds fetch (single fixture) | < 500ms | < 2000ms | 5000ms |
| Odds merge + dedup (100 odds) | < 100ms | < 300ms | 500ms |
| Quality scoring (100 records) | < 50ms | < 100ms | 200ms |
| Raw archival (100KB payload) | < 20ms | < 50ms | 100ms |
| Data lineage trace | < 10ms | < 30ms | 50ms |
| Full odds sync (100 fixtures) | < 30s | < 60s | 120s |

---

## Directory Structure

```
src/
├── providers/
│   ├── interfaces/
│   │   ├── IProviderRegistry.ts
│   │   ├── IProviderAdapter.ts
│   │   ├── ICircuitBreaker.ts
│   │   ├── IRetryPolicy.ts
│   │   ├── IRateLimiter.ts
│   │   ├── IHealthMonitor.ts
│   │   ├── IOddsMerger.ts
│   │   ├── IRawArchiver.ts
│   │   ├── IDataQualityScorer.ts
│   │   └── IDataLineage.ts
│   ├── registry/
│   │   └── ProviderRegistry.ts
│   ├── adapters/
│   │   ├── ApiFootballAdapter.ts
│   │   ├── FootballDataAdapter.ts
│   │   ├── OddsApiAdapter.ts
│   │   ├── PinnacleAdapter.ts
│   │   └── MockProviderAdapter.ts
│   ├── infrastructure/
│   │   ├── CircuitBreaker.ts
│   │   ├── RetryPolicy.ts
│   │   ├── RateLimiter.ts
│   │   └── HealthMonitor.ts
│   ├── canonical/
│   │   ├── CanonicalFixture.ts
│   │   ├── CanonicalOdds.ts
│   │   ├── CanonicalStandings.ts
│   │   ├── CanonicalTeamStats.ts
│   │   ├── CanonicalInjury.ts
│   │   ├── CanonicalLineup.ts
│   │   └── CanonicalResult.ts
│   ├── processing/
│   │   ├── OddsMerger.ts
│   │   ├── RawArchiver.ts
│   │   ├── DataQualityScorer.ts
│   │   └── DataLineage.ts
│   ├── scheduler/
│   │   └── DataScheduler.ts
│   └── __tests__/
│       ├── ProviderRegistry.test.ts
│       ├── ApiFootballAdapter.test.ts
│       ├── CircuitBreaker.test.ts
│       ├── RetryPolicy.test.ts
│       ├── RateLimiter.test.ts
│       ├── HealthMonitor.test.ts
│       ├── OddsMerger.test.ts
│       ├── RawArchiver.test.ts
│       ├── DataQualityScorer.test.ts
│       └── DataLineage.test.ts
├── app/
│   └── api/
│       └── internal/
│           └── provider-dashboard/
│               └── route.ts           // Provider health dashboard API
```

---

## Verification Checklist

- [ ] All 12 adapter interfaces defined with TypeScript types
- [ ] Provider Registry implemented with priority-based resolution
- [ ] At least one real provider adapter (API-Football) fully implemented
- [ ] Mock provider adapter for testing
- [ ] Circuit breaker with CLOSED → OPEN → HALF_OPEN transitions
- [ ] Retry policy with exponential backoff and jitter
- [ ] Rate limiter with configurable limits and burst support
- [ ] Health monitor with rolling window metrics
- [ ] Canonical data models for all 8 data types
- [ ] Odds merger with deduplication and consensus computation
- [ ] Raw response archiver with checksum verification
- [ ] Data quality scorer with composite score and warnings
- [ ] Data lineage with full traceability from canonical → raw
- [ ] Data scheduler with fixture, odds, and result sync
- [ ] Provider health dashboard (internal only)
- [ ] Migrate existing direct provider calls to use registry
- [ ] Verify: No code outside `src/providers/` accesses external APIs directly
- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npx vitest run` — all tests pass
- [ ] `npx madge --circular` — zero circular dependencies
- [ ] Benchmark before/after comparison — no regressions
- [ ] ADR updated for provider abstraction architecture
- [ ] Verification report generated

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Provider API changes break adapter | Unit tests with recorded responses catch mismatches; adapter versioning |
| Rate limiting causes data gaps | Multiple providers with failover; configurable polling intervals |
| Canonical schema doesn't fit all providers | Design schema for least common denominator; metadata field for extras |
| Missing closing odds affects settlement | Capture interval ensures multiple snapshots; "closing" = last before kickoff |
| Data quality scoring is too aggressive | Configurable thresholds per provider; manual override for known limitations |