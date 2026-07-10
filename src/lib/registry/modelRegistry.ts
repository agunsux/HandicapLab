/**
 * HandicapLab Model Registry
 * ============================
 * Full lifecycle management for prediction models.
 *
 * Every model has a unique identity, semantic versioning,
 * training provenance, and a promotion history that is
 * never overwritten.
 *
 * Status flow:
 *   candidate → challenger → champion → deprecated → archived
 *   candidate → shadow → champion
 *
 * Hardening: standardized IDs, metadata contract, domain events.
 */

import crypto from 'crypto';
import { generateId, ID_PREFIX } from './identifiers';
import { createBaseMetadata } from './metadata';
import { createEvent, RegistryEvent, RegistryEventType } from './events';

export type ModelStatus = 'candidate' | 'challenger' | 'champion' | 'shadow' | 'deprecated' | 'archived';

export interface ModelMetrics {
  roi: number;
  brierScore: number;
  logLoss: number;
  ece: number;
  avgClv: number;
  sharpeRatio: number;
  winRate: number;
  totalBets: number;
}

export interface TrainingConfig {
  datasetVersion: string;
  datasetHash: string;
  featureSetVersion: string;
  parameters: Record<string, number>;
  trainingDate: string;
  trainingDurationMs: number;
}

export interface PromotionEvent {
  fromStatus: ModelStatus;
  toStatus: ModelStatus;
  timestamp: string;
  reason: string;
  benchmarkReport?: string;
}

export interface ModelRecord {
  id: string;
  name: string;
  semanticVersion: string;
  description: string;
  owner: string;
  status: ModelStatus;
  algo: string;
  config: TrainingConfig;
  validationMetrics?: ModelMetrics;
  calibrationMetrics?: { ece: number; mce: number; sharpness: number };
  benchmarkHistory: Array<{ timestamp: string; metrics: ModelMetrics; opponent: string }>;
  promotionHistory: PromotionEvent[];
  events: RegistryEvent[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export class ModelRegistry {
  private models: Map<string, ModelRecord> = new Map();

  register(name: string, version: string, description: string, owner: string, algo: string, config: TrainingConfig): ModelRecord {
    const id = generateId(ID_PREFIX.MODEL);
    if (Array.from(this.models.values()).some((m) => m.name === name && m.semanticVersion === version)) {
      throw new Error(`Model ${name} v${version} already registered`);
    }

    const now = new Date().toISOString();
    const record: ModelRecord = {
      id,
      name,
      semanticVersion: version,
      description,
      owner,
      status: 'candidate' as ModelStatus,
      algo,
      config,
      benchmarkHistory: [],
      promotionHistory: [],
      events: [],
      tags: [],
      createdAt: now,
      updatedAt: now,
    };

    record.events.push(createEvent('ModelRegistered' as RegistryEventType, id, 'model', { name, version, algo }));
    this.models.set(id, record);
    return record;
  }

  get(id: string): ModelRecord | undefined {
    return this.models.get(id);
  }

  getAll(): ModelRecord[] {
    return Array.from(this.models.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getByStatus(status: ModelStatus): ModelRecord[] {
    return this.getAll().filter((m) => m.status === status);
  }

  getChampion(): ModelRecord | undefined {
    return this.getAll().find((m) => m.status === 'champion');
  }

  getChallengers(): ModelRecord[] {
    return this.getByStatus('challenger');
  }

  setValidationMetrics(id: string, metrics: ModelMetrics, calibrationMetrics?: { ece: number; mce: number; sharpness: number }): ModelRecord {
    const model = this.models.get(id);
    if (!model) throw new Error(`Model ${id} not found`);
    model.validationMetrics = metrics;
    model.calibrationMetrics = calibrationMetrics;
    model.updatedAt = new Date().toISOString();
    return model;
  }

  addBenchmark(id: string, metrics: ModelMetrics, opponent: string): ModelRecord {
    const model = this.models.get(id);
    if (!model) throw new Error(`Model ${id} not found`);
    model.benchmarkHistory.push({ timestamp: new Date().toISOString(), metrics, opponent });
    model.updatedAt = new Date().toISOString();
    return model;
  }

  promote(id: string, toStatus: ModelStatus, reason: string): ModelRecord {
    const model = this.models.get(id);
    if (!model) throw new Error(`Model ${id} not found`);

    const fromStatus = model.status;
    const validTransitions: Record<ModelStatus, ModelStatus[]> = {
      candidate: ['challenger', 'shadow', 'archived'],
      challenger: ['champion', 'shadow', 'deprecated', 'archived'],
      champion: ['deprecated', 'archived'],
      shadow: ['champion', 'challenger', 'deprecated', 'archived'],
      deprecated: ['archived'],
      archived: [],
    };

    const allowed = validTransitions[fromStatus];
    if (!allowed.includes(toStatus)) {
      throw new Error(`Invalid promotion: ${fromStatus} → ${toStatus}. Allowed: ${allowed.join(', ')}`);
    }

    if (toStatus === 'champion') {
      const currentChampion = this.getChampion();
      if (currentChampion && currentChampion.id !== id) {
        currentChampion.status = 'challenger' as ModelStatus;
        currentChampion.promotionHistory.push({
          fromStatus: 'champion' as ModelStatus,
          toStatus: 'challenger' as ModelStatus,
          timestamp: new Date().toISOString(),
          reason: `Superseded by ${model.name} v${model.semanticVersion}`,
        });
        currentChampion.updatedAt = new Date().toISOString();
        model.events.push(createEvent('ChampionChanged' as RegistryEventType, currentChampion.id, 'model', {
          from: 'champion', to: 'challenger', supersededBy: model.id,
        }));
      }
    }

    model.promotionHistory.push({ fromStatus, toStatus, timestamp: new Date().toISOString(), reason });
    model.status = toStatus;
    model.updatedAt = new Date().toISOString();
    model.events.push(createEvent('ModelPromoted' as RegistryEventType, id, 'model', { from: fromStatus, to: toStatus }));
    return model;
  }

  getPromotionHistory(id: string): PromotionEvent[] {
    const model = this.models.get(id);
    return model ? [...model.promotionHistory] : [];
  }

  compareModels(idA: string, idB: string): { a: ModelRecord | undefined; b: ModelRecord | undefined; metricDeltas: Record<string, number> } {
    const a = this.models.get(idA);
    const b = this.models.get(idB);
    const deltas: Record<string, number> = {};

    if (a?.validationMetrics && b?.validationMetrics) {
      deltas.roi = b.validationMetrics.roi - a.validationMetrics.roi;
      deltas.brierScore = a.validationMetrics.brierScore - b.validationMetrics.brierScore;
      deltas.ece = a.validationMetrics.ece - b.validationMetrics.ece;
      deltas.sharpeRatio = b.validationMetrics.sharpeRatio - a.validationMetrics.sharpeRatio;
    }

    return { a, b, metricDeltas: deltas };
  }

  getStatistics(): { total: number; candidates: number; challengers: number; champions: number; archived: number } {
    const all = this.getAll();
    return {
      total: all.length,
      candidates: all.filter((m) => m.status === 'candidate').length,
      challengers: all.filter((m) => m.status === 'challenger').length,
      champions: all.filter((m) => m.status === 'champion').length,
      archived: all.filter((m) => m.status === 'archived' || m.status === 'deprecated').length,
    };
  }
}

export const modelRegistry = new ModelRegistry();