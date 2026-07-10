/**
 * Sprint A8 — Dataset Versioning
 * ===============================
 * Immutable, append-only version store for canonical datasets.
 *
 * Datasets are versioned per logical key (e.g. "epl:2024-2025"). Versions are
 * assigned sequentially as v1, v2, v3, ... and are NEVER overwritten. Replay
 * and experiments must always specify a dataset version.
 *
 * Satisfies ARCHITECTURE_INVARIANTS §14 (Historical Artifacts Are Append-Only)
 * and §8 (immutable dataset versions).
 */

import type { CanonicalDataset } from '../dataset/types';
import { fingerprintDataset } from './hash';
import type { DatasetVersionRecord } from './types';

export class DatasetVersionStore {
  private readonly versions: Map<string, DatasetVersionRecord[]> = new Map();

  /**
   * Commit a new immutable version of a dataset under a logical key.
   * Returns the frozen version record (v1, v2, ...).
   *
   * If the exact same fingerprint is committed again, a new version is still
   * created (append-only), but callers can detect the no-op via `isDuplicate`.
   */
  commit(key: string, dataset: CanonicalDataset): DatasetVersionRecord {
    const list = this.versions.get(key) ?? [];
    const versionNumber = list.length + 1;
    const record: DatasetVersionRecord = Object.freeze({
      key,
      version: `v${versionNumber}`,
      datasetId: dataset.manifest.id,
      fingerprint: fingerprintDataset(dataset),
      createdAt: new Date().toISOString(),
      dataset: Object.freeze(dataset),
    });
    list.push(record);
    this.versions.set(key, list);
    return record;
  }

  /** Returns true if a dataset with an identical fingerprint already exists. */
  isDuplicate(key: string, dataset: CanonicalDataset): boolean {
    const fp = fingerprintDataset(dataset);
    return (this.versions.get(key) ?? []).some((v) => v.fingerprint === fp);
  }

  getVersion(key: string, version: string): DatasetVersionRecord | undefined {
    return (this.versions.get(key) ?? []).find((v) => v.version === version);
  }

  getLatest(key: string): DatasetVersionRecord | undefined {
    const list = this.versions.get(key) ?? [];
    return list.length > 0 ? list[list.length - 1] : undefined;
  }

  listVersions(key: string): readonly DatasetVersionRecord[] {
    return [...(this.versions.get(key) ?? [])];
  }

  listKeys(): readonly string[] {
    return Array.from(this.versions.keys());
  }

  versionCount(key: string): number {
    return (this.versions.get(key) ?? []).length;
  }
}

export const defaultDatasetVersionStore = new DatasetVersionStore();
