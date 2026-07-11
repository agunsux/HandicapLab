/**
 * EPIC 16.1 — Replay Orchestrator
 * =================================
 * Coordinates complete research executions by scheduling replay jobs,
 * creating replay sessions, and managing lifecycle.
 *
 * Responsibilities:
 *   - schedule replay jobs
 *   - create replay sessions
 *   - attach dataset provenance
 *   - attach model version
 *   - attach feature version
 *   - attach experiment id
 *   - attach replay id
 *   - deterministic execution
 *   - resume interrupted replay
 *   - cancellation support
 *   - progress reporting
 */

import { ReplaySessionManager } from './sessionManager';
import type { CreateSessionInput } from './sessionManager';
import { WalkForwardEngine } from './walkForwardEngine';
import { BaselineRegistry } from './baselineStrategies';
import { OutcomeEvaluator } from './outcomeEvaluator';
import { SnapshotEngine } from './snapshotEngine';
import { ComparisonEngine } from './comparisonEngine';
import { BootstrapEngine } from './bootstrapEngine';
import { LineageEngine } from './lineageEngine';
import type { ReplayJob, ReplayJobStatus, OrchestratorOptions } from './types';
import { generateJobId } from './id';
import type { HistoricalMatch } from '../replay/types';

export interface OrchestrateInput {
  readonly experimentId: string;
  readonly datasetId: string;
  readonly datasetFingerprint: string;
  readonly datasetVersion: string;
  readonly modelVersion: string;
  readonly featureVersion: string;
  readonly predictionEngineVersion: string;
  readonly seed?: number;
  readonly baselineIds?: readonly string[];
  readonly matches?: readonly HistoricalMatch[];
}

export class ReplayOrchestrator {
  private readonly jobs: Map<string, ReplayJob> = new Map();
  private cancelled = new Set<string>();

  constructor(
    readonly sessionManager: ReplaySessionManager,
    readonly walkForwardEngine: WalkForwardEngine,
    readonly baselineRegistry: BaselineRegistry,
    readonly outcomeEvaluator: OutcomeEvaluator,
    readonly snapshotEngine: SnapshotEngine,
    readonly comparisonEngine: ComparisonEngine,
    readonly bootstrapEngine: BootstrapEngine,
    readonly lineageEngine: LineageEngine,
    readonly options: OrchestratorOptions = {}
  ) {}

  /** Schedule a new replay job. */
  schedule(input: OrchestrateInput): ReplayJob {
    const job: ReplayJob = Object.freeze({
      jobId: generateJobId(),
      experimentId: input.experimentId,
      datasetId: input.datasetId,
      datasetFingerprint: input.datasetFingerprint,
      datasetVersion: input.datasetVersion,
      modelVersion: input.modelVersion,
      featureVersion: input.featureVersion,
      baselineId: null,
      sessionId: null,
      status: 'pending',
      progress: 0,
      error: null,
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
    });
    this.jobs.set(job.jobId, job);
    return job;
  }

  /** Start execution of a pending job. */
  start(jobId: string): ReplayJob {
    const existing = this.jobs.get(jobId);
    if (!existing) throw new Error(`Job ${jobId} not found`);
    if (existing.status !== 'pending') throw new Error(`Job ${jobId} is not pending`);

    const started: ReplayJob = Object.freeze({
      ...existing,
      status: 'running',
      startedAt: new Date().toISOString(),
    });
    this.jobs.set(jobId, started);
    return started;
  }

  /** Report progress for a job. */
  reportProgress(jobId: string, progress: number): ReplayJob {
    const existing = this.jobs.get(jobId);
    if (!existing) throw new Error(`Job ${jobId} not found`);
    const updated: ReplayJob = Object.freeze({ ...existing, progress: Math.min(100, Math.max(0, progress)) });
    this.jobs.set(jobId, updated);
    return updated;
  }

  /** Complete a job successfully. */
  complete(jobId: string, sessionId: string): ReplayJob {
    const existing = this.jobs.get(jobId);
    if (!existing) throw new Error(`Job ${jobId} not found`);
    const updated: ReplayJob = Object.freeze({
      ...existing,
      status: 'completed',
      sessionId,
      progress: 100,
      completedAt: new Date().toISOString(),
    });
    this.jobs.set(jobId, updated);
    return updated;
  }

  /** Fail a job. */
  fail(jobId: string, error: string): ReplayJob {
    const existing = this.jobs.get(jobId);
    if (!existing) throw new Error(`Job ${jobId} not found`);
    const updated: ReplayJob = Object.freeze({
      ...existing,
      status: 'failed',
      error,
      completedAt: new Date().toISOString(),
    });
    this.jobs.set(jobId, updated);
    return updated;
  }

  /** Cancel a running job. */
  cancel(jobId: string): ReplayJob {
    const existing = this.jobs.get(jobId);
    if (!existing) throw new Error(`Job ${jobId} not found`);
    this.cancelled.add(jobId);
    const updated: ReplayJob = Object.freeze({ ...existing, status: 'cancelled', completedAt: new Date().toISOString() });
    this.jobs.set(jobId, updated);
    return updated;
  }

  /** Check if a job has been cancelled. */
  isCancelled(jobId: string): boolean {
    return this.cancelled.has(jobId);
  }

  /** Resume a failed/paused job. */
  resume(jobId: string): ReplayJob {
    const existing = this.jobs.get(jobId);
    if (!existing) throw new Error(`Job ${jobId} not found`);
    if (existing.status !== 'failed' && existing.status !== 'paused') {
      throw new Error(`Job ${jobId} cannot be resumed from status ${existing.status}`);
    }
    this.cancelled.delete(jobId);
    const updated: ReplayJob = Object.freeze({ ...existing, status: 'running', error: null });
    this.jobs.set(jobId, updated);
    return updated;
  }

  get(jobId: string): ReplayJob | undefined {
    return this.jobs.get(jobId);
  }

  getAll(): readonly ReplayJob[] {
    return Array.from(this.jobs.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  count(): number {
    return this.jobs.size;
  }
}