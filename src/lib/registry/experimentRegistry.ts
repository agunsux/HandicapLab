/**
 * HandicapLab Experiment Registry
 * =======================================
 * Central registry for all research experiments.
 *
 * Every experiment is IMMUTABLE after completion.
 * All results are reproducible via stored configuration hashes.
 *
 * Hardening: standardized IDs, metadata contract, domain events.
 */

import crypto from 'crypto';
import { generateId, ID_PREFIX } from './identifiers';
import { createBaseMetadata } from './metadata';
import { createEvent, RegistryEvent, RegistryEventType } from './events';

export type ExperimentStatus = 'draft' | 'running' | 'completed' | 'failed' | 'archived';

export interface ExperimentConfig {
  datasetVersion: string;
  datasetHash: string;
  replaySeed: number;
  featureSetVersion: string;
  modelVersion: string;
  configurationHash: string;
  engineVersion: string;
  parameters: Record<string, number>;
}

export interface ExperimentMetrics {
  roi: number;
  yield_: number;
  brierScore: number;
  logLoss: number;
  ece: number;
  avgClv: number;
  sharpeRatio: number;
  winRate: number;
}

export interface ExperimentRecord {
  id: string;
  executionId: string;
  correlationId: string;
  objective: string;
  hypothesis: string;
  researcher: string;
  status: ExperimentStatus;
  config: ExperimentConfig;
  metrics?: ExperimentMetrics;
  tags: string[];
  notes: string;
  createdAt: string;
  finishedAt?: string;
  events: RegistryEvent[];
}

export interface ExperimentSummary {
  id: string;
  objective: string;
  status: ExperimentStatus;
  createdAt: string;
  roi: number;
  brierScore: number;
  modelVersion: string;
}

export class ExperimentRegistry {
  private experiments: Map<string, ExperimentRecord> = new Map();
  private summaries: ExperimentSummary[] = [];

  create(
    objective: string,
    hypothesis: string,
    researcher: string,
    config: ExperimentConfig,
    tags: string[] = [],
    notes: string = ''
  ): ExperimentRecord {
    const id = generateId(ID_PREFIX.EXPERIMENT);
    const executionId = crypto.randomUUID();
    const correlationId = crypto.randomUUID();
    const meta = createBaseMetadata({ id, owner: researcher, tags });

    const record: ExperimentRecord = {
      id,
      executionId,
      correlationId,
      objective,
      hypothesis,
      researcher,
      status: 'draft' as ExperimentStatus,
      config,
      tags,
      notes,
      createdAt: meta.createdAt,
      events: [],
    };

    record.events.push(createEvent('ExperimentCreated' as RegistryEventType, id, 'experiment', { objective, hypothesis }));
    this.experiments.set(id, record);
    return record;
  }

  start(id: string): ExperimentRecord {
    const exp = this.experiments.get(id);
    if (!exp) throw new Error(`Experiment ${id} not found`);
    if (exp.status !== 'draft') throw new Error(`Cannot start experiment in status: ${exp.status}`);
    exp.status = 'running';
    exp.events.push(createEvent('ExperimentStarted' as RegistryEventType, id, 'experiment', { status: 'running' }));
    return exp;
  }

  complete(id: string, metrics: ExperimentMetrics): ExperimentRecord {
    const exp = this.experiments.get(id);
    if (!exp) throw new Error(`Experiment ${id} not found`);
    exp.status = 'completed';
    exp.metrics = metrics;
    exp.finishedAt = new Date().toISOString();
    exp.events.push(createEvent('ExperimentCompleted' as RegistryEventType, id, 'experiment', { roi: metrics.roi }));

    this.summaries.push({
      id: exp.id,
      objective: exp.objective,
      status: exp.status,
      createdAt: exp.createdAt,
      roi: metrics.roi,
      brierScore: metrics.brierScore,
      modelVersion: exp.config.modelVersion,
    });

    return Object.freeze(exp);
  }

  fail(id: string, errorMessage: string): ExperimentRecord {
    const exp = this.experiments.get(id);
    if (!exp) throw new Error(`Experiment ${id} not found`);
    exp.status = 'failed';
    exp.notes = errorMessage;
    exp.finishedAt = new Date().toISOString();
    exp.events.push(createEvent('ExperimentFailed' as RegistryEventType, id, 'experiment', { error: errorMessage }));
    return exp;
  }

  archive(id: string): ExperimentRecord {
    const exp = this.experiments.get(id);
    if (!exp) throw new Error(`Experiment ${id} not found`);
    exp.status = 'archived';
    exp.events.push(createEvent('ExperimentCompleted' as RegistryEventType, id, 'experiment', { status: 'archived' }));
    return exp;
  }

  get(id: string): ExperimentRecord | undefined {
    return this.experiments.get(id);
  }

  getAll(): ExperimentRecord[] {
    return Array.from(this.experiments.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getSummaries(): ExperimentSummary[] {
    return [...this.summaries].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  findByModelVersion(version: string): ExperimentRecord[] {
    return this.getAll().filter((e) => e.config.modelVersion === version);
  }

  findByDatasetHash(hash: string): ExperimentRecord[] {
    return this.getAll().filter((e) => e.config.datasetHash === hash);
  }

  getLatest(): ExperimentRecord | undefined {
    const all = this.getAll();
    return all.length > 0 ? all[0] : undefined;
  }

  getStatistics(): { total: number; completed: number; failed: number; running: number; avgRoi: number } {
    const all = this.getAll();
    const completed = all.filter((e) => e.status === 'completed');
    return {
      total: all.length,
      completed: completed.length,
      failed: all.filter((e) => e.status === 'failed').length,
      running: all.filter((e) => e.status === 'running').length,
      avgRoi: completed.length > 0
        ? completed.reduce((sum, e) => sum + (e.metrics?.roi ?? 0), 0) / completed.length
        : 0,
    };
  }
}

export const experimentRegistry = new ExperimentRegistry();