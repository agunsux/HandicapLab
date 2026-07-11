/**
 * HandicapLab — Historical Replay Laboratory (EPIC 16)
 * =====================================================
 * Strongly-typed contracts for the Replay Laboratory.
 *
 * Builds ON TOP of the existing replay foundation (src/lib/replay/)
 * without modifying it. All references to the base replay types
 * are imports, never redefinitions.
 *
 * Design rules (frozen from ARCHITECTURE_INVARIANTS.md):
 *   - No `any` types, no ts-ignore, no eslint-disable
 *   - Records are immutable after finalization (Object.freeze)
 *   - Every replay is reproducible from its session record
 *   - Append-only history for snapshots and sessions
 *   - Deterministic execution (no wall-clock randomness)
 */

import type { ReplayConfig, ReplayContext, ReplayMetrics, ReplayOutcome, HistoricalMatch } from '../replay/types';
import type { CanonicalDataset, CanonicalTeam, CanonicalCompetition } from '../dataset/types';
import type { EvidenceDatasetManifest, DatasetProvenance, DatasetRegistryEntry } from '../evidence-platform/types';

// ─── Architecture Constants ──────────────────────────────────────────────

/** Current version of the Replay Laboratory architecture. */
export const REPLAY_LAB_VERSION = '1.0.0' as const;

/** Baseline IDs are semver strings. */
export const BASELINE_VERSION = '1.0.0' as const;

// ─── ID prefixes (additive to src/lib/registry/identifiers) ──────────────

export const RL_ID_PREFIX = {
  SESSION: 'rls',       // replay-lab session
  JOB: 'rlj',           // replay job
  FOLD: 'rlf',          // walk-forward fold
  SNAPSHOT: 'rlsnap',   // prediction snapshot
  COMPARISON: 'rlcmp',  // replay comparison
  LINEAGE: 'rllin',     // lineage graph
  BOOTSTRAP: 'rlboot',  // bootstrap trial
  REPORT: 'rlrep',      // replay report
  DASHBOARD: 'rldash',  // dashboard dataset
} as const;

// ─── EPIC 16.1 — Replay Orchestrator ─────────────────────────────────────

export type ReplayJobStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface ReplayJob {
  readonly jobId: string;
  readonly experimentId: string;
  readonly datasetId: string;
  readonly datasetFingerprint: string;
  readonly datasetVersion: string;
  readonly modelVersion: string;
  readonly featureVersion: string;
  readonly baselineId: string | null;
  readonly sessionId: string | null; // set when session is created
  readonly status: ReplayJobStatus;
  readonly progress: number; // 0–100
  readonly error: string | null;
  readonly createdAt: string;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
}

export interface OrchestratorOptions {
  readonly maxConcurrentJobs?: number;
  readonly defaultKellyMultiplier?: number;
  readonly defaultMarketTypes?: readonly string[];
}

// ─── EPIC 16.2 — Replay Session Manager ──────────────────────────────────

export type SessionStatus = 'created' | 'running' | 'completed' | 'failed';

export interface ReplaySessionSnapshot {
  readonly sessionId: string;
  readonly experimentId: string;
  readonly datasetId: string;
  readonly datasetFingerprint: string;
  readonly datasetVersion: string;
  readonly modelVersion: string;
  readonly featureVersion: string;
  readonly predictionEngineVersion: string;
  readonly architectureVersion: string;
  readonly gitCommit: string;
  readonly seed: number;
  readonly startTime: string;
  readonly finishTime: string | null;
  readonly status: SessionStatus;
  readonly metrics: ReplayMetrics | null;
  readonly baselineId: string | null;
  readonly replayConfig: ReplayConfig;
  readonly error: string | null;
}

// ─── EPIC 16.3 — Walk-Forward Research Engine ────────────────────────────

export type WindowStrategy = 'expanding' | 'rolling' | 'fixed' | 'season' | 'league';

export interface WalkForwardFold {
  readonly foldId: string;
  readonly index: number;
  readonly strategy: WindowStrategy;
  readonly trainStart: string;
  readonly trainEnd: string;
  readonly testStart: string;
  readonly testEnd: string;
  readonly trainFixtures: readonly string[];
  readonly testFixtures: readonly string[];
  readonly sessionId: string | null; // set after execution
}

export interface WalkForwardConfig {
  readonly strategy: WindowStrategy;
  readonly trainSize?: number;   // number of fixtures for rolling/fixed
  readonly testSize?: number;    // number of fixtures per test block
  readonly stepSize?: number;    // stride for rolling windows
  readonly minTrainFixtures?: number;
  readonly validationRatio?: number; // fraction of training used for validation
}

export interface WalkForwardReport {
  readonly experimentId: string;
  readonly datasetId: string;
  readonly config: WalkForwardConfig;
  readonly folds: readonly WalkForwardFold[];
  readonly aggregateMetrics: ReplayMetrics | null;
  readonly completedAt: string;
}

// ─── EPIC 16.4 — Parallel Replay Engine ─────────────────────────────────

export type ConcurrencyMode = 'single' | 'pool';

export interface ParallelConfig {
  readonly mode: ConcurrencyMode;
  readonly workerCount: number;
  readonly deterministicOrder: boolean;
  readonly batchSize?: number;
}

export interface ParallelReplayResult {
  readonly totalMatches: number;
  readonly completedMatches: number;
  readonly failedMatches: number;
  readonly outcomes: readonly ReplayOutcome[];
  readonly metrics: ReplayMetrics;
  readonly executionTimeMs: number;
  readonly sessionId: string;
}

// ─── EPIC 16.5 — Baseline Execution Framework ────────────────────────────

export type BaselineId =
  | 'champion'
  | 'poisson'
  | 'dixon_coles'
  | 'elo'
  | 'closing_odds'
  | 'opening_odds'
  | 'random'
  | 'favorite'
  | 'underdog'
  | 'flat_probability'
  | 'market_probability';

export interface BaselineStrategy {
  readonly id: BaselineId;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly predict: (match: { homeTeam: string; awayTeam: string; homeOdds: number; drawOdds: number | null; awayOdds: number; kickoff: string }) => {
    readonly homeProbability: number;
    readonly drawProbability: number;
    readonly awayProbability: number;
  };
}

export interface BaselineResult {
  readonly baselineId: BaselineId;
  readonly sessionId: string;
  readonly metrics: ReplayMetrics;
  readonly outcomes: readonly ReplayOutcome[];
  readonly executedAt: string;
}

// ─── EPIC 16.6 — Prediction Snapshot Engine ──────────────────────────────

export interface PredictionSnapshot {
  readonly snapshotId: string;
  readonly sessionId: string;
  readonly fixtureId: string;
  readonly timestamp: string;
  readonly market: string;
  readonly homeProbability: number;
  readonly drawProbability: number;
  readonly awayProbability: number;
  readonly confidence: number;
  readonly homeOdds: number | null;
  readonly drawOdds: number | null;
  readonly awayOdds: number | null;
  readonly edge: number | null;
  readonly decision: string | null;
  readonly stake: number | null;
  readonly expectedValue: number | null;
  readonly featureVectorHash: string | null;
  readonly modelHash: string | null;
  readonly baselineId: string | null;
  /** Unique hash of this snapshot's prediction fields for dedup. */
  readonly predictionHash: string;
}

export interface SnapshotStoreStats {
  readonly totalSnapshots: number;
  readonly uniqueSessions: number;
  readonly uniqueFixtures: number;
  readonly uniqueModels: number;
}

// ─── EPIC 16.7 — Outcome Evaluator ───────────────────────────────────────

export interface DetailedOutcomeMetrics {
  readonly totalPredictions: number;
  readonly won: number;
  readonly lost: number;
  readonly push: number;
  readonly profit: number;
  readonly roi: number;           // %
  readonly yield_: number;        // profit / total staked
  readonly closingLineValue: number;
  readonly expectedValueRealized: number;
  readonly brierScore: number;
  readonly logLoss: number;
  readonly calibrationError: number;
  readonly profitFactor: number;  // gross profit / gross loss
  readonly sharpeRatio: number;
  readonly maxDrawdown: number;
  readonly longestLosingStreak: number;
  readonly kellyGrowth: number;
}

// ─── EPIC 16.8 — Replay Comparison Engine ────────────────────────────────

export interface ComparisonMetricDelta {
  readonly metric: string;
  readonly baselineA: number;
  readonly baselineB: number;
  readonly delta: number;
  readonly deltaPct: number;
}

export interface ComparisonReport {
  readonly comparisonId: string;
  readonly sessionA: string;
  readonly sessionB: string;
  readonly baselineA: string;
  readonly baselineB: string;
  readonly generatedAt: string;
  readonly deltas: readonly ComparisonMetricDelta[];
  readonly performanceDelta: number;
  readonly modelDelta: number;
  readonly featureDelta: number;
  readonly calibrationDelta: number;
  readonly roiDelta: number;
  readonly clvDelta: number;
  readonly confidenceDelta: number;
  readonly decisionDelta: number;
}

// ─── EPIC 16.9 — Experiment Lineage ──────────────────────────────────────

export type LineageNodeType =
  | 'experiment'
  | 'replay'
  | 'dataset'
  | 'manifest'
  | 'evidence_artifact'
  | 'model'
  | 'features'
  | 'prediction'
  | 'outcome'
  | 'evaluation'
  | 'research_report';

export interface LineageNode {
  readonly id: string;
  readonly type: LineageNodeType;
  readonly label: string;
  readonly timestamp: string;
  readonly metadata: Record<string, string>;
}

export interface LineageEdge {
  readonly from: string;
  readonly to: string;
  readonly label: string;
}

export interface LineageGraph {
  readonly lineageId: string;
  readonly experimentId: string;
  readonly nodes: readonly LineageNode[];
  readonly edges: readonly LineageEdge[];
  readonly generatedAt: string;
}

// ─── EPIC 16.10 — Bootstrap Validation Engine ────────────────────────────

export interface BootstrapConfig {
  readonly iterations: number;
  readonly confidenceLevel: number;
  readonly randomSeed: number;
  readonly method: 'percentile' | 'bca' | 'basic';
}

export interface BootstrapResult {
  readonly bootstrappedMetric: string;
  readonly observedValue: number;
  readonly mean: number;
  readonly median: number;
  readonly stdErr: number;
  readonly ciLower: number;
  readonly ciUpper: number;
  readonly confidenceLevel: number;
  readonly iterations: number;
  readonly effectSize: number | null;
  readonly pValue: number | null;
  readonly significant: boolean | null;
}

export interface BootstrapReport {
  readonly bootstrapId: string;
  readonly sessionIdA: string;
  readonly sessionIdB: string | null; // null for single-sample
  readonly config: BootstrapConfig;
  readonly results: readonly BootstrapResult[];
  readonly completedAt: string;
  readonly rejected: boolean; // true if conclusions are statistically weak
}

// ─── EPIC 16.11 — Replay Reporting ───────────────────────────────────────

export interface ReplayReport {
  readonly reportId: string;
  readonly sessionId: string;
  readonly generatedAt: string;
  readonly gitCommit: string;
  readonly architectureVersion: string;
  readonly executiveSummary: string;
  readonly replayMetadata: ReplaySessionSnapshot;
  readonly datasetProvenance: DatasetProvenance | null;
  readonly datasetManifest: EvidenceDatasetManifest | null;
  readonly modelInfo: Record<string, string>;
  readonly featureInfo: Record<string, string>;
  readonly calibration: Record<string, number>;
  readonly roi: number;
  readonly yield_: number;
  readonly clv: number;
  readonly bootstrapResults: readonly BootstrapResult[];
  readonly comparisonTables: readonly ComparisonReport[];
  readonly decisionAnalysis: Record<string, number>;
  readonly riskMetrics: Record<string, number>;
  readonly recommendations: readonly string[];
  readonly evidenceLinks: readonly string[];
  readonly researchArtifactIds: readonly string[];
}

// ─── EPIC 16.12 — Research Dashboard Data Layer ─────────────────────────

export interface DashboardDataset {
  readonly dashboardId: string;
  readonly generatedAt: string;
  readonly replayTimeline: readonly TimelinePoint[];
  readonly calibrationCurve: readonly CalibrationPoint[];
  readonly profitCurve: readonly ProfitPoint[];
  readonly drawdownCurve: readonly DrawdownPoint[];
  readonly roiTimeline: readonly RoiPoint[];
  readonly modelComparison: readonly ModelComparisonPoint[];
  readonly featureComparison: readonly FeatureComparisonPoint[];
  readonly confidenceDistribution: readonly DistributionBin[];
  readonly probabilityHistogram: readonly DistributionBin[];
  readonly outcomeDistribution: readonly OutcomeDistPoint[];
}

export interface TimelinePoint {
  readonly sessionId: string;
  readonly fixtureId: string;
  readonly kickoff: string;
  readonly predictedProbability: number;
  readonly actualResult: number;
  readonly profitLoss: number;
}

export interface CalibrationPoint {
  readonly bin: number;        // 0–100, decile
  readonly expected: number;
  readonly observed: number;
  readonly count: number;
}

export interface ProfitPoint {
  readonly fixtureIndex: number;
  readonly cumulativeProfit: number;
  readonly drawdown: number;
}

export interface DrawdownPoint {
  readonly fixtureIndex: number;
  readonly drawdownPct: number;
}

export interface RoiPoint {
  readonly fixtureIndex: number;
  readonly rollingRoi: number;
  readonly windowSize: number;
}

export interface ModelComparisonPoint {
  readonly modelId: string;
  readonly baselineId: string | null;
  readonly roi: number;
  readonly brierScore: number;
  readonly sharpeRatio: number;
  readonly maxDrawdown: number;
}

export interface FeatureComparisonPoint {
  readonly featureName: string;
  readonly importance: number;
  readonly deltaRoi: number;
}

export interface DistributionBin {
  readonly binLower: number;
  readonly binUpper: number;
  readonly count: number;
  readonly frequency: number;
}

export interface OutcomeDistPoint {
  readonly outcome: string;
  readonly count: number;
  readonly frequency: number;
}