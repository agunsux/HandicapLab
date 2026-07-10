/**
 * Sprint A7 — Provenance Engine
 * ==============================
 * Builds the immutable provenance record that travels with every dataset
 * (and, via ReplayContext, through the Replay Engine).
 *
 * Provenance records:
 *   provider, version, source, download date, import date, checksum,
 *   fingerprint, schema version, validation version.
 *
 * The record is frozen on creation and satisfies ARCHITECTURE_INVARIANTS §13
 * (Every prediction traceable to source data).
 */

import type { CanonicalDataset } from '../dataset/types';
import { checksumOfSource, fingerprintDataset } from './hash';
import { EVIDENCE_SCHEMA_VERSION, VALIDATION_VERSION } from './types';
import type { DatasetProvenance } from './types';

export interface ProvenanceInput {
  readonly provider: string;
  readonly version: string;
  readonly source: string;
  readonly downloadDate?: string;
  readonly importDate?: string;
  readonly checksum: string;
  readonly fingerprint: string;
  readonly schemaVersion?: string;
  readonly validationVersion?: string;
}

export class ProvenanceEngine {
  /** Create a frozen provenance record from explicit inputs. */
  create(input: ProvenanceInput): DatasetProvenance {
    const now = new Date().toISOString();
    return Object.freeze({
      provider: input.provider,
      version: input.version,
      source: input.source,
      downloadDate: input.downloadDate ?? now,
      importDate: input.importDate ?? now,
      checksum: input.checksum,
      fingerprint: input.fingerprint,
      schemaVersion: input.schemaVersion ?? EVIDENCE_SCHEMA_VERSION,
      validationVersion: input.validationVersion ?? VALIDATION_VERSION,
    });
  }

  /**
   * Derive provenance directly from a canonical dataset plus a raw source
   * payload, computing checksum + fingerprint automatically.
   */
  fromDataset(
    dataset: CanonicalDataset,
    raw: string | unknown,
    meta: { provider: string; version: string; source: string; downloadDate?: string; importDate?: string }
  ): DatasetProvenance {
    return this.create({
      provider: meta.provider,
      version: meta.version,
      source: meta.source,
      downloadDate: meta.downloadDate,
      importDate: meta.importDate,
      checksum: checksumOfSource(raw),
      fingerprint: fingerprintDataset(dataset),
    });
  }

  /** Verify a dataset still matches a provenance fingerprint. */
  verify(dataset: CanonicalDataset, provenance: DatasetProvenance): boolean {
    return fingerprintDataset(dataset) === provenance.fingerprint;
  }
}

export const defaultProvenanceEngine = new ProvenanceEngine();
