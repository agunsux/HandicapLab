/**
 * HandicapLab Execution Metadata
 * ===========================================
 * Execution contract for every pipeline run.
 *
 * Every experiment, replay, or batch job produces an ExecutionMetadata
 * record that captures the runtime context, configuration identity,
 * resource usage, and final status.
 */

export interface ExecutionMetadata {
  /** Unique identifier for this execution. */
  executionId: string;
 
  /** Correlation ID linking related executions. */
  correlationId: string;
 
  /** Replay ID if this execution is part of a replay session. */
  replayId?: string;
 
  /** Experiment ID if this execution originated from an experiment. */
  experimentId?: string;
 
  /** Worker or node that executed this run. */
  workerId?: string;
 
  /** Hash of the full configuration to enable reproducibility. */
  configurationHash: string;
 
  /** Hash of the dataset used during execution. */
  datasetHash: string;
 
  /** Version of the engine that executed the run. */
  engineVersion: string;
 
  /** Seed used for replay / random number generation. */
  replaySeed: number;
 
  /** ISO timestamp when execution started. */
  startedAt: string;
 
  /** ISO timestamp when execution finished. */
  finishedAt?: string;
 
  /** Total wall-clock duration in milliseconds. */
  durationMs?: number;
 
  /** Peak memory usage in megabytes. */
  memoryUsageMb?: number;
 
  /** Execution lifecycle status. */
  status: 'pending' | 'running' | 'completed' | 'failed';
}
