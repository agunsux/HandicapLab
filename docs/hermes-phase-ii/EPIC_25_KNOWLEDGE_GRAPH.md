# EPIC 25 — Knowledge Graph Platform

**Category:** Operational Intelligence Layer  
**Dependencies:** EPIC 24.8 — Domain Intelligence Platform (must pass `tsc --noEmit` with 0 errors)  
**Target Completion:** Phase II-D  
**Critical Path:** Foundation for Market Intelligence, Ensemble Intelligence, and Commercial Layer  
**Codename:** HERMES-25

---

## Mission Statement

Build the canonical knowledge graph that connects every artifact produced by HandicapLab into a fully traceable, queryable, explainable research network.

This is NOT a graph database. This is a **logical graph layer** that can sit on top of Neo4j, PostgreSQL, Supabase, or in-memory storage depending on deployment.

**Target outcome:** Every prediction, feature, model, experiment, replay, evidence entry, and report is connected in a single queryable graph. You can trace "Why was this prediction made?" in one query, and "If Feature X changes, what breaks?" in another.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Knowledge Graph Platform                   │
│                                                               │
│  ┌─────────────────────┐    ┌─────────────────────────────┐  │
│  │     Graph Core       │    │      Node Registry          │  │
│  │  - GraphNode         │    │  - Fixture, League,        │  │
│  │  - GraphEdge         │    │    Competition, Season     │  │
│  │  - Relationship      │    │  - Team, Player, Odds      │  │
│  │  - Traversal         │    │  - Market, Prediction      │  │
│  │  - Path              │    │  - +21 more domains        │  │
│  │  - Subgraph          │    └─────────────┬───────────────┘  │
│  │  - Metadata          │                  │                   │
│  │  - Version           │                  ▼                   │
│  └─────────┬───────────┘    ┌─────────────────────────────┐  │
│            │                │   Relationship Registry      │  │
│            ▼                │  - USES, GENERATED_BY        │  │
│  ┌─────────────────────┐    │  - VALIDATED_BY, CALIBRATED  │  │
│  │  Traversal Engine    │    │  - APPROVED_BY, PART_OF     │  │
│  │  - BFS / DFS         │    │  - RESULTED_IN, DOCUMENTED  │  │
│  │  - Shortest Path     │    │  - DEPENDS_ON, AFFECTS     │  │
│  │  - Ancestors/Desc    │    └─────────────────────────────┘  │
│  │  - Neighborhood      │                                      │
│  │  - Filtered / Depth  │                                      │
│  └─────────┬───────────┘                                      │
│            │                                                   │
│            ▼                                                   │
│  ┌─────────────────────┐    ┌─────────────────────────────┐  │
│  │    Query Engine      │    │   Explainability Engine    │  │
│  │  - findNode          │    │  - Why was this made?     │  │
│  │  - findPath          │    │  - Human + Machine exp.   │  │
│  │  - findArtifacts     │    │  - Full evidence chain    │  │
│  │  - findPredictions   │    └─────────────┬───────────────┘  │
│  │  - findFeatureImpact │                  │                   │
│  └─────────────────────┘                  ▼                   │
│                                  ┌─────────────────────────┐ │
│  ┌─────────────────────┐        │   Research Navigator     │ │
│  │  Dependency Engine   │        │  - Complex queries      │ │
│  │  - Impact Analysis   │        │  - Multi-filter         │ │
│  │  - Change Detection  │        │  - Cross-domain search  │ │
│  └─────────────────────┘        └─────────────────────────┘ │
│                                                               │
│  ┌─────────────────────┐    ┌─────────────────────────────┐  │
│  │  Evidence Chain      │    │    Version Lineage          │  │
│  │  - Prediction→Replay │    │  - Model lineage           │  │
│  │  →Shadow→Result      │    │  - Experiment lineage      │  │
│  │  →ROI→CLV→Report     │    │  - Calibration lineage     │  │
│  └─────────────────────┘    └─────────────────────────────┘  │
│                                                               │
│  ┌─────────────────────┐    ┌─────────────────────────────┐  │
│  │  Graph Integrity     │    │      Reporting              │  │
│  │  - Duplicate detect  │    │  - Graph Summary           │  │
│  │  - Orphan detect     │    │  - Relationship Summary    │  │
│  │  - Broken edge       │    │  - Dependency Report       │  │
│  │  - Circular deps     │    │  - Evidence Report         │  │
│  └─────────────────────┘    └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 25.1 Graph Core

**Purpose:** Fundamental building blocks for the entire knowledge graph.

```typescript
interface GraphNode {
  id: string;                          // Canonical domain ID (fxt_000001, pred_000001, etc.)
  type: NodeType;                      // Domain type: fixture, prediction, model, etc.
  label: string;                       // Human-readable label
  properties: Record<string, unknown>; // Domain-specific properties
  metadata: GraphMetadata;             // Created at, version, tags
  version: number;                     // Monotonic version counter
}

interface GraphEdge {
  id: string;                          // Canonical edge ID
  source: string;                      // Source node ID
  target: string;                      // Target node ID
  relationship: RelationshipType;      // USES, GENERATED_BY, etc.
  properties: Record<string, unknown>; // Edge-specific properties
  weight: number;                      // Edge weight for traversal (0-1)
  bidirectional: boolean;              // Is relationship bidirectional?
  metadata: GraphMetadata;
  version: number;
}

interface Relationship {
  type: RelationshipType;
  label: string;                       // Human-readable label
  description: string;                 // What this relationship means
  sourceTypes: NodeType[];             // Valid source node types
  targetTypes: NodeType[];             // Valid target node types
  allowedProperties: string[];         // Allowed property keys
  cardinality: 'ONE_TO_ONE' | 'ONE_TO_MANY' | 'MANY_TO_MANY';
}

interface Traversal {
  nodes: GraphNode[];
  edges: GraphEdge[];
  path: Path;
  depth: number;
  visited: Set<string>;
}

interface Path {
  nodes: GraphNode[];
  edges: GraphEdge[];
  totalWeight: number;
  totalDepth: number;
}

interface Subgraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  root: string;                        // Root node ID
  type: 'PREDICTION' | 'EVIDENCE' | 'MODEL' | 'RESEARCH' | 'PORTFOLIO';
  metadata: GraphMetadata;
}

interface GraphMetadata {
  createdAt: string;
  updatedAt: string;
  version: number;
  tags: string[];
  source: string;                      // Created by which module
}

interface GraphVersion {
  version: string;
  nodeCount: number;
  edgeCount: number;
  checksum: string;                    // Hash of all nodes + edges
  createdAt: string;
  changes: string[];                   // Change log since last version
}
```

---

## 25.2 Node Registry

**Purpose:** Every domain entity is registered as a valid node type in the graph.

| Node Type | Domain Entity | ID Prefix | Properties |
|-----------|--------------|-----------|------------|
| `fixture` | Fixture | fxt | leagueId, kickoffTime, status, homeTeamId, awayTeamId |
| `league` | League | lea | name, country, tier |
| `competition` | Competition | comp | name, country, sport, tier |
| `season` | Season | seas | competitionId, label, startDate, endDate |
| `team` | Team | team | name, shortName, country |
| `player` | Player | plyr | teamId, name, position |
| `odds` | Odds | odd | fixtureId, marketType, line, timestamp |
| `market` | Market | mkt | name, marketType, category |
| `prediction` | Prediction | pred | fixtureId, modelId, marketType, expectedValue |
| `probability` | Probability | prob | fixtureId, modelId, homeProb, awayProb |
| `calibration` | Calibration | cal | modelId, datasetId, ece, brierScore |
| `feature` | Feature | feat | name, version, category, dataType |
| `decision` | Decision | dec | fixtureId, predictionId, confidence, edge |
| `policy` | Policy | pol | name, policyType, priority |
| `stake` | Stake | stk | decisionId, amount, stakeType |
| `portfolio` | Portfolio | port | name, totalValue, cashBalance |
| `replay` | Replay | repl | datasetId, fixtureCount, status |
| `evidence` | Evidence | evd | replayId, fixtureId, predictionId, clv |
| `experiment` | Experiment | exp | name, hypothesis, status |
| `model` | Model | mdl | name, version, modelType |
| `provider` | Provider | prov | name, providerType, baseUrl |
| `result` | Result | rslt | fixtureId, homeScore, awayScore |
| `report` | Report | rep | type, period, format |
| `drift` | Drift | drft | modelId, driftType, metric, deviation |
| `risk` | Risk | risk | portfolioId, riskType, value |
| `artifact` | Artifact | art | name, type, version, hash |
| `research` | Research | res | name, hypothesis, status |

---

## 25.3 Relationship Registry

**Purpose:** Every meaningful relationship between domains is defined with types, cardinality, and semantics.

| Relationship | Source | Target | Description | Cardinality |
|-------------|--------|--------|-------------|-------------|
| `USES` | Prediction | Feature | A prediction uses certain features | MANY_TO_MANY |
| `GENERATED_BY` | Prediction | Model | A prediction was generated by a model | MANY_TO_ONE |
| `VALIDATED_BY` | Prediction | Replay | A prediction was validated by replay | MANY_TO_ONE |
| `CALIBRATED_BY` | Prediction | Calibration | A prediction's calibration is from | MANY_TO_ONE |
| `APPROVED_BY` | Prediction | Decision | A prediction was approved by a decision | ONE_TO_ONE |
| `PART_OF` | Prediction | Portfolio | A prediction is part of a portfolio | MANY_TO_MANY |
| `RESULTED_IN` | Prediction | Result | A prediction resulted in an outcome | ONE_TO_ONE |
| `DOCUMENTED_IN` | Prediction | Report | A prediction is documented in a report | MANY_TO_ONE |
| `FEEDS_INTO` | Feature | Prediction | Feature feeds into predictions | MANY_TO_MANY |
| `TRAINS` | Feature | Model | Feature set used to train a model | MANY_TO_MANY |
| `PRODUCES` | Replay | Evidence | Replay produces evidence entries | ONE_TO_MANY |
| `VERIFIES` | Replay | Prediction | Replay verifies prediction accuracy | ONE_TO_MANY |
| `HAS` | Model | Calibration | Model has calibration results | ONE_TO_MANY |
| `HAS` | Model | Performance | Model has performance metrics | ONE_TO_MANY |
| `TESTS` | Experiment | Model | Experiment tests a model | ONE_TO_MANY |
| `GENERATES` | Model | Prediction | Model generates predictions | ONE_TO_MANY |
| `PROVIDES` | Provider | Odds | Provider provides odds data | ONE_TO_MANY |
| `CONTAINS` | League | Fixture | League contains fixtures | ONE_TO_MANY |
| `CONTAINS` | Competition | Team | Competition has teams | ONE_TO_MANY |
| `HAS` | Competition | Season | Competition has seasons | ONE_TO_MANY |
| `HAS` | Season | League | Season has leagues | ONE_TO_MANY |
| `PARTICIPATES_IN` | Team | Fixture | Team participates in fixture | MANY_TO_MANY |
| `PLAYED_AT` | Fixture | Venue | Fixture was played at venue | MANY_TO_ONE |
| `HAS` | Team | Player | Team has players | ONE_TO_MANY |
| `CLASSIFIES` | Market | Odds | Market classifies odds type | ONE_TO_MANY |
| `GOVERNS` | Policy | Decision | Policy governs decision making | ONE_TO_MANY |
| `AFFECTS` | Drift | Model | Drift affects model performance | ONE_TO_MANY |
| `BELONGS_TO` | Risk | Portfolio | Risk belongs to portfolio | MANY_TO_ONE |
| `SUMMARIZES` | Report | Performance | Report summarizes performance | ONE_TO_ONE |
| `FEEDS_INTO` | Evidence | Report | Evidence feeds into report | MANY_TO_ONE |
| `PRODUCES` | Research | Evidence | Research produces evidence | ONE_TO_MANY |
| `DEPENDS_ON` | Feature | Feature | Feature depends on other features | MANY_TO_MANY |
| `TRIGGERS` | Prediction | Decision | Prediction triggers a decision | ONE_TO_ONE |
| `PRODUCES` | Decision | Stake | Decision produces a stake | ONE_TO_ONE |
| `BELONGS_TO` | Stake | Portfolio | Stake belongs to portfolio | MANY_TO_ONE |
| `MEASURED_BY` | Prediction | Performance | Prediction measured by performance metrics | ONE_TO_MANY |
| `AFFECTED_BY` | Model | Drift | Model affected by drift | ONE_TO_MANY |
| `CALCULATES_FOR` | Feature | Fixture | Feature calculated for fixture | MANY_TO_MANY |

**Relationship matrix example — Prediction node:**
```
Prediction
  ├── USES ──────────────► Feature
  ├── GENERATED_BY ──────► Model
  ├── VALIDATED_BY ──────► Replay
  ├── CALIBRATED_BY ─────► Calibration
  ├── APPROVED_BY ───────► Decision
  ├── PART_OF ───────────► Portfolio
  ├── RESULTED_IN ───────► Result
  ├── DOCUMENTED_IN ─────► Report
  ├── TRIGGERS ──────────► Decision
  └── MEASURED_BY ───────► Performance
```

---

## 25.4 Traversal Engine

**Purpose:** Navigate the graph in multiple ways to find relationships, paths, and connected subgraphs.

```typescript
interface ITraversalEngine {
  bfs(start: string, predicate?: (node: GraphNode) => boolean): Traversal;
  dfs(start: string, predicate?: (node: GraphNode) => boolean): Traversal;
  shortestPath(from: string, to: string, options?: PathOptions): Path | null;
  findAllConnected(nodeId: string, maxDepth?: number): GraphNode[];
  ancestors(nodeId: string, relationship?: RelationshipType): GraphNode[];
  descendants(nodeId: string, relationship?: RelationshipType): GraphNode[];
  neighborhood(nodeId: string, radius: number, relationship?: RelationshipType): Subgraph;
  expand(subgraph: Subgraph, depth: number): Subgraph;
  filteredTraversal(start: string, filters: TraversalFilter): Traversal;
  depthLimited(start: string, maxDepth: number): Traversal;
}

interface PathOptions {
  maxDepth?: number;
  relationshipFilter?: RelationshipType[];
  weightThreshold?: number;
  algorithm?: 'DIJKSTRA' | 'BFS' | 'A_STAR';
}

interface TraversalFilter {
  nodeTypes?: NodeType[];
  relationships?: RelationshipType[];
  minDepth?: number;
  maxDepth?: number;
  propertyFilter?: Record<string, unknown>;
}
```

**Traversal Examples:**
```
BFS from Prediction {maxDepth: 3}:
  Depth 0: Prediction(pred_000001)
  Depth 1: Feature(feat_xg), Model(mdl_poisson), Decision(dec_000001)
  Depth 2: Fixture(fxt_000001), Calibration(cal_000001), Stake(stk_000001)
  Depth 3: League(lea_epl), Team(team_arsenal), Portfolio(port_000001)

Shortest Path from Prediction to Report:
  Prediction → DOCUMENTED_IN → Report

Ancestors of Prediction:
  ← GENERATED_BY: Model
  ← USES: Feature
  ← PART_OF: Portfolio
```

---

## 25.5 Query Engine

**Purpose:** High-level query API for finding specific nodes, relationships, and subgraphs.

```typescript
interface IQueryEngine {
  findNode(id: string): GraphNode | null;
  findNodes(type: NodeType, filter?: Record<string, unknown>): GraphNode[];
  findEdge(id: string): GraphEdge | null;
  findEdges(source: string, relationship?: RelationshipType): GraphEdge[];
  findNeighbors(nodeId: string, relationship?: RelationshipType): GraphNode[];
  findPath(from: string, to: string): Path | null;
  findArtifacts(modelId: string): GraphNode[];       // All artifacts linked to a model
  findEvidence(predictionId: string): EvidenceChain;   // Full evidence chain
  findPredictions(fixtureId: string): GraphNode[];    // All predictions for a fixture
  findFeatureImpact(featureId: string): ImpactReport; // What uses this feature?
  findDecisionHistory(fixtureId: string): DecisionPath[]; // Decision timeline
  findReplayHistory(modelId: string): ReplaySummary[];   // Replay runs for a model
  findPortfolio(predictionId: string): GraphNode | null;  // Portfolio containing this
  findResearch(topic: string): GraphNode[];               // Research on topic
}

interface EvidenceChain {
  prediction: GraphNode;
  replay: GraphNode | null;
  evidence: GraphNode[];
  result: GraphNode | null;
  performance: GraphNode[];
  reports: GraphNode[];
  chainValid: boolean;
}

interface ImpactReport {
  feature: GraphNode;
  usedByPredictions: GraphNode[];
  usedByModels: GraphNode[];
  usedByReports: GraphNode[];
  downstreamCount: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface DecisionPath {
  prediction: GraphNode;
  decision: GraphNode;
  stake: GraphNode | null;
  portfolio: GraphNode | null;
  policy: GraphNode | null;
  timestamp: string;
}
```

---

## 25.6 Explainability Engine

**Purpose:** Answer "Why was this prediction made?" with both human-readable and machine-readable explanations.

```typescript
interface IExplainabilityEngine {
  explain(predictionId: string): Promise<Explanation>;
  explainDecision(decisionId: string): Promise<DecisionExplanation>;
  explainPortfolio(portfolioId: string): Promise<PortfolioExplanation>;
  explainResearch(researchId: string): Promise<ResearchExplanation>;
}

interface Explanation {
  predictionId: string;
  
  // Human-readable output
  humanReadable: string[];
  
  // Machine-readable output  
  machineReadable: ExplanationNode[];
  
  // Evidence chain
  chain: ExplanationChain;
  
  // Confidence
  confidence: number;
}

interface ExplanationNode {
  type: string;
  id: string;
  label: string;
  value: string;
  role: 'INPUT' | 'TRANSFORM' | 'VALIDATION' | 'OUTPUT';
}

interface ExplanationChain {
  steps: ExplanationStep[];
  valid: boolean;
  brokenAt: string | null;
}

interface ExplanationStep {
  from: string;
  to: string;
  relationship: string;
  detail: string;
  valid: boolean;
}
```

**Example: Human-readable explanation for prediction:**
```
Prediction pred_000001 was made because:
  1. Features used: xG_home (0.42), xG_away (0.38), form_home (WWDLW), ELO_home (1580)
  2. Generated by Model: Poisson v1.2.3 (Brier: 0.212, ECE: 0.038)
  3. Calibration: PASSED (ECE: 0.032, within threshold 0.05)
  4. Validated by Replay: repl_000042 (89.2% accuracy on 500 fixtures)
  5. Approved by Decision: dec_000015 (edge: 5.2%, confidence: HIGH)
  6. Part of Portfolio: Conservative Growth (risk limit: 5%)
  7. Expected Outcome: HOME win (probability: 58.3%, EV: +8.2%)
```

**Example: Machine-readable explanation:**
```json
{
  "predictionId": "pred_000001",
  "chain": [
    {"step": 1, "node": "Feature", "id": "feat_xg_home", "value": "0.42"},
    {"step": 2, "node": "Feature", "id": "feat_xg_away", "value": "0.38"},
    {"step": 3, "node": "Model", "id": "mdl_poisson_v123", "brier": 0.212},
    {"step": 4, "node": "Calibration", "id": "cal_000042", "ece": 0.032, "passed": true},
    {"step": 5, "node": "Decision", "id": "dec_000015", "edge": 0.052, "approved": true}
  ]
}
```

---

## 25.7 Dependency Engine

**Purpose:** Answer "If Feature X changes, what breaks?" with full impact analysis.

```typescript
interface IDependencyEngine {
  analyzeImpact(nodeId: string): ImpactAnalysis;
  findDependencies(nodeId: string, direction: 'UPSTREAM' | 'DOWNSTREAM'): DependencyGraph;
  detectBreakingChanges(oldNode: GraphNode, newNode: GraphNode): BreakingChange[];
  getCriticalPath(nodeId: string): Path[];
  rankDependencyRisk(nodeId: string): RiskRanking;
}

interface ImpactAnalysis {
  target: GraphNode;
  directDependents: number;
  indirectDependents: number;
  totalAffectedNodes: number;
  affectedByLevel: Record<number, GraphNode[]>;
  criticalNodes: GraphNode[];
  riskScore: number;                   // 0-100
  recommendations: string[];
}

interface BreakingChange {
  nodeId: string;
  property: string;
  oldValue: unknown;
  newValue: unknown;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  affectedDownstream: string[];
  mitigation: string;
}

interface RiskRanking {
  nodeId: string;
  totalDownstream: number;
  criticalDownstream: number;
  changeFrequency: number;             // How often this node changes
  lastChange: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}
```

**Example: Impact analysis for Feature change:**
```
If Feature "xG_home" changes:
  Direct dependents: 3 (Predictions pred_001, pred_002, pred_003)
  Indirect dependents: 2 (Models mdl_poisson, mdl_ensemble)
  Critical path: Prediction → Decision → Stake → Portfolio
  Risk score: 72/100 (HIGH)
  Recommendations:
    - Re-run calibration for mdl_poisson
    - Re-validate predictions pred_001, pred_002
    - Check portfolio risk exposure
```

---

## 25.8 Evidence Chain

**Purpose:** Build and validate the complete evidence chain from prediction through to report.

```typescript
interface IEvidenceChain {
  build(predictionId: string): Promise<EvidenceChain>;
  validate(chain: EvidenceChain): ChainValidation;
  getChainStatus(predictionId: string): ChainStatus;
  findBrokenChains(): ChainIssue[];
  repairChain(predictionId: string): Promise<EvidenceChain>;
}

interface ChainStatus {
  predictionId: string;
  isValid: boolean;
  completeness: number;                // 0-100%
  steps: ChainStepStatus[];
  lastVerified: string;
}

interface ChainStepStatus {
  step: string;
  present: boolean;
  valid: boolean;
  lastUpdated: string;
  detail: string;
}

interface ChainIssue {
  predictionId: string;
  issueType: 'MISSING' | 'STALE' | 'INVALID' | 'BROKEN';
  step: string;
  detail: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
}
```

**Evidence Chain Flow:**
```
Prediction
  │
  ▼
Replay ──► Evidence (CLV, accuracy)
  │
  ▼
Shadow ──► Evidence (shadow performance)
  │
  ▼
Result ──► Actual outcome vs predicted
  │
  ▼
ROI ──► Financial performance
  │
  ▼
CLV ──► Market edge analysis
  │
  ▼
Report ──► Documented findings
```

---

## 25.9 Version Lineage

**Purpose:** Track every version change across models, experiments, calibrations, and reports.

```typescript
interface IVersionLineage {
  track(nodeId: string, version: number): Promise<void>;
  getLineage(nodeId: string): VersionLineage;
  compare(fromVersion: number, toVersion: number): VersionDiff;
  getLatestVersion(nodeType: NodeType, identifier: string): number;
  getVersionHistory(nodeType: NodeType, days: number): VersionEvent[];
}

interface VersionLineage {
  nodeId: string;
  versions: VersionNode[];
  currentVersion: number;
  changes: VersionChange[];
  stabilityScore: number;              // 0-100 (fewer changes = higher)
}

interface VersionNode {
  version: number;
  timestamp: string;
  changes: string[];
  checksum: string;
  previousChecksum: string | null;
  author: string;
}

interface VersionChange {
  version: number;
  type: 'CREATED' | 'UPDATED' | 'DEPRECATED' | 'RETIRED';
  description: string;
  reason: string;
  breaking: boolean;
}

interface VersionDiff {
  fromVersion: number;
  toVersion: number;
  added: string[];
  removed: string[];
  modified: string[];
  breaking: boolean;
}
```

**Trackable lineages:**
| Artifact | Version Granularity | Typical Versions |
|----------|-------------------|------------------|
| Model | Major.Minor.Patch | 1.0.0 → 1.2.3 → 2.0.0 |
| Experiment | Monotonic | 1, 2, 3, ... |
| Calibration | Per dataset | v1, v2, v3 |
| Feature Set | Per season | 2024-v1, 2025-v1 |
| Prediction | Immutable | 1 (never changes) |
| Decision | Immutable | 1 (never changes) |
| Report | Per generation | daily-001, weekly-012 |
| Feature | Per computation | 1.0.0, 1.1.0 |

---

## 25.10 Research Navigator

**Purpose:** Complex multi-filter queries across domains.

```typescript
interface IResearchNavigator {
  query(spec: NavigatorQuery): Promise<NavigationResult>;
  saveQuery(name: string, spec: NavigatorQuery): Promise<void>;
  loadQuery(name: string): NavigatorQuery;
  getQueryHistory(): SavedQuery[];
  suggestQueries(pattern: string): NavigatorQuery[];
}

interface NavigatorQuery {
  domains: string[];                   // Which domains to search
  filters: NavigatorFilter[];          // Filter chain
  sort: SortSpec;
  limit: number;
  offset: number;
  includePaths: boolean;
}

interface NavigatorFilter {
  domain: string;
  field: string;
  operator: 'EQ' | 'GT' | 'GTE' | 'LT' | 'LTE' | 'IN' | 'BETWEEN' | 'CONTAINS';
  value: unknown;
}

interface NavigationResult {
  total: number;
  results: GraphNode[];
  paths: Path[];
  executionTimeMs: number;
  query: NavigatorQuery;
}
```

**Example Queries:**

```
Query: "Show every EPL prediction with EV > 5%, Calibration PASS, positive CLV, Conservative policy"
{
  domains: ['prediction'],
  filters: [
    { domain: 'prediction', field: 'expectedValue', operator: 'GT', value: 0.05 },
    { domain: 'calibration', field: 'ece', operator: 'LT', value: 0.05 },
    { domain: 'evidence', field: 'clv', operator: 'GT', value: 0 },
    { domain: 'policy', field: 'policyType', operator: 'EQ', value: 'conservative' }
  ]
}

Query: "Find all models with Brier score < 0.22, ECE < 0.04, deployed after 2026-01-01"
{
  domains: ['model'],
  filters: [
    { domain: 'model', field: 'status', operator: 'EQ', value: 'deployed' },
    { domain: 'performance', field: 'brierScore', operator: 'LT', value: 0.22 },
    { domain: 'performance', field: 'ece', operator: 'LT', value: 0.04 },
    { domain: 'model', field: 'deployedAt', operator: 'GTE', value: '2026-01-01' }
  ]
}
```

---

## 25.11 Graph Integrity

**Purpose:** Validate graph health and detect anomalies.

```typescript
interface IGraphIntegrity {
  checkAll(): IntegrityReport;
  checkDuplicates(): DuplicateNode[];
  checkOrphans(): OrphanNode[];
  checkBrokenEdges(): BrokenEdge[];
  checkInvalidRelationships(): InvalidRelationship[];
  checkVersionMismatch(): VersionMismatch[];
  checkCircularDependencies(): CircularDependency[];
  checkDanglingArtifacts(): DanglingArtifact[];
  repair(issue: IntegrityIssue): Promise<boolean>;
}

interface IntegrityReport {
  timestamp: string;
  totalNodes: number;
  totalEdges: number;
  issues: IntegrityIssue[];
  healthScore: number;                 // 0-100
  summary: string;
}

interface DuplicateNode {
  nodeId1: string;
  nodeId2: string;
  type: NodeType;
  similarity: number;
  action: 'MERGE' | 'REMOVE' | 'KEEP_BOTH';
}

interface OrphanNode {
  nodeId: string;
  type: NodeType;
  daysSinceCreation: number;
  action: 'REMOVE' | 'KEEP' | 'INVESTIGATE';
}

interface BrokenEdge {
  edgeId: string;
  source: string;
  target: string;
  relationship: string;
  reason: 'SOURCE_MISSING' | 'TARGET_MISSING' | 'INVALID_RELATIONSHIP';
  action: 'REMOVE' | 'REPAIR' | 'KEEP';
}

interface CircularDependency {
  cycle: string[];
  length: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  action: 'BREAK_CYCLE' | 'REVIEW' | 'KEEP';
}

interface DanglingArtifact {
  artifactId: string;
  type: string;
  missingReference: string;
  created: string;
  action: 'REMOVE' | 'RESTORE_REFERENCE' | 'KEEP';
}
```

---

## 25.12 Reporting

**Purpose:** Generate comprehensive reports about graph state, relationships, and dependencies.

```typescript
interface IGraphReporting {
  generateSummary(): Promise<GraphSummary>;
  generateRelationshipReport(): Promise<RelationshipReport>;
  generateDependencyReport(nodeId: string): Promise<DependencyReport>;
  generateEvidenceReport(predictionId: string): Promise<EvidenceReport>;
  generateLineageReport(artifactId: string): Promise<LineageReport>;
  generateIntegrityReport(): Promise<IntegrityReport>;
  export(format: 'json' | 'csv' | 'graphml'): string;
}

interface GraphSummary {
  timestamp: string;
  totalNodes: number;
  totalEdges: number;
  nodeCountByType: Record<string, number>;
  edgeCountByType: Record<string, number>;
  avgDegree: number;
  density: number;
  connectedComponents: number;
  avgPathLength: number;
  diameter: number;
}

interface RelationshipReport {
  relationships: RelationshipStats[];
  mostConnectedNodes: { node: string; degree: number }[];
  rarestRelationships: { type: string; count: number }[];
  relationshipHeatmap: Record<string, Record<string, number>>;
}

interface DependencyReport {
  node: GraphNode;
  upstreamCount: number;
  downstreamCount: number;
  criticalPath: Path;
  riskAssessment: string;
  recommendations: string[];
}
```

---

## Directory Structure

```
src/lib/knowledge-graph/
├── interfaces/
│   ├── IGraphCore.ts
│   ├── ITraversalEngine.ts
│   ├── IQueryEngine.ts
│   ├── IExplainabilityEngine.ts
│   ├── IDependencyEngine.ts
│   ├── IEvidenceChain.ts
│   ├── IVersionLineage.ts
│   ├── IResearchNavigator.ts
│   ├── IGraphIntegrity.ts
│   └── IGraphReporting.ts
├── core/
│   ├── GraphNode.ts
│   ├── GraphEdge.ts
│   ├── Relationship.ts
│   ├── Path.ts
│   ├── Subgraph.ts
│   └── Metadata.ts
├── registry/
│   ├── NodeRegistry.ts
│   └── RelationshipRegistry.ts
├── traversal/
│   ├── BFS.ts
│   ├── DFS.ts
│   ├── ShortestPath.ts
│   └── TraversalEngine.ts
├── query/
│   ├── QueryEngine.ts
│   └── QueryParser.ts
├── explain/
│   ├── ExplainabilityEngine.ts
│   └── ExplanationFormatter.ts
├── dependency/
│   └── DependencyEngine.ts
├── evidence/
│   └── EvidenceChain.ts
├── lineage/
│   └── VersionLineage.ts
├── navigator/
│   └── ResearchNavigator.ts
├── integrity/
│   └── GraphIntegrity.ts
├── reporting/
│   ├── GraphReporting.ts
│   └── ReportFormatter.ts
├── store/
│   ├── InMemoryGraphStore.ts
│   └── IGraphStore.ts              // Abstraction for any backend
└── __tests__/
    ├── GraphCore.test.ts
    ├── Traversal.test.ts
    ├── QueryEngine.test.ts
    ├── Explainability.test.ts
    ├── Dependency.test.ts
    ├── EvidenceChain.test.ts
    ├── Lineage.test.ts
    ├── Integrity.test.ts
    └── Performance.test.ts
```

---

## Engineering Rules

- **Strict TypeScript** — zero `any`, zero `ts-ignore`, zero `eslint-disable`
- **Pure functions** — no side effects in graph operations
- **Immutable graph objects** — all mutations return new instances
- **Backward compatible** — does not modify any existing module
- **Additive layer** — graph is added on top, not replacing anything
- **Storage agnostic** — `IGraphStore` interface allows any backend
- **Deterministic** — same query always returns same result
- **Idempotent** — same node/edge insertion is safe to repeat

---

## Test Suite (30+ tests)

| Category | Tests | Description |
|----------|-------|-------------|
| Graph Core | 5 | Node creation, edge creation, basic operations, metadata, versions |
| Traversal | 5 | BFS, DFS, shortest path, ancestors, descendants |
| Query Engine | 5 | findNode, findPath, findArtifacts, findPredictions, findFeatureImpact |
| Explainability | 4 | Single prediction, full chain, broken chain, human/machine format |
| Dependency | 3 | Impact analysis, breaking changes, critical path |
| Evidence Chain | 3 | Build chain, validate chain, detect broken |
| Lineage | 3 | Track version, get lineage, compare versions |
| Integrity | 3 | Detect duplicates, orphans, broken edges |
| Performance | 2 | Graph with 10K nodes, traversal under load |
| Backward compat | 1 | All existing tests still pass |

---

## Performance Targets

| Operation | Target (1K nodes) | Target (10K nodes) | Target (100K nodes) |
|-----------|------------------|-------------------|--------------------|
| Node insertion | < 1ms | < 5ms | < 20ms |
| Edge insertion | < 1ms | < 5ms | < 25ms |
| BFS traversal | < 5ms | < 20ms | < 100ms |
| Shortest path | < 10ms | < 50ms | < 500ms |
| Explainability query | < 20ms | < 100ms | < 1s |
| Impact analysis | < 50ms | < 200ms | < 2s |
| Integrity check | < 100ms | < 500ms | < 5s |
| Graph summary | < 50ms | < 200ms | < 1s |

---

## Deliverables

1. **Graph architecture report** documenting the complete graph design
2. **Node catalog** — all 27 node types with properties
3. **Edge catalog** — 36+ relationship types with cardinality
4. **Relationship matrix** — which node types connect to which
5. **Traversal complexity analysis** — Big O for each algorithm
6. **Query capability matrix** — what queries are supported
7. **Test summary** — 30+ tests with 90%+ coverage
8. **Git commit** — complete knowledge graph implementation
9. **Annotated tag** — `v1.7.0-knowledge-graph`

---

## Prerequisites

**CRITICAL:** Before starting EPIC 25, the Domain Intelligence Platform (EPIC 24.8) must pass `tsc --noEmit` with **zero errors**. The Knowledge Graph depends on domain entities for its node types, and building on top of code with strict mode errors will compound debugging complexity.

**Required hardening:**
- Fix TS7006 (implicit `any`) in shared kernel files — add explicit type annotations
- Fix TS2339/TS2353 (DTO `id` field missing) in entity files — add `id` to DTO interfaces
- Fix TS1016 (optional parameter ordering) — reorder optional params to end
- Fix TS2307 (module not found) — ensure all entity files exist
- Fix TS2308 (duplicate export) — resolve `Probability` name conflict
- Fix TS1205 (isolatedModules re-export type) — use `export type` for interfaces