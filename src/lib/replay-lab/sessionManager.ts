/**
 * EPIC 16.2 — Replay Session Manager
 * ===================================
 * Creates and manages immutable ReplaySessionSnapshot objects.
 *
 * Every replay session has complete lineage:
 *   session id, experiment id, dataset id, dataset fingerprint,
 *   dataset version, model version, feature version, prediction engine
 *   version, architecture version, git commit, seed, timing, metrics.
 *
 * Sessions are append-only — once completed they are never mutated.
 */

import crypto from 'crypto';
import type { ReplayConfig, ReplayMetrics } from '../replay/types';
import { REPLAY_LAB_VERSION } from './types';
import type { ReplaySessionSnapshot, SessionStatus } from './types';
import { generateSessionId } from './id';

export interface CreateSessionInput {
  readonly experimentId: string;
  readonly datasetId: string;
  readonly datasetFingerprint: string;
  readonly datasetVersion: string;
  readonly modelVersion: string;
  readonly featureVersion: string;
  readonly predictionEngineVersion: string;
  readonly seed?: number;
  readonly baselineId?: string;
  readonly replayConfig?: ReplayConfig;
  readonly gitCommit?: string;
}

export class ReplaySessionManager {
  private readonly sessions: Map<string, ReplaySessionSnapshot> = new Map();

  /** Resolve the current git commit hash, defaulting to "unknown". */
  private resolveGitCommit(explicit?: string): string {
    if (explicit) return explicit;
    return process.env.GIT_COMMIT ?? process.env.VERCEL_GIT_COMMIT_SHA ?? 'unknown';
  }

  /** Create a new immutable replay session. */
  create(input: CreateSessionInput): ReplaySessionSnapshot {
    const seed = input.seed ?? 42;
    const session: ReplaySessionSnapshot = Object.freeze({
      sessionId: generateSessionId(),
      experimentId: input.experimentId,
      datasetId: input.datasetId,
      datasetFingerprint: input.datasetFingerprint,
      datasetVersion: input.datasetVersion,
      modelVersion: input.modelVersion,
      featureVersion: input.featureVersion,
      predictionEngineVersion: input.predictionEngineVersion,
      architectureVersion: REPLAY_LAB_VERSION,
      gitCommit: this.resolveGitCommit(input.gitCommit),
      seed,
      startTime: new Date().toISOString(),
      finishTime: null,
      status: 'created',
      metrics: null,
      baselineId: input.baselineId ?? null,
      replayConfig: input.replayConfig ?? {},
      error: null,
    });
    this.sessions.set(session.sessionId, session);
    return session;
  }

  /** Mark a session as running (in-place frozen update). */
  markRunning(sessionId: string): ReplaySessionSnapshot {
    const existing = this.sessions.get(sessionId);
    if (!existing) throw new Error(`Session ${sessionId} not found`);
    const updated: ReplaySessionSnapshot = Object.freeze({ ...existing, status: 'running' });
    this.sessions.set(sessionId, updated);
    return updated;
  }

  /** Complete a session with final metrics and status. */
  complete(sessionId: string, metrics: ReplayMetrics, status: SessionStatus = 'completed'): ReplaySessionSnapshot {
    const existing = this.sessions.get(sessionId);
    if (!existing) throw new Error(`Session ${sessionId} not found`);
    const updated: ReplaySessionSnapshot = Object.freeze({
      ...existing,
      status,
      metrics,
      finishTime: new Date().toISOString(),
      error: status === 'failed' ? 'Execution failed' : null,
    });
    this.sessions.set(sessionId, updated);
    return updated;
  }

  /** Fail a session with an error message. */
  fail(sessionId: string, error: string): ReplaySessionSnapshot {
    const existing = this.sessions.get(sessionId);
    if (!existing) throw new Error(`Session ${sessionId} not found`);
    const updated: ReplaySessionSnapshot = Object.freeze({
      ...existing,
      status: 'failed',
      finishTime: new Date().toISOString(),
      error,
    });
    this.sessions.set(sessionId, updated);
    return updated;
  }

  get(sessionId: string): ReplaySessionSnapshot | undefined {
    return this.sessions.get(sessionId);
  }

  getAll(): readonly ReplaySessionSnapshot[] {
    return Array.from(this.sessions.values()).sort(
      (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
  }

  getByExperiment(experimentId: string): readonly ReplaySessionSnapshot[] {
    return this.getAll().filter((s) => s.experimentId === experimentId);
  }

  count(): number {
    return this.sessions.size;
  }
}

export const defaultSessionManager = new ReplaySessionManager();