/**
 * HandicapLab Execution Pipeline - Core Types
 * =============================================
 */

import { ExperimentRecord } from '../registry/experimentRegistry';
import { ModelMetrics } from '../registry/modelRegistry';
import { CalibrationReport } from '../validation/calibration';
import { ValidationMetrics } from '../validation/metrics';
import { ReplayMetrics } from '../replay/types';

export interface PipelineStageResult {
  stage: string;
  status: 'success' | 'failed' | 'skipped';
  durationMs: number;
  error?: string;
}

export interface ExecutionContext {
  executionId: string;
  correlationId: string;
  experimentId: string;
  modelId: string;
  datasetHash: string;
  startedAt: string;
  configurationHash: string;
  stageResults: PipelineStageResult[];
}

export interface ModelComparisonDelta {
  roi: number;
  brierScore: number;
  ece: number;
  sharpeRatio?: number;
  winRate?: number;
}

export interface BenchmarkResult {
  opponentId: string;
  opponentName: string;
  ourMetrics: ModelMetrics;
  opponentMetrics: ModelMetrics;
  deltas: ModelComparisonDelta;
  recommendation: 'promote' | 'hold' | 'shadow' | 'deprecate';
  timestamp: string;
}

export interface ExperimentArtifacts {
  experimentId: string;
  config: { modelId: string; datasetHash: string; replaySeed?: number };
  validation: Record<string, unknown>;
  benchmark: Record<string, unknown>;
  report: string;
  summary: { roi: number; brier: number; ece: number };
  logs: string[];
  createdAt: string;
}

export interface ExperimentResult {
  experiment: ExperimentRecord;
  dataset: { hash: string; version: string };
  model: { id: string; name: string; version: string };
  replay: ReplayMetrics;
  validation: ValidationMetrics;
  calibration: CalibrationReport;
  benchmark: BenchmarkResult[];
  artifacts: ExperimentArtifacts;
  metadata: {
    executionId: string;
    correlationId: string;
    configurationHash: string;
    datasetHash: string;
    engineVersion: string;
    replaySeed: number;
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    status: string;
  };
  durationMs: number;
  completedAt: string;
}
