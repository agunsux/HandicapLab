/**
 * Module 3: Model Health Monitor — Shared Type Contracts
 *
 * All interfaces used across the monitoring pipeline live here.
 * No implementation logic. Pure contracts.
 *
 * NOTE: HealthStatus and HealthScoreBreakdown are imported from
 * health-score-types.ts to break a circular dependency chain:
 *   monitoring/types.ts ↔ attribution/types.ts
 *   monitoring/types.ts ↔ explainability/types.ts
 * Those two modules import HealthScoreBreakdown from the shared file.
 * For ExplanationMetrics and AttributionMetrics, we use generic
 * Record fields since importing their types would re-introduce the cycle.
 * Callers must cast at usage sites.
 */

import type { HealthStatus, HealthScoreBreakdown } from './health-score-types';

// ─── Real-time Metrics ───────────────────────────────────────────────────────

export interface RealtimeMetricsSnapshot {
  requestCount: number;
  avgLatencyMs: number;
  decisionDistribution: Record<'BET' | 'NO_BET' | 'INCONCLUSIVE' | 'WAIT', number>;
  avgConfidence: number;
  avgUncertaintyEpistemic: number;
  avgUncertaintyAleatoric: number;
  decisionGatePassRate: number;   // % of inferences that resulted in BET
  skipRate: number;               // % of inferences that were NO_BET or INCONCLUSIVE
  windowStartedAt: Date;
}

// ─── Health Snapshot (Hourly) ────────────────────────────────────────────────

export interface HealthSnapshot {
  id?: string;
  timestamp: Date;
  modelVersion: string;
  brierScore: number;
  ece: number;                    // Expected Calibration Error
  winRate: number;
  avgClv: number | null;
  decisionAccuracy: number;
  missedOpportunityRate: number;
  correctSkipRate: number;
  avgConfidence: number;
  dataQualityScore: number;
  decisionGatePassRate: number;
  skipRate: number;
  healthScore: number;            // Aggregate 0-100 score
  healthStatus: HealthStatus;
  explanationMetrics?: Record<string, unknown>;
  attributionMetrics?: Record<string, unknown>;
}

// ─── Health Score ─────────────────────────────────────────────────────────────
// NOTE: HealthStatus and HealthScoreBreakdown are now in ./health-score-types.ts
// to break circular dependency with attribution and explainability.
// These types are re-exported here for backward compatibility.
export type { HealthStatus, HealthScoreBreakdown } from './health-score-types';

// ─── Golden Baseline ──────────────────────────────────────────────────────────

export interface GoldenBaseline {
  id?: string;
  version: string;                // e.g. "v1", "v2"
  league?: string;
  season?: string;
  approvedAt: Date;
  approvedBy?: string;
  modelVersion: string;
  calibrationMethod: string;
  snapshot: HealthSnapshot;
  notes?: string;
}

// ─── Drift ───────────────────────────────────────────────────────────────────

export type DriftSeverity = 'ok' | 'warning' | 'critical';

export interface DriftMetricDetail {
  metric: string;
  baseline: number;
  current: number;
  delta: number;
  pctChange: number;
  severity: DriftSeverity;
}

export interface DriftReport {
  operationalDrift: {          // vs last 24h / 7d
    isDrifted: boolean;
    details: DriftMetricDetail[];
    severity: DriftSeverity;
  };
  structuralDrift: {           // vs Golden Baseline
    isDrifted: boolean;
    baselineVersion: string;
    details: DriftMetricDetail[];
    severity: DriftSeverity;
  };
  overallSeverity: DriftSeverity;
}

// ─── Health Event ─────────────────────────────────────────────────────────────

export type HealthEventType =
  | 'CALIBRATION_DRIFT'
  | 'CONFIDENCE_RECOVERED'
  | 'DECISION_GATE_SPIKE'
  | 'DATA_QUALITY_DEGRADED'
  | 'BASELINE_COMPARISON_FAILED'
  | 'HEALTH_SCORE_DROPPED'
  | 'HEALTH_SCORE_RECOVERED'
  | 'ALERT_DISPATCHED'
  | 'SNAPSHOT_WRITTEN'
  | 'DEEP_ANALYSIS_COMPLETE'
  | 'GOLDEN_BASELINE_APPROVED';

export interface HealthEvent {
  id?: string;
  eventType: HealthEventType;
  severity: 'info' | 'warning' | 'critical';
  timestamp: Date;
  modelVersion: string;
  message: string;
  metadata?: Record<string, unknown>;
}

// ─── Recommendation ──────────────────────────────────────────────────────────

export interface Recommendation {
  level: 1 | 2 | 3;
  message: string;
  action?: string;            // L2: specific action
  calibratorCandidates?: CalibrationCandidate[]; // L3: from CalibrationRegistry
}

export interface CalibrationCandidate {
  method: string;
  version: string;
  historicalEce: number;
  promotedAt?: Date;
  expectedImprovement?: number;
}

// ─── Model Health Report (Daily) ─────────────────────────────────────────────

export interface ModelHealthReport {
  status: HealthStatus;
  healthScore: HealthScoreBreakdown;
  snapshot: HealthSnapshot;
  drift: DriftReport;
  recommendations: Recommendation[];
  events: HealthEvent[];
  deepAnalysis?: DeepAnalysisReport;
  generatedAt: Date;
}

// ─── Daily Deep Analysis ─────────────────────────────────────────────────────

export interface DeepAnalysisReport {
  psiScore: number;           // Population Stability Index
  klDivergence: number;       // KL Divergence from baseline distribution
  featureDrift: Record<string, number>;
  calibrationDrift: number;
  decisionDrift: number;
  falsePositiveTrend: 'improving' | 'stable' | 'degrading';
  falseNegativeTrend: 'improving' | 'stable' | 'degrading';
  rootCauseHints: string[];
  analysisDate: Date;
}
