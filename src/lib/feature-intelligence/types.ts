/**
 * HandicapLab — Feature Intelligence Platform (EPIC 19)
 * =======================================================
 * Strongly-typed contracts for feature registry, lineage, importance,
 * ablation, stability, redundancy, drift, explainability, governance,
 * quality engine, reporting, and artifact integration.
 */

export const FEATURE_INTELLIGENCE_VERSION = '1.0.0' as const;

export const FI_ID_PREFIX = {
  FEATURE: 'fifeat',
  LINEAGE: 'filin',
  IMPORTANCE: 'fiimp',
  ABLATION: 'fiabl',
  STABILITY: 'fistab',
  REDUNDANCY: 'fired',
  DRIFT: 'fidrift',
  GOVERNANCE: 'figov',
  QUALITY: 'fiqual',
  REPORT: 'firep',
  ARTIFACT: 'fiart',
} as const;

// ─── EPIC 19.1 — Feature Registry ───────────────────────────────────────

export type FeatureCategory = 'team' | 'match' | 'market' | 'historical' | 'derived' | 'external';

export interface FeatureDescriptor {
  readonly featureId: string;
  readonly version: string;
  readonly category: FeatureCategory;
  readonly owner: string;
  readonly description: string;
  readonly inputDependencies: readonly string[];
  readonly outputType: 'numeric' | 'categorical' | 'boolean' | 'vector';
  readonly supportedMarkets: readonly string[];
  readonly supportedCompetitions: readonly string[];
  readonly computationalCost: 'low' | 'medium' | 'high';
  readonly refreshFrequency: string;
  readonly deterministic: boolean;
  readonly provenance: string;
}

export interface FeatureRegistrationInput {
  featureId: string;
  version?: string;
  category: FeatureCategory;
  owner: string;
  description: string;
  inputDependencies?: readonly string[];
  outputType: 'numeric' | 'categorical' | 'boolean' | 'vector';
  supportedMarkets?: readonly string[];
  supportedCompetitions?: readonly string[];
  computationalCost?: 'low' | 'medium' | 'high';
  refreshFrequency?: string;
  deterministic?: boolean;
  provenance?: string;
}

// ─── EPIC 19.2 — Feature Lineage ─────────────────────────────────────────

export type LineageNodeType = 'feature' | 'raw_source' | 'transformation' | 'normalization' | 'aggregation' | 'prediction' | 'decision' | 'research_report' | 'champion_model';

export interface LineageNode {
  readonly id: string;
  readonly type: LineageNodeType;
  readonly label: string;
  readonly timestamp: string;
  readonly metadata: Record<string, string>;
}

export interface LineageEdge {
  readonly from: string;
  readonly to: string;
  readonly label: string;
}

export interface FeatureLineageGraph {
  readonly lineageId: string;
  readonly nodes: readonly LineageNode[];
  readonly edges: readonly LineageEdge[];
  readonly generatedAt: string;
}

// ─── EPIC 19.3 — Feature Importance ──────────────────────────────────────

export type ImportanceMethod = 'permutation' | 'leave_one_out' | 'drop_column' | 'gain' | 'split_count' | 'mutual_information' | 'correlation' | 'model_native';

export interface FeatureImportanceResult {
  readonly featureId: string;
  readonly method: ImportanceMethod;
  readonly score: number;
  readonly rank: number;
  readonly stdDev: number;
}

export interface ImportanceReport {
  readonly importanceId: string;
  readonly method: ImportanceMethod;
  readonly results: readonly FeatureImportanceResult[];
  readonly generatedAt: string;
}

// ─── EPIC 19.4 — Ablation Laboratory ─────────────────────────────────────

export type AblationStrategy = 'single_removal' | 'group_removal' | 'progressive' | 'recursive_elimination' | 'forward_selection' | 'backward_selection' | 'greedy';

export interface AblationResult {
  readonly removedFeatureId: string;
  readonly baselineMetric: number;
  readonly afterMetric: number;
  readonly delta: number;
  readonly deltaPct: number;
}

export interface AblationReport {
  readonly ablationId: string;
  readonly strategy: AblationStrategy;
  readonly results: readonly AblationResult[];
  readonly generatedAt: string;
}

// ─── EPIC 19.5 — Feature Stability ──────────────────────────────────────

export interface FeatureStabilityResult {
  readonly featureId: string;
  readonly stabilityScore: number;
  readonly degradationDetected: boolean;
  readonly segments: readonly { label: string; mean: number; std: number }[];
}

export interface StabilityReport {
  readonly stabilityId: string;
  readonly results: readonly FeatureStabilityResult[];
  readonly generatedAt: string;
}

// ─── EPIC 19.6 — Redundancy Detection ────────────────────────────────────

export interface CorrelationPair {
  readonly featureA: string;
  readonly featureB: string;
  readonly correlation: number;
  readonly type: 'positive' | 'negative';
}

export interface RedundancyReport {
  readonly redundancyId: string;
  readonly highCorrelationPairs: readonly CorrelationPair[];
  readonly multicollinearityDetected: boolean;
  readonly featureClusters: readonly string[][];
  readonly generatedAt: string;
}

// ─── EPIC 19.7 — Feature Drift ──────────────────────────────────────────

export interface FeatureDriftResult {
  readonly featureId: string;
  readonly psi: number;
  readonly ksStatistic: number;
  readonly klDivergence: number;
  readonly jsDistance: number;
  readonly earthMoverDistance: number;
  readonly driftDetected: boolean;
  readonly severity: 'none' | 'low' | 'medium' | 'high';
}

export interface FeatureDriftReport {
  readonly driftId: string;
  readonly baselineLabel: string;
  readonly currentLabel: string;
  readonly results: readonly FeatureDriftResult[];
  readonly overallDriftDetected: boolean;
  readonly generatedAt: string;
}

// ─── EPIC 19.8 — Feature Explainability ──────────────────────────────────

export interface PredictionFeatureContribution {
  readonly featureId: string;
  readonly contribution: number;
  readonly importance: number;
  readonly confidence: number;
  readonly quality: number;
  readonly freshness: string;
  readonly provenance: string;
  readonly active: boolean;
}

// ─── EPIC 19.9 — Feature Governance ──────────────────────────────────────

export type FeatureApprovalStatus = 'draft' | 'in_review' | 'validated' | 'production' | 'deprecated' | 'retired';

export interface GovernanceRecord {
  readonly featureId: string;
  readonly owner: string;
  readonly approvalStatus: FeatureApprovalStatus;
  readonly validationHistory: readonly string[];
  readonly researchStatus: string;
  readonly deprecationDate: string | null;
  readonly replacementFeatureId: string | null;
  readonly versionHistory: readonly string[];
}

// ─── EPIC 19.10 — Feature Quality Engine ─────────────────────────────────

export interface FeatureQualityResult {
  readonly featureId: string;
  readonly missingValuesPct: number;
  readonly constantValue: boolean;
  readonly variance: number;
  readonly entropy: number;
  readonly outlierPct: number;
  readonly coverage: number;
  readonly freshness: number;
  readonly cardinality: number;
  readonly distributionQuality: number;
  readonly overallQualityScore: number;
}

export interface QualityReport {
  readonly qualityId: string;
  readonly results: readonly FeatureQualityResult[];
  readonly generatedAt: string;
}

// ─── EPIC 19.11 — Reporting ──────────────────────────────────────────────

export interface FeatureReport {
  readonly reportId: string;
  readonly generatedAt: string;
  readonly type: 'catalog' | 'importance' | 'ablation' | 'drift' | 'redundancy' | 'governance' | 'quality';
  readonly summary: string;
  readonly data: unknown;
}

// ─── EPIC 19.12 — Artifact Integration ───────────────────────────────────

export interface FeatureArtifact {
  readonly artifactId: string;
  readonly datasetId: string;
  readonly experimentId: string;
  readonly modelVersion: string;
  readonly importanceReportId: string | null;
  readonly ablationReportId: string | null;
  readonly timestamp: string;
  readonly immutable: true;
}