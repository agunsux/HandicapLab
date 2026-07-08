/**
 * Module 5: Decision Attribution & Causal Analysis Engine — Contracts
 *
 * This module is READ-ONLY with respect to Modules 1, 2, 3, and 4.
 * It strictly returns structured causal insights and historical driver performance.
 */

// ─── Versioning ───────────────────────────────────────────────────────────────

export const ATTRIBUTION_VERSION = 'v1.0' as const;
export const BUILDER_VERSION = '1.0.0' as const;

// ─── Core Contribution Types ──────────────────────────────────────────────────

export type ContributionType = 'FEATURE' | 'EVIDENCE' | 'UNCERTAINTY' | 'HEALTH' | 'RISK';
export type ContributionDirection = 'POSITIVE' | 'NEGATIVE';

export interface Contribution {
  /** Identifier of the driver/factor */
  name: string;
  /** Broad category of the driver */
  type: ContributionType;
  /** Raw internal weight or magnitude */
  weight: number;
  /** Positive (supports decision/confidence) or Negative (suppresses it) */
  direction: ContributionDirection;
  /** Normalized contribution (0-1) across its domain */
  normalizedContribution: number;
  /** Reliability of this attribution calculation (0-1) */
  confidence: number;
  /** Optional source string if derived from external/ensemble engine */
  evidenceSource?: string;
}

// ─── Interaction Registry ─────────────────────────────────────────────────────

export interface InteractionRule {
  id: string;
  name: string;
  participatingFactors: string[];
  interactionType: ContributionDirection;
  multiplier: number;
}

export interface InteractionEffect {
  ruleId: string;
  effectName: string;
  participatingFactors: string[];
  multiplier: number;
  impactDirection: ContributionDirection;
}

export interface CounteractingFactorGroup {
  groupName: string;
  positiveDrivers: string[];
  negativeDrivers: string[];
  netImpact: number;
  netDirection: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
}

// ─── Driver Intelligence (Registry) ───────────────────────────────────────────

export type DriverLifecycle = 'CANDIDATE' | 'EXPERIMENTAL' | 'VALIDATED' | 'STABLE' | 'DEPRECATED' | 'ARCHIVED';
export type DriverStatus = 'Excellent' | 'Strong' | 'Stable' | 'Watch' | 'Weak' | 'Review';

export interface DriverStatistic {
  id: string;
  name: string;
  category: string;
  lifecycle: DriverLifecycle;
  
  /** How many decisions this driver participated in */
  frequency: number;
  /** Average normalized contribution when active */
  avgImpact: number;
  /** % of time this driver correctly aligned with outcome */
  historicalAccuracy: number;
  /** General utility score (e.g. EV generated) */
  historicalUtility: number;
  
  /** Consistency of the driver's contribution over time (0-100) */
  stability: number;
  /** Overall trustworthiness score (0-100) */
  reliabilityScore: number;
  
  drift: number;
  owner: string;
  status: DriverStatus;
  
  createdAt: Date;
  promotedAt?: Date;
  deprecatedAt?: Date;
  lastEvaluatedAt: Date;
}

export interface DriverSummary {
  name: string;
  magnitude: number;
  reliabilityScore: number;
}

// ─── Decision DNA ─────────────────────────────────────────────────────────────

export interface DecisionDNA {
  /** Unique hash representing the structural pattern of this decision */
  fingerprint: string;
  /** Driver name mapped to its normalized contribution percentage */
  topDrivers: Record<string, number>;
  /** Key blocking flags or risks */
  topRisks: string[];
  /** Triggered interaction rule IDs */
  interactions: string[];
  confidence: number;
  /** Populated post-settlement */
  outcome?: string;
}

// ─── Post-Settlement Outcome ──────────────────────────────────────────────────

export interface OutcomeContribution {
  driverName: string;
  predictedDirection: ContributionDirection;
  actualOutcomeAlignment: 'CORRECT' | 'INCORRECT' | 'NOISE';
  valueDelivered: number;
}

// ─── Causal Graph ─────────────────────────────────────────────────────────────

export type NodeType = 'DECISION' | 'CONFIDENCE' | 'EVIDENCE' | 'FEATURE' | 'OUTCOME' | 'UNCERTAINTY' | 'RISK';
export type EdgeRelation = 'INCREASES' | 'DECREASES' | 'BLOCKS' | 'CAUSES';

export interface CausalNode {
  id: string;
  type: NodeType;
  label: string;
  value: number;
}

export interface CausalEdge {
  from: string;
  to: string;
  weight: number;
  relation: EdgeRelation;
}

export interface CausalGraph {
  nodes: CausalNode[];
  edges: CausalEdge[];
}

// ─── Attribution Object ───────────────────────────────────────────────────────

export type AttributionPhase = 'DECISION_TIME' | 'POST_SETTLEMENT';

export interface AttributionObject {
  decisionId: string;
  decisionVersion: string;
  attributionVersion: string;
  builderVersion: string;
  generatedAt: Date;
  
  phase: AttributionPhase;

  overallContribution: number;

  // ── Dimensional Attribution ──
  decisionContribution: Contribution[];
  confidenceContribution: Contribution[];
  uncertaintyContribution: Contribution[];
  riskContribution: Contribution[];
  
  // ── Post-Settlement (Added asynchronously later) ──
  outcomeContribution?: OutcomeContribution[];

  // ── Dominant Drivers & Suppressors ──
  dominantDrivers: DriverSummary[];
  dominantSuppressors: DriverSummary[];

  // ── Complex Dynamics ──
  interactionEffects: InteractionEffect[];
  counteractingFactors: CounteractingFactorGroup[];

  // ── Deterministic Graph & DNA ──
  causalGraph: CausalGraph;
  decisionDNA: DecisionDNA;
  
  qualityScore: number;
}

// ─── Attribution Engine Input ─────────────────────────────────────────────────

export interface AttributionInput {
  decisionId: string;
  decisionObject: import('../decision/DecisionObject').DecisionObject;
  explanationObject: import('../explainability/types').ExplanationObject;
  probabilityObject?: import('../probability/ProbabilityObject').ProbabilityObject;
  healthScore?: import('../monitoring/types').HealthScoreBreakdown;
}

// ─── Module 3 Integration — Attribution Metrics ───────────────────────────────

export interface AttributionMetrics {
  avgAttributionQuality: number;
  attributionStability: number;
  driverDrift: number;
  driverReliability: number;
}
