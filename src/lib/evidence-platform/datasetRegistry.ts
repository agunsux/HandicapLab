/**
 * Sprint A2 — Historical Dataset Registry
 * ========================================
 * Central registry that tracks every imported historical dataset.
 *
 * Every imported dataset receives a permanent identifier (ds_NNNNNN) and an
 * immutable registry record. Records are frozen on registration; corrections
 * create new records (append-only), never mutations.
 *
 * Tracked fields: dataset id, provider, league, season, source path,
 * checksum, fingerprint, file size, created time, imported time, schema
 * version, row count, integrity score, version, status.
 */

import { generateId, ID_PREFIX } from '../registry/identifiers';
import { EVIDENCE_SCHEMA_VERSION } from './types';
import type {
  DatasetRegistryEntry,
  DatasetRegistryQuery,
  DatasetRegistryStatus,
} from './types';

export interface RegisterDatasetInput {
  readonly provider: string;
  readonly leagueId: string;
  readonly seasonId: string;
  readonly sourcePath: string;
  readonly checksum: string;
  readonly fingerprint: string;
  readonly fileSize: number;
  readonly rowCount: number;
  readonly integrityScore: number;
  readonly createdAt?: string;
  readonly schemaVersion?: string;
  readonly version?: string;
  readonly status?: DatasetRegistryStatus;
}

export class DatasetRegistry {
  private readonly entries: Map<string, DatasetRegistryEntry> = new Map();

  /** Register a dataset and return its permanent, frozen record. */
  register(input: RegisterDatasetInput): DatasetRegistryEntry {
    const now = new Date().toISOString();
    const id = generateId(ID_PREFIX.DATASET);
    const entry: DatasetRegistryEntry = Object.freeze({
      id,
      provider: input.provider,
      leagueId: input.leagueId,
      seasonId: input.seasonId,
      sourcePath: input.sourcePath,
      checksum: input.checksum,
      fingerprint: input.fingerprint,
      fileSize: input.fileSize,
      createdAt: input.createdAt ?? now,
      importedAt: now,
      schemaVersion: input.schemaVersion ?? EVIDENCE_SCHEMA_VERSION,
      rowCount: input.rowCount,
      integrityScore: input.integrityScore,
      version: input.version ?? '1.0.0',
      status: input.status ?? 'imported',
    });
    this.entries.set(id, entry);
    return entry;
  }

  get(id: string): DatasetRegistryEntry | undefined {
    return this.entries.get(id);
  }

  has(id: string): boolean {
    return this.entries.has(id);
  }

  getAll(): readonly DatasetRegistryEntry[] {
    return Array.from(this.entries.values()).sort(
      (a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime()
    );
  }

  /** Find an already-registered dataset by its canonical fingerprint. */
  findByFingerprint(fingerprint: string): DatasetRegistryEntry | undefined {
    return Array.from(this.entries.values()).find((e) => e.fingerprint === fingerprint);
  }

  findByChecksum(checksum: string): DatasetRegistryEntry | undefined {
    return Array.from(this.entries.values()).find((e) => e.checksum === checksum);
  }

  query(query: DatasetRegistryQuery = {}): readonly DatasetRegistryEntry[] {
    return this.getAll().filter((e) => {
      if (query.provider && e.provider !== query.provider) return false;
      if (query.leagueId && e.leagueId !== query.leagueId) return false;
      if (query.seasonId && e.seasonId !== query.seasonId) return false;
      if (query.status && e.status !== query.status) return false;
      if (query.minIntegrityScore !== undefined && e.integrityScore < query.minIntegrityScore) return false;
      return true;
    });
  }

  /**
   * Transition a dataset's status by appending a new frozen record that shares
   * the same id. The previous record is preserved conceptually via events in
   * higher layers; here we keep the latest authoritative status. Because the
   * platform is append-only, callers should register a NEW dataset for data
   * changes — this only reflects lifecycle transitions of the same artifact.
   */
  markStatus(id: string, status: DatasetRegistryStatus): DatasetRegistryEntry {
    const existing = this.entries.get(id);
    if (!existing) throw new Error(`Dataset ${id} not found`);
    const updated: DatasetRegistryEntry = Object.freeze({ ...existing, status });
    this.entries.set(id, updated);
    return updated;
  }

  getStatistics(): {
    total: number;
    byStatus: Record<DatasetRegistryStatus, number>;
    avgIntegrityScore: number;
  } {
    const all = this.getAll();
    const byStatus: Record<DatasetRegistryStatus, number> = {
      imported: 0,
      validated: 0,
      archived: 0,
      rejected: 0,
    };
    for (const e of all) byStatus[e.status]++;
    const avg = all.length > 0 ? all.reduce((s, e) => s + e.integrityScore, 0) / all.length : 0;
    return { total: all.length, byStatus, avgIntegrityScore: avg };
  }
}

export const defaultDatasetRegistry = new DatasetRegistry();
