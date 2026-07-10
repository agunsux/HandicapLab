/**
 * Sprint A3 — Dataset Manifest Generator
 * =======================================
 * Automatically generates an exportable manifest for a CanonicalDataset.
 *
 * The manifest captures the dataset fingerprint, checksum, version,
 * provenance descriptors, quality counters (missing fields, duplicate
 * rows, invalid rows) and a validation summary.
 *
 * Manifests are pure derivations of a dataset — deterministic for the same
 * dataset + inputs. Export to JSON via `toJSON`.
 */

import type { CanonicalDataset } from '../dataset/types';
import { DatasetValidator } from '../dataset/validator';
import { fingerprintDataset } from './hash';
import { EVIDENCE_SCHEMA_VERSION } from './types';
import type { EvidenceDatasetManifest, ValidationSummary } from './types';

export interface ManifestInput {
  readonly dataset: CanonicalDataset;
  readonly checksum: string;
  readonly provider: string;
  readonly competition: string;
  readonly season: string;
  readonly version?: string;
  readonly importTimestamp?: string;
}

export class ManifestGenerator {
  private readonly validator: DatasetValidator;

  constructor(validator: DatasetValidator = new DatasetValidator()) {
    this.validator = validator;
  }

  generate(input: ManifestInput): EvidenceDatasetManifest {
    const { dataset } = input;
    const report = this.validator.validate(dataset, dataset.teams, dataset.competitions);
    const fingerprint = fingerprintDataset(dataset);

    const validationSummary: ValidationSummary = {
      valid: report.valid,
      totalFixtures: report.totalFixtures,
      validFixtures: report.validFixtures,
      invalidFixtures: report.invalidFixtures,
      errorCount: report.errors.length,
      warningCount: report.warnings.length,
    };

    return {
      datasetId: dataset.manifest.id,
      fingerprint,
      checksum: input.checksum,
      version: input.version ?? dataset.manifest.version,
      provider: input.provider,
      competition: input.competition,
      season: input.season,
      importTimestamp: input.importTimestamp ?? new Date().toISOString(),
      rowCount: dataset.matches.length,
      missingFields: this.detectMissingFields(dataset),
      duplicateRows: report.duplicateFixtures,
      invalidRows: report.invalidFixtures,
      validationSummary,
      schemaVersion: EVIDENCE_SCHEMA_VERSION,
    };
  }

  /** Names of expected fields absent across the dataset (informational). */
  private detectMissingFields(dataset: CanonicalDataset): readonly string[] {
    const missing = new Set<string>();
    let anyOdds = false;
    let anyResult = false;
    let anyRound = false;
    let anyClosingOdds = false;

    for (const m of dataset.matches) {
      if (m.odds.length > 0) anyOdds = true;
      if (m.result) anyResult = true;
      if (m.fixture.round) anyRound = true;
      if (m.odds.some((o) => o.closingHomeOdds !== undefined)) anyClosingOdds = true;
    }

    if (!anyOdds) missing.add('odds');
    if (!anyResult) missing.add('result');
    if (!anyRound) missing.add('fixture.round');
    if (!anyClosingOdds) missing.add('odds.closing');
    if (dataset.teams.length === 0) missing.add('teams');
    if (dataset.competitions.length === 0) missing.add('competitions');
    if (dataset.seasons.length === 0) missing.add('seasons');

    return Array.from(missing).sort();
  }

  /** Serialize a manifest to a pretty JSON string. */
  toJSON(manifest: EvidenceDatasetManifest): string {
    return JSON.stringify(manifest, null, 2);
  }
}

export const defaultManifestGenerator = new ManifestGenerator();
