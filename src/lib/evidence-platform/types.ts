/**
 * HandicapLab — Historical Evidence Platform (Phase 4)
 * =====================================================
 * Shared, strongly-typed contracts for the Historical Evidence Platform.
 *
 * This platform is the single source of truth for every replay, experiment,
 * benchmark, calibration study, feature study, and shadow-mode execution.
 *
 * Design rules (see ARCHITECTURE_INVARIANTS.md):
 *   - No `any` types.
 *   - Records are immutable after finalization (Object.freeze).
 *   - Historical artifacts are append-only.
 *   - Every dataset is reproducible from its provenance + fingerprint.
 *
 * These types intentionally live in their own module so that lower layers
 * (dataset, replay) never depend on the platform. The platform depends
 * downward on the canonical dataset schema only.
 */

import type { CanonicalDataset } from '../dataset/types';

// ─── Architecture Constants ──────────────────────────────────────────────

/** Current frozen architecture version stamped onto evidence artifacts. */
export const ARCHITECTURE_VERSION = '3.0.0' as const;

/** Schema version for datasets ingested by this platform. */
export const EVIDENCE_SCHEMA_VERSION = 'v1' as const;

/** Version of the validation ruleset used across integrity + leakage checks. */
export const VALIDATION_VERSION = '1.0.0' as const;

// ─── Sprint A1 — Season Registry ─────────────────────────────────────────

/** Data provider availability window for a given season. */
export interface ProviderAvailability {
  readonly provider: string;
  readonly available: boolean;
  /** ISO 8601 date the provider begins covering the season (optional). */
  readonly coverageFrom?: string;
  /** ISO 8601 date the provider stops covering the season (optional). */
  readonly coverageTo?: string;
}

/** A supported league with canonical identity and competition aliases. */
export interface SupportedLeague {
  readonly canonicalId: string; // e.g. "comp:epl"
  readonly name: string;
  readonly shortName: string;
  readonly country: string;
  readonly tier: number;
  readonly timezone: string;
  readonly aliases: readonly string[];
  readonly active: boolean;
  /** True when the league features promotion/relegation between seasons. */
  readonly promotionRelegation: boolean;
}

/** Metadata describing a single supported season within a league. */
export interface SeasonMetadata {
  readonly id: string; // canonical season id, e.g. "season:epl:2024-2025"
  readonly leagueId: string; // references SupportedLeague.canonicalId
  readonly name: string; // e.g. "2024-2025"
  readonly startYear: number;
  readonly endYear: number;
  readonly startDate: string; // ISO 8601
  readonly endDate: string; // ISO 8601
  readonly active: boolean;
  readonly providers: readonly ProviderAvailability[];
  /** Canonical team ids promoted into the league this season. */
  readonly promotedTeams: readonly string[];
  /** Canonical team ids relegated out of the league this season. */
  readonly relegatedTeams: readonly string[];
}

/** Query filter for season lookups. */
export interface SeasonQuery {
  readonly leagueId?: string;
  readonly activeOnly?: boolean;
  readonly provider?: string;
  readonly minStartYear?: number;
  readonly maxEndYear?: number;
}

// ─── Sprint A2 — Historical Dataset Registry ─────────────────────────────

export type DatasetRegistryStatus = 'imported' | 'validated' | 'archived' | 'rejected';

/** Permanent registry record for an imported historical dataset. */
export interface DatasetRegistryEntry {
  readonly id: string; // permanent identifier, e.g. "ds_000001"
  readonly provider: string;
  readonly leagueId: string;
  readonly seasonId: string;
  readonly sourcePath: string;
  readonly checksum: string; // sha256 of source bytes
  readonly fingerprint: string; // sha256 of canonical data
  readonly fileSize: number; // bytes
  readonly createdAt: string; // ISO 8601 — when the source was produced
  readonly importedAt: string; // ISO 8601 — when it entered the registry
  readonly schemaVersion: string;
  readonly rowCount: number;
  readonly integrityScore: number; // 0–100
  readonly version: string; // semver, immutable per entry
  readonly status: DatasetRegistryStatus;
}

export interface DatasetRegistryQuery {
  readonly provider?: string;
  readonly leagueId?: string;
  readonly seasonId?: string;
  readonly status?: DatasetRegistryStatus;
  readonly minIntegrityScore?: number;
}

// ─── Sprint A3 — Dataset Manifest ────────────────────────────────────────

export interface ValidationSummary {
  readonly valid: boolean;
  readonly totalFixtures: number;
  readonly validFixtures: number;
  readonly invalidFixtures: number;
  readonly errorCount: number;
  readonly warningCount: number;
}

/** Exportable manifest describing a dataset's shape and quality. */
export interface EvidenceDatasetManifest {
  readonly datasetId: string;
  readonly fingerprint: string;
  readonly checksum: string;
  readonly version: string;
  readonly provider: string;
  readonly competition: string;
  readonly season: string;
  readonly importTimestamp: string; // ISO 8601
  readonly rowCount: number;
  readonly missingFields: readonly string[];
  readonly duplicateRows: number;
  readonly invalidRows: number;
  readonly validationSummary: ValidationSummary;
  readonly schemaVersion: string;
}

// ─── Sprint A4 — Data Integrity Engine ───────────────────────────────────

export type IntegritySeverity = 'error' | 'warning';

export type IntegrityCheck =
  | 'duplicate_fixtures'
  | 'missing_ids'
  | 'missing_kickoff'
  | 'invalid_scores'
  | 'invalid_odds'
  | 'negative_odds'
  | 'timezone_consistency'
  | 'chronological_ordering'
  | 'duplicate_matches'
  | 'missing_teams'
  | 'missing_competitions'
  | 'missing_bookmakers';

export interface IntegrityIssue {
  readonly check: IntegrityCheck;
  readonly severity: IntegritySeverity;
  readonly fixtureId: string | null;
  readonly message: string;
}

export interface IntegrityReport {
  readonly datasetId: string;
  readonly score: number; // 0–100
  readonly totalChecks: number;
  readonly passedChecks: number;
  readonly issues: readonly IntegrityIssue[];
  readonly errorCount: number;
  readonly warningCount: number;
  readonly checkedAt: string; // ISO 8601
  readonly validationVersion: string;
}

// ─── Sprint A5 — Coverage Analyzer ───────────────────────────────────────

export interface CoverageMetric {
  readonly total: number;
  readonly present: number;
  readonly pct: number; // 0–100
}

export interface LeagueCoverageSummary {
  readonly leagueId: string;
  readonly seasonId: string;
  readonly fixtures: CoverageMetric;
  readonly odds: CoverageMetric;
  readonly closingOdds: CoverageMetric;
  readonly asianHandicap: CoverageMetric;
  readonly overUnder: CoverageMetric;
  readonly moneyline: CoverageMetric;
  readonly xg: CoverageMetric;
  readonly lineups: CoverageMetric;
  readonly injuries: CoverageMetric;
  readonly weather: CoverageMetric;
  readonly overallPct: number; // 0–100
}

export interface CoverageReport {
  readonly datasetId: string;
  readonly generatedAt: string;
  readonly leagues: readonly LeagueCoverageSummary[];
  readonly overallPct: number;
}

/**
 * Optional side-channel data used to compute enriched coverage
 * (xG, lineups, injuries, weather) that is not part of the frozen
 * canonical schema. Absence simply reports 0% for that dimension.
 */
export interface EnrichmentCoverageInput {
  readonly fixturesWithXg?: readonly string[];
  readonly fixturesWithLineups?: readonly string[];
  readonly fixturesWithInjuries?: readonly string[];
  readonly fixturesWithWeather?: readonly string[];
}

// ─── Sprint A6 — Leakage Detection ───────────────────────────────────────

export type LeakageCheck =
  | 'future_data'
  | 'post_match_field'
  | 'closing_odds'
  | 'result_leakage'
  | 'feature_timestamp';

export interface LeakageIssue {
  readonly check: LeakageCheck;
  readonly fixtureId: string;
  readonly field: string;
  readonly message: string;
  readonly severity: IntegritySeverity;
}

export interface LeakageReport {
  readonly datasetId: string;
  readonly passed: boolean;
  readonly issues: readonly LeakageIssue[];
  readonly checkedAt: string;
  readonly validationVersion: string;
}

/**
 * Optional feature timestamp table for feature-timestamp leakage validation.
 * Maps fixtureId → list of (feature name, timestamp) built for that fixture.
 */
export interface FeatureTimestampInput {
  readonly fixtureId: string;
  readonly feature: string;
  readonly timestamp: string; // ISO 8601 — when the feature value was known
}

// ─── Sprint A7 — Provenance Engine ───────────────────────────────────────

/** Immutable provenance record that travels with every dataset. */
export interface DatasetProvenance {
  readonly provider: string;
  readonly version: string;
  readonly source: string;
  readonly downloadDate: string; // ISO 8601
  readonly importDate: string; // ISO 8601
  readonly checksum: string;
  readonly fingerprint: string;
  readonly schemaVersion: string;
  readonly validationVersion: string;
}

// ─── Sprint A8 — Dataset Versioning ──────────────────────────────────────

export interface DatasetVersionRecord {
  readonly key: string; // logical dataset key, e.g. "epl:2024-2025"
  readonly version: string; // v1, v2, v3 ...
  readonly datasetId: string;
  readonly fingerprint: string;
  readonly createdAt: string;
  readonly dataset: CanonicalDataset;
}

// ─── Sprint A9 — Dataset Diff Engine ─────────────────────────────────────

export interface OddsChange {
  readonly fixtureId: string;
  readonly market: string;
  readonly field: string;
  readonly before: number | null;
  readonly after: number | null;
}

export interface TimestampChange {
  readonly fixtureId: string;
  readonly field: string;
  readonly before: string;
  readonly after: string;
}

export interface MetadataChange {
  readonly field: string;
  readonly before: string;
  readonly after: string;
}

export interface DatasetDiff {
  readonly fromDatasetId: string;
  readonly toDatasetId: string;
  readonly addedFixtures: readonly string[];
  readonly removedFixtures: readonly string[];
  readonly changedOdds: readonly OddsChange[];
  readonly changedTimestamps: readonly TimestampChange[];
  readonly changedMetadata: readonly MetadataChange[];
  readonly identical: boolean;
}

// ─── Sprint A10 — Historical Import Pipeline ─────────────────────────────

export type ImportFormat = 'csv' | 'json' | 'api';

export type ImportStage =
  | 'import'
  | 'normalize'
  | 'canonical_mapping'
  | 'validation'
  | 'integrity'
  | 'manifest'
  | 'registry'
  | 'storage'
  | 'ready';

export interface ImportStageLog {
  readonly stage: ImportStage;
  readonly ok: boolean;
  readonly message: string;
  readonly durationMs: number;
}

/** Normalized (pre-canonical) records produced by the normalize stage. */
export interface NormalizedFixture {
  readonly id: string;
  readonly competitionId: string;
  readonly seasonId: string;
  readonly homeTeamId: string;
  readonly awayTeamId: string;
  readonly kickoff: string;
  readonly status: 'scheduled' | 'finished' | 'postponed' | 'cancelled';
  readonly round?: string;
}

export interface NormalizedOdds {
  readonly fixtureId: string;
  readonly market: 'ML' | 'AH' | 'OU' | 'BTTS';
  readonly homeOdds: number;
  readonly drawOdds: number | null;
  readonly awayOdds: number;
  readonly timestamp: string;
  readonly line?: number;
  readonly provider?: string;
}

export interface NormalizedResult {
  readonly fixtureId: string;
  readonly homeGoals: number;
  readonly awayGoals: number;
  readonly status: 'finished' | 'postponed' | 'cancelled';
}

export interface NormalizedBundle {
  readonly fixtures: readonly NormalizedFixture[];
  readonly odds: readonly NormalizedOdds[];
  readonly results: readonly NormalizedResult[];
}

export interface ImportSource {
  readonly format: ImportFormat;
  readonly provider: string;
  readonly leagueId: string;
  readonly seasonId: string;
  readonly sourcePath: string;
  /** Raw payload: CSV text for csv, or a JSON object for json/api. */
  readonly raw: string | unknown;
  /** Column mapping for CSV parsing. */
  readonly csvColumnMap?: CsvColumnMap;
  /** ISO 8601 timestamp the source data was produced / downloaded. */
  readonly producedAt?: string;
}

export interface CsvColumnMap {
  readonly fixtureId?: string;
  readonly homeTeam: string;
  readonly awayTeam: string;
  readonly kickoff: string;
  readonly homeGoals?: string;
  readonly awayGoals?: string;
  readonly homeOdds?: string;
  readonly drawOdds?: string;
  readonly awayOdds?: string;
}

export interface ImportResult {
  readonly ok: boolean;
  readonly datasetId: string | null;
  readonly dataset: CanonicalDataset | null;
  readonly manifest: EvidenceDatasetManifest | null;
  readonly integrityReport: IntegrityReport | null;
  readonly leakageReport: LeakageReport | null;
  readonly provenance: DatasetProvenance | null;
  readonly registryEntry: DatasetRegistryEntry | null;
  readonly evidenceArtifact: EvidenceArtifact | null;
  readonly stages: readonly ImportStageLog[];
  readonly errors: readonly string[];
}

// ─── Sprint A11 — Evidence Ledger Integration ────────────────────────────

/** An imported dataset promoted to a permanent, auditable evidence record. */
export interface EvidenceArtifact {
  readonly artifactId: string;
  readonly datasetId: string;
  readonly checksum: string;
  readonly fingerprint: string;
  readonly integrityScore: number;
  readonly validationResult: ValidationSummary;
  readonly timestamp: string;
  readonly commitHash: string;
  readonly architectureVersion: string;
}
