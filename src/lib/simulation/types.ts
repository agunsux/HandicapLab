/**
 * Module 6: Decision Research & Simulation Platform — Contracts
 * 
 * RULES:
 * - Production is read-only.
 * - Simulation cannot mutate historical decisions.
 * - All experiments are reproducible and deterministic.
 */

// ─── Executors & Modes ─────────────────────────────────────────────────────────

export type ExecutionMode = 'FULL_REPLAY' | 'PROXY';

export type EvidenceLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5';

export interface ExecutorOptions {
  batchSize: number;
  mode: ExecutionMode;
}

// ─── Counterfactual & Experiments ──────────────────────────────────────────────

export interface CounterfactualConfig {
  thresholdAdjustments?: { [policyName: string]: number };
  driverToggles?: { [driverName: string]: boolean };
  calibrationReplacement?: string;
  decisionGatePolicy?: string;
  confidenceAdjustment?: number;
}

export type ExperimentStatus = 'DRAFT' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'ARCHIVED';

export interface Experiment {
  id: string;
  name: string;
  status: ExperimentStatus;
  
  configuration: CounterfactualConfig;
  datasetQuery: string;
  
  executionMode: ExecutionMode;
  evidenceLevel: EvidenceLevel;
  
  baselineMetrics?: SimulationMetrics;
  candidateMetrics?: SimulationMetrics;
  
  createdAt: Date;
  completedAt?: Date;
}

// ─── Metrics & Display ─────────────────────────────────────────────────────────

export interface SimulationMetrics {
  yield: number;
  hitRate: number;
  coverage: number; 
  decisionQuality: number;
  correctSkips: number;
  missedOpportunities: number;
  expectedUtility: number;
  calibration: number;
  confidenceDrift: number;
}

export interface MetricDelta {
  metric: string;
  baseline: number;
  candidate: number;
  diff: number;
  isPositive: boolean;
  formattedDiff: string; // e.g. "+1.9%"
}

export interface ExperimentCard {
  experimentId: string;
  name: string;
  evidenceLevel: EvidenceLevel;
  executionMode: ExecutionMode;
  deltas: MetricDelta[];
  promotionScore: number;
  promotionReady: boolean;
}

// ─── Promotion & Governance ────────────────────────────────────────────────────

export interface PromotionScoreDetails {
  utilityImprovementScore: number;
  calibrationStabilityScore: number;
  coverageScore: number;
  healthImpactScore: number;
  driverStabilityScore: number;
  decisionQualityScore: number;
  evidenceLevelMultiplier: number;
}

export type PromotionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface PromotionCandidate {
  id: string;
  experimentId: string;
  status: PromotionStatus;
  
  compositeScore: number; // 0-100 Promotion Score
  scoreDetails: PromotionScoreDetails;
  readinessLabel: 'READY' | 'MORE VALIDATION REQUIRED' | 'NOT READY';
  
  sampleSize: number;
  isStatisticallySignificant: boolean;
  
  createdAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
}

// ─── Decision DNA & Driver Sensitivity ─────────────────────────────────────────

export type ClusterLabel = 'High-performing' | 'Failing' | 'Emerging' | 'Stable';

export interface DecisionDNACluster {
  dnaFingerprint: string;
  label: ClusterLabel;
  historicalYield: number;
  frequency: number;
}

export interface DriverSensitivityProfile {
  driverName: string;
  importance: number;
  reliability: number;
  stability: number;
  dependency: string[];
  interactionImpact: number;
}
