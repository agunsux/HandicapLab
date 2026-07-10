/**
 * HandicapLab — Historical Evidence Platform (Phase 4)
 * =====================================================
 * Single source of truth for every replay, experiment, benchmark,
 * calibration study, feature study, and shadow-mode execution.
 *
 * Public surface:
 *   - Types              → all platform contracts
 *   - SeasonRegistry      → supported leagues/seasons (A1)
 *   - DatasetRegistry     → permanent dataset identity (A2)
 *   - ManifestGenerator   → exportable manifests (A3)
 *   - IntegrityEngine     → integrity verification + score (A4)
 *   - CoverageAnalyzer    → league coverage metrics (A5)
 *   - LeakageDetector     → historical leakage detection (A6)
 *   - ProvenanceEngine    → immutable provenance records (A7)
 *   - DatasetVersionStore → immutable dataset versions (A8)
 *   - DiffEngine          → machine-readable dataset diffs (A9)
 *   - ImportPipeline      → CSV/JSON/API ingestion (A10)
 *   - DatasetEvidenceLedger → evidence artifacts (A11)
 *   - reporting           → markdown/json/csv reports (A12)
 */

// ─── Constants & Types ──────────────────────────────────────────────────
export {
  ARCHITECTURE_VERSION,
  EVIDENCE_SCHEMA_VERSION,
  VALIDATION_VERSION,
} from './types';

export type {
  ProviderAvailability,
  SupportedLeague,
  SeasonMetadata,
  SeasonQuery,
  DatasetRegistryStatus,
  DatasetRegistryEntry,
  DatasetRegistryQuery,
  ValidationSummary,
  EvidenceDatasetManifest,
  IntegritySeverity,
  IntegrityCheck,
  IntegrityIssue,
  IntegrityReport,
  CoverageMetric,
  LeagueCoverageSummary,
  CoverageReport,
  EnrichmentCoverageInput,
  LeakageCheck,
  LeakageIssue,
  LeakageReport,
  FeatureTimestampInput,
  DatasetProvenance,
  DatasetVersionRecord,
  OddsChange,
  TimestampChange,
  MetadataChange,
  DatasetDiff,
  ImportFormat,
  ImportStage,
  ImportStageLog,
  NormalizedFixture,
  NormalizedOdds,
  NormalizedResult,
  NormalizedBundle,
  ImportSource,
  CsvColumnMap,
  ImportResult,
  EvidenceArtifact,
} from './types';

// ─── A1 Season Registry ─────────────────────────────────────────────────
export { SeasonRegistry, defaultSeasonRegistry } from './seasonRegistry';

// ─── A2 Dataset Registry ────────────────────────────────────────────────
export { DatasetRegistry, defaultDatasetRegistry } from './datasetRegistry';
export type { RegisterDatasetInput } from './datasetRegistry';

// ─── A3 Manifest Generator ──────────────────────────────────────────────
export { ManifestGenerator, defaultManifestGenerator } from './manifestGenerator';
export type { ManifestInput } from './manifestGenerator';

// ─── A4 Integrity Engine ────────────────────────────────────────────────
export { IntegrityEngine, defaultIntegrityEngine } from './integrityEngine';

// ─── A5 Coverage Analyzer ───────────────────────────────────────────────
export { CoverageAnalyzer, defaultCoverageAnalyzer } from './coverageAnalyzer';

// ─── A6 Leakage Detector ────────────────────────────────────────────────
export { LeakageDetector, defaultLeakageDetector } from './leakageDetector';
export type { LeakageOptions } from './leakageDetector';

// ─── A7 Provenance Engine ───────────────────────────────────────────────
export { ProvenanceEngine, defaultProvenanceEngine } from './provenanceEngine';
export type { ProvenanceInput } from './provenanceEngine';

// ─── A8 Dataset Versioning ──────────────────────────────────────────────
export { DatasetVersionStore, defaultDatasetVersionStore } from './datasetVersionStore';

// ─── A9 Diff Engine ─────────────────────────────────────────────────────
export { DiffEngine, defaultDiffEngine } from './diffEngine';

// ─── A10 Import Pipeline ────────────────────────────────────────────────
export {
  ImportPipeline,
  defaultImportPipeline,
  InMemoryEvidenceStorage,
} from './importPipeline';
export type { EvidenceStorageAdapter, ImportPipelineDeps } from './importPipeline';
export {
  parseCsv,
  normalizeCsv,
  normalizeJson,
  slugify,
} from './parsers';
export type { NormalizeOutput, CsvTable } from './parsers';

// ─── A11 Evidence Ledger ────────────────────────────────────────────────
export { DatasetEvidenceLedger, defaultEvidenceLedger } from './evidenceLedger';
export type { EvidenceArtifactInput } from './evidenceLedger';

// ─── Hash utilities ─────────────────────────────────────────────────────
export { sha256, checksumOfSource, fingerprintDataset } from './hash';

// ─── A12 Reporting ──────────────────────────────────────────────────────
export * as reporting from './reporting';
