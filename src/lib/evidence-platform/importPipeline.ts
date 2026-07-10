/**
 * Sprint A10 — Historical Import Pipeline
 * ========================================
 * Ingests CSV, JSON, and future API snapshots into the Historical Evidence
 * Platform through a deterministic, staged pipeline:
 *
 *   Import → Normalize → Canonical Mapping → Validation → Integrity →
 *   Manifest → Registry → Storage → Ready
 *
 * Each stage is timed and logged. Datasets that fail validation, integrity
 * (errors), or leakage detection are rejected. All collaborators are
 * dependency-injected for testability.
 */

import crypto from 'crypto';
import type {
  CanonicalCompetition,
  CanonicalDataset,
  CanonicalMatch,
  CanonicalSeason,
  CanonicalTeam,
  DatasetManifest,
} from '../dataset/types';
import { DatasetValidator } from '../dataset/validator';
import { fingerprintDataset, checksumOfSource } from './hash';
import { IntegrityEngine } from './integrityEngine';
import { ManifestGenerator } from './manifestGenerator';
import { LeakageDetector } from './leakageDetector';
import { ProvenanceEngine } from './provenanceEngine';
import { DatasetRegistry } from './datasetRegistry';
import { DatasetVersionStore } from './datasetVersionStore';
import { DatasetEvidenceLedger } from './evidenceLedger';
import { normalizeCsv, normalizeJson, parseCsv, type NormalizeOutput } from './parsers';
import type {
  ImportResult,
  ImportSource,
  ImportStage,
  ImportStageLog,
  ValidationSummary,
} from './types';

// ─── Storage Abstraction ───────────────────────────────────────────────

export interface EvidenceStorageAdapter {
  save(datasetId: string, dataset: CanonicalDataset): void;
  load(datasetId: string): CanonicalDataset | undefined;
  has(datasetId: string): boolean;
}

export class InMemoryEvidenceStorage implements EvidenceStorageAdapter {
  private readonly store: Map<string, CanonicalDataset> = new Map();
  save(datasetId: string, dataset: CanonicalDataset): void {
    this.store.set(datasetId, dataset);
  }
  load(datasetId: string): CanonicalDataset | undefined {
    return this.store.get(datasetId);
  }
  has(datasetId: string): boolean {
    return this.store.has(datasetId);
  }
}

// ─── Pipeline Dependencies ──────────────────────────────────────────────

export interface ImportPipelineDeps {
  readonly validator: DatasetValidator;
  readonly integrityEngine: IntegrityEngine;
  readonly manifestGenerator: ManifestGenerator;
  readonly leakageDetector: LeakageDetector;
  readonly provenanceEngine: ProvenanceEngine;
  readonly registry: DatasetRegistry;
  readonly versionStore: DatasetVersionStore;
  readonly ledger: DatasetEvidenceLedger;
  readonly storage: EvidenceStorageAdapter;
}

function assembleDataset(
  normalized: NormalizeOutput,
  provenance: string
): CanonicalDataset {
  const teams: CanonicalTeam[] = [...normalized.teams];
  const competitions: CanonicalCompetition[] = [...normalized.competitions];
  const seasons: CanonicalSeason[] = [...normalized.seasons];

  const matches: CanonicalMatch[] = normalized.bundle.fixtures.map((f) => ({
    fixture: {
      id: f.id,
      competitionId: f.competitionId,
      seasonId: f.seasonId,
      homeTeamId: f.homeTeamId,
      awayTeamId: f.awayTeamId,
      kickoff: f.kickoff,
      round: f.round,
      status: f.status,
    },
    odds: normalized.bundle.odds
      .filter((o) => o.fixtureId === f.id)
      .map((o) => ({
        fixtureId: o.fixtureId,
        market: o.market,
        line: o.line,
        homeOdds: o.homeOdds,
        drawOdds: o.drawOdds,
        awayOdds: o.awayOdds,
        timestamp: o.timestamp,
        provider: o.provider,
      })),
    result: (() => {
      const r = normalized.bundle.results.find((res) => res.fixtureId === f.id);
      return r ? { fixtureId: r.fixtureId, homeGoals: r.homeGoals, awayGoals: r.awayGoals, status: r.status } : undefined;
    })(),
  }));

  const data = { teams, competitions, seasons, matches };
  const hash = crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  const manifest: DatasetManifest = {
    id: `dataset:${hash.substring(0, 12)}`,
    version: '1.0.0',
    name: `Import from ${provenance}`,
    hash,
    createdAt: new Date().toISOString(),
    recordCount: matches.length,
    fixtureCount: matches.length,
    competitions: competitions.map((c) => c.id),
    seasons: seasons.map((s) => s.id),
    provenance,
    schema: 'v1',
  };

  return { manifest, teams, competitions, seasons, matches };
}

export class ImportPipeline {
  private readonly deps: ImportPipelineDeps;

  constructor(deps?: Partial<ImportPipelineDeps>) {
    this.deps = {
      validator: deps?.validator ?? new DatasetValidator(),
      integrityEngine: deps?.integrityEngine ?? new IntegrityEngine(),
      manifestGenerator: deps?.manifestGenerator ?? new ManifestGenerator(),
      leakageDetector: deps?.leakageDetector ?? new LeakageDetector(),
      provenanceEngine: deps?.provenanceEngine ?? new ProvenanceEngine(),
      registry: deps?.registry ?? new DatasetRegistry(),
      versionStore: deps?.versionStore ?? new DatasetVersionStore(),
      ledger: deps?.ledger ?? new DatasetEvidenceLedger(),
      storage: deps?.storage ?? new InMemoryEvidenceStorage(),
    };
  }

  run(source: ImportSource): ImportResult {
    const stages: ImportStageLog[] = [];
    const errors: string[] = [];

    const timed = <T>(stage: ImportStage, fn: () => T): T => {
      const start = Date.now();
      try {
        const result = fn();
        stages.push({ stage, ok: true, message: `${stage} completed`, durationMs: Date.now() - start });
        return result;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        stages.push({ stage, ok: false, message, durationMs: Date.now() - start });
        throw e;
      }
    };

    const fail = (): ImportResult => ({
      ok: false,
      datasetId: null,
      dataset: null,
      manifest: null,
      integrityReport: null,
      leakageReport: null,
      provenance: null,
      registryEntry: null,
      evidenceArtifact: null,
      stages,
      errors,
    });

    try {
      // 1. Import
      const rawText = timed('import', () => {
        if (source.raw === undefined || source.raw === null) throw new Error('Import source has no raw payload');
        return source.raw;
      });

      // 2. Normalize
      const normalized = timed('normalize', () => {
        if (source.format === 'csv') {
          if (typeof rawText !== 'string') throw new Error('CSV import requires string raw payload');
          if (!source.csvColumnMap) throw new Error('CSV import requires csvColumnMap');
          const table = parseCsv(rawText);
          return normalizeCsv(table, source.csvColumnMap, source.leagueId, source.seasonId, source.provider);
        }
        // json + api
        return normalizeJson(rawText, source.leagueId, source.seasonId);
      });

      if (normalized.bundle.fixtures.length === 0) {
        errors.push('No fixtures produced by normalization');
        return fail();
      }

      // 3. Canonical Mapping
      const dataset = timed('canonical_mapping', () => assembleDataset(normalized, `${source.provider}:${source.sourcePath}`));

      // 4. Validation
      const validationReport = timed('validation', () => this.deps.validator.validate(dataset, dataset.teams, dataset.competitions));
      const validationSummary: ValidationSummary = {
        valid: validationReport.valid,
        totalFixtures: validationReport.totalFixtures,
        validFixtures: validationReport.validFixtures,
        invalidFixtures: validationReport.invalidFixtures,
        errorCount: validationReport.errors.length,
        warningCount: validationReport.warnings.length,
      };
      if (!validationReport.valid) {
        errors.push(`Validation failed with ${validationReport.errors.length} error(s)`);
      }

      // 5. Integrity
      const integrityReport = timed('integrity', () => this.deps.integrityEngine.verify(dataset));

      // Leakage detection (rejection gate)
      const leakageReport = this.deps.leakageDetector.detect(dataset);
      if (!leakageReport.passed) {
        errors.push(`Leakage detected: ${leakageReport.issues.filter((i) => i.severity === 'error').length} issue(s)`);
      }

      // Reject invalid datasets
      if (!validationReport.valid || !leakageReport.passed || integrityReport.errorCount > 0) {
        return {
          ok: false,
          datasetId: dataset.manifest.id,
          dataset,
          manifest: null,
          integrityReport,
          leakageReport,
          provenance: null,
          registryEntry: null,
          evidenceArtifact: null,
          stages,
          errors,
        };
      }

      // 6. Manifest
      const checksum = checksumOfSource(source.raw);
      const fingerprint = fingerprintDataset(dataset);
      const manifest = timed('manifest', () => this.deps.manifestGenerator.generate({
        dataset,
        checksum,
        provider: source.provider,
        competition: source.leagueId,
        season: source.seasonId,
      }));

      // Provenance
      const provenance = this.deps.provenanceEngine.create({
        provider: source.provider,
        version: '1.0.0',
        source: source.sourcePath,
        downloadDate: source.producedAt,
        checksum,
        fingerprint,
      });

      // 7. Registry
      const registryEntry = timed('registry', () => this.deps.registry.register({
        provider: source.provider,
        leagueId: source.leagueId,
        seasonId: source.seasonId,
        sourcePath: source.sourcePath,
        checksum,
        fingerprint,
        fileSize: typeof source.raw === 'string' ? Buffer.byteLength(source.raw, 'utf8') : Buffer.byteLength(JSON.stringify(source.raw), 'utf8'),
        rowCount: dataset.matches.length,
        integrityScore: integrityReport.score,
        createdAt: source.producedAt,
        status: 'validated',
      }));

      // Versioning (append-only)
      this.deps.versionStore.commit(`${source.leagueId}:${source.seasonId}`, dataset);

      // 8. Storage
      timed('storage', () => this.deps.storage.save(registryEntry.id, dataset));

      // Evidence artifact
      const evidenceArtifact = this.deps.ledger.append({
        datasetId: registryEntry.id,
        checksum,
        fingerprint,
        integrityScore: integrityReport.score,
        validationResult: validationSummary,
      });

      // 9. Ready
      timed('ready', () => true);

      return {
        ok: true,
        datasetId: registryEntry.id,
        dataset,
        manifest,
        integrityReport,
        leakageReport,
        provenance,
        registryEntry,
        evidenceArtifact,
        stages,
        errors,
      };
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
      return fail();
    }
  }
}

export const defaultImportPipeline = new ImportPipeline();
