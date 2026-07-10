/**
 * HandicapLab Benchmark Registry
 * ================================
 * Records and queries benchmark results comparing models.
 */

import { BenchmarkResult } from './types';
import { generateId, ID_PREFIX } from '../registry/identifiers';

export interface BenchmarkRecord {
  id: string;
  experimentId: string;
  modelId: string;
  modelName: string;
  modelVersion: string;
  datasetHash: string;
  datasetVersion: string;
  result: BenchmarkResult;
  createdAt: string;
}

export class BenchmarkRegistry {
  private records: BenchmarkRecord[] = [];

  record(
    experimentId: string,
    modelId: string,
    modelName: string,
    modelVersion: string,
    datasetHash: string,
    datasetVersion: string,
    result: BenchmarkResult,
  ): BenchmarkRecord {
    const id = generateId(ID_PREFIX.PENCHMARK);
    const record: BenchmarkRecord = {
      id,
      experimentId,
      modelId,
      modelName,
      modelVersion,
      datasetHash,
      datasetVersion,
      result,
      createdAt: new Date().toISOString(),
    };
    this.records.push(record);
    return record;
  }

  getAll(): BenchmarkRecord[] {
    return [...this.records].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  getByModelId(modelId: string): BenchmarkRecord[] {
    return this.records.filter((r) => r.modelId === modelId);
  }

  getByExperimentId(experimentId: string): BenchmarkRecord[] {
    return this.records.filter((r) => r.experimentId === experimentId);
  }

  getLatestByModelId(modelId: string): BenchmarkRecord | undefined {
    const modelRecords = this.getByModelId(modelId);
    return modelRecords.length > 0 ? modelRecords[0] : undefined;
  }
}

export const benchmarkRegistry = new BenchmarkRegistry();
