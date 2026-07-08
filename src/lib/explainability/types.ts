/**
 * Module 4: Decision Explainability Engine — Shared Type Contracts
 *
 * All interfaces used across the explainability pipeline.
 * No implementation logic. Pure contracts.
 */

// ─── Versioning ───────────────────────────────────────────────────────────────

export const EXPLANATION_VERSION = 'v1.0' as const;
export const BUILDER_VERSION = '1.0.0' as const;
export const DECISION_SCHEMA_VERSION = 'v1' as const; // Matches DecisionObject.decision_version

// ─── Core Factor Types ────────────────────────────────────────────────────────

export interface Factor {
  /** Identifier, e.g. "calibration_quality", "data_quality" */
  name: string;
  /** Human-readable description of what this factor means */
  description: string;
  /** Whether this factor supported or opposed the decision */
  direction: 'POSITIVE' | 'NEGATIVE';
  /** Normalized contribution magnitude (0-1) */
  magnitude: number;
}

export interface Signal {
  /** Origin of the signal, e.g. "Calibration", "EvidenceAgreement" */
  source: string;
  /** Numeric value (context-dependent; e.g. 0.87 for agreement score) */
  value: number;
  /** Plain-language interpretation */
  interpretation: string;
}

export interface Risk {
  /** Blocking flag name from DecisionObject.blocking_flags */
  flag: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  /** Plain-language description of the risk */
  description: string;
}

// ─── Feature Contribution ─────────────────────────────────────────────────────

export type FeatureAttributionStatus = 'AVAILABLE' | 'PARTIAL' | 'UNAVAILABLE';
export type FeatureAttributionReason = 'NOT_COMPUTED' | 'NOT_SUPPORTED' | 'INSUFFICIENT_DATA' | 'MODEL_LIMITATION';

export interface FeatureContribution {
  /** Feature name from ProbabilityObject.feature_attribution */
  name: string;
  /** Normalized contribution (0-1) */
  contribution: number;
  /** Direction of influence on the final probability */
  direction: 'POSITIVE' | 'NEGATIVE';
  /**
   * Reliability of this attribution (0-1).
   */
  confidence: number;
}

export interface FeatureContributionSet {
  status: FeatureAttributionStatus;
  reason?: FeatureAttributionReason;
  factors: FeatureContribution[];
}

// ─── Evidence Agreement Summary ───────────────────────────────────────────────

export type AgreementLevel = 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW' | 'CONFLICTING';

export interface EvidenceAgreementSummary {
  agreementScore: number;           // 0-1
  agreementLevel: AgreementLevel;
  conflictingModules: string[];     // Names of engines that disagreed
  disagreementReason?: string;      // Human-readable explanation of conflict
  sourceCount: number;              // How many evidence sources were evaluated
  sources?: EvidenceSourceSummary[];
}

export interface EvidenceSourceSummary {
  engineName: string;               // e.g. "Model Engine", "Community Engine"
  signal: string;                   // e.g. "BET", "NO_BET", "UNKNOWN"
  confidence: number;               // 0-1
}

// ─── Explanation Object ───────────────────────────────────────────────────────

export interface ExplanationObject {
  // ── Identity & Versioning ──
  decisionId: string;
  explanationVersion: string;
  builderVersion: string;
  decisionSchemaVersion: string;
  generatedAt: Date;

  // ── Completeness ──
  completenessScore: number; // 0-100

  // ── Structured Data (Source of Truth) ──
  structured: {
    contributingFactors: Factor[];
    opposingFactors: Factor[];
    dominantSignals: Signal[];
    dominantRisks: Risk[];
    featureContributions: FeatureContributionSet;
    evidenceAgreement: EvidenceAgreementSummary;
  };

  // ── Narrative Render (For Humans) ──
  narrative: {
    summary: string;
    decisionReason: string;
    confidenceReason: string;
    uncertaintyReason: string;
    evidenceSummary: string;
    recommendationSummary: string;
  };
}

// ─── ExplanationBuilder Input ─────────────────────────────────────────────────

export interface ExplanationInput {
  decisionId: string;
  /**
   * The DecisionObject from Module 2.
   * Module 4 reads this but never modifies it.
   */
  decisionObject: import('../decision/DecisionObject').DecisionObject;

  /**
   * The ProbabilityObject from Module 1. Optional.
   * Used for feature_attribution. Falls back gracefully if absent.
   */
  probabilityObject?: import('../probability/ProbabilityObject').ProbabilityObject;

  /**
   * HealthScoreBreakdown from Module 3. Optional.
   * Used for contextual explanation of model health at decision time.
   */
  healthScore?: import('../monitoring/types').HealthScoreBreakdown;

  /**
   * Optional explicit list of evidence sources.
   * Populated from EvidenceAgreement (Module 2) when available.
   */
  evidenceSources?: EvidenceSourceSummary[];
}

// ─── ExplanationRegistry Entry ────────────────────────────────────────────────

export interface ExplanationRegistryEntry {
  id?: string;
  decisionId: string;
  explanationVersion: string;
  explanation: ExplanationObject;
  generatedAt: Date;
}

// ─── ExplanationFormatter Output ─────────────────────────────────────────────

export type ExplanationFormat = 'json' | 'text' | 'markdown';

// ─── Module 3 Integration — Explanation Metrics ───────────────────────────────

export interface ExplanationMetrics {
  avgGenerationLatencyMs: number;
  completenessRate: number;         // % of decisions that have completenessScore >= 80
  missingEvidenceRate: number;      // % of explanations where feature contributions are UNAVAILABLE
}
