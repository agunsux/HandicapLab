/**
 * HandicapLab — Historical Replay Laboratory (EPIC 16)
 * ======================================================
 * Complete replay research infrastructure.
 *
 * Public surface:
 *   - Types & Constants
 *   - ID Generation
 *   - Replay Orchestrator (16.1)
 *   - Replay Session Manager (16.2)
 *   - Walk-Forward Research Engine (16.3)
 *   - Parallel Replay Engine (16.4)
 *   - Baseline Execution Framework (16.5)
 *   - Prediction Snapshot Engine (16.6)
 *   - Outcome Evaluator (16.7)
 *   - Replay Comparison Engine (16.8)
 *   - Experiment Lineage (16.9)
 *   - Bootstrap Validation Engine (16.10)
 *   - Replay Reporting (16.11)
 *   - Research Dashboard Data Layer (16.12)
 */

// ─── Types & Constants ──────────────────────────────────────────────────
export {
  REPLAY_LAB_VERSION,
  BASELINE_VERSION,
  RL_ID_PREFIX,
} from './types';

export type {
  ReplayJobStatus,
  ReplayJob,
  OrchestratorOptions,
  SessionStatus,
  ReplaySessionSnapshot,
  WindowStrategy,
  WalkForwardFold,
  WalkForwardConfig,
  WalkForwardReport,
  ConcurrencyMode,
  ParallelConfig,
  ParallelReplayResult,
  BaselineId,
  BaselineStrategy,
  BaselineResult,
  PredictionSnapshot,
  SnapshotStoreStats,
  DetailedOutcomeMetrics,
  ComparisonMetricDelta,
  ComparisonReport,
  LineageNodeType,
  LineageNode,
  LineageEdge,
  LineageGraph,
  BootstrapConfig,
  BootstrapResult,
  BootstrapReport,
  ReplayReport,
  DashboardDataset,
  TimelinePoint,
  CalibrationPoint,
  ProfitPoint,
  DrawdownPoint,
  RoiPoint,
  ModelComparisonPoint,
  FeatureComparisonPoint,
  DistributionBin,
  OutcomeDistPoint,
} from './types';

// ─── ID Generation ──────────────────────────────────────────────────────
export {
  generateSessionId,
  generateJobId,
  generateFoldId,
  generateSnapshotId,
  generateComparisonId,
  generateLineageId,
  generateBootstrapId,
  generateReportId,
  generateDashboardId,
  seededShuffle,
  simpleHash,
} from './id';

// ─── 16.1 Replay Orchestrator ───────────────────────────────────────────
export { ReplayOrchestrator } from './replayOrchestrator';
export type { OrchestrateInput } from './replayOrchestrator';

// ─── 16.2 Replay Session Manager ────────────────────────────────────────
export { ReplaySessionManager, defaultSessionManager } from './sessionManager';
export type { CreateSessionInput } from './sessionManager';

// ─── 16.3 Walk-Forward Research Engine ──────────────────────────────────
export { WalkForwardEngine, defaultWalkForwardEngine } from './walkForwardEngine';

// ─── 16.4 Parallel Replay Engine ────────────────────────────────────────
export { ParallelReplayEngine, defaultParallelEngine } from './parallelEngine';
export type { MatchPredictor } from './parallelEngine';

// ─── 16.5 Baseline Execution Framework ──────────────────────────────────
export { BaselineRegistry, defaultBaselineRegistry, createAllBaselines } from './baselineStrategies';

// ─── 16.6 Prediction Snapshot Engine ────────────────────────────────────
export { SnapshotEngine, defaultSnapshotEngine } from './snapshotEngine';
export type { CreateSnapshotInput } from './snapshotEngine';

// ─── 16.7 Outcome Evaluator ─────────────────────────────────────────────
export { OutcomeEvaluator, defaultOutcomeEvaluator } from './outcomeEvaluator';

// ─── 16.8 Replay Comparison Engine ──────────────────────────────────────
export { ComparisonEngine, defaultComparisonEngine } from './comparisonEngine';

// ─── 16.9 Experiment Lineage ────────────────────────────────────────────
export { LineageEngine, defaultLineageEngine } from './lineageEngine';

// ─── 16.10 Bootstrap Validation Engine ──────────────────────────────────
export { BootstrapEngine, defaultBootstrapEngine } from './bootstrapEngine';

// ─── 16.11 Replay Reporting ─────────────────────────────────────────────
export { ReplayReportGenerator, defaultReportGenerator } from './reporting';

// ─── 16.12 Research Dashboard Data Layer ────────────────────────────────
export { DashboardEngine, defaultDashboardEngine } from './dashboardEngine';