/**
 * EPIC 31B — Production Replay & Shadow Validation
 * Core Types
 */

export type LeagueId = '39' | '40' | '135' | '140' | '78' | '61';
export type LeagueName = 'EPL' | 'La Liga' | 'Bundesliga' | 'Serie A' | 'Ligue 1' | 'Liga Portugal';
export type MarketType = 'ML' | 'AH' | 'OU';
export type ValidationStatus = 'PASS' | 'FAIL' | 'WARNING';
export type Epic32Decision = 'APPROVE EPIC 32' | 'BLOCK EPIC 32';
import type { ReplayMetrics } from '../replay/types';
export type { ReplayMetrics };
export interface LeagueConfig {
  leagueId: LeagueId;
  leagueName: LeagueName;
  country: string;
  season: string;
  dataPath: string;
  parquetPath: string;
  marketTypes: MarketType[];
}

export interface ReplayRun {
  runId: string;
  leagueId: LeagueId;
  leagueName: LeagueName;
  season: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  matchesReplayed: number;
  marketsReplayed: number;
  outcomes: ReplayOutcome[];
  metrics: ReplayMetrics;
  validationReport: ValidationReport;
  performanceProfile: PerformanceProfile;
  governanceAudit: GovernanceAudit;
}

export interface ReplayOutcome {
  fixtureId: string;
  marketType: MarketType;
  selection: string;
  predictedProbability: number;
  actualResult: number;
  profitLoss: number;
  brierScore: number;
  logLoss: number;
  clv: number;
  kellyStake: number;
  expectedValue: number;
  settledOutcome: string;
  settlementProfitUnits: number;
  homeGoals?: number;
  awayGoals?: number;
  leagueId?: LeagueId;
}



export interface ValidationReport {
  totalFixtures: number;
  validFixtures: number;
  invalidFixtures: number;
  missingOdds: number;
  missingResults: number;
  validationErrors: ValidationError[];
}

export interface ValidationError {
  fixtureId: string;
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface DeterminismProof {
  runId: string;
  runCount: number;
  identical: boolean;
  maxDiff: number;
  fieldsCompared: string[];
  timestamp: string;
}

export interface PerformanceProfile {
  totalDurationMs: number;
  avgMatchDurationMs: number;
  peakMemoryMB: number;
  totalCpuTimeMs: number;
  dbReadCount: number;
  bottlenecks: string[];
}

export interface GovernanceAudit {
  featureFlagsVerified: boolean;
  researchRegistryVerified: boolean;
  experimentRegistryVerified: boolean;
  modelRegistryVerified: boolean;
  artifactMetadataVerified: boolean;
  executionMetadataVerified: boolean;
  versionTraceabilityVerified: boolean;
  issues: string[];
}

export interface ConfidenceInterval {
  metric: string;
  observed: number;
  mean: number;
  stdErr: number;
  ciLower: number;
  ciUpper: number;
  confidenceLevel: number;
}

export interface LeagueValidationResult {
  leagueId: LeagueId;
  leagueName: LeagueName;
  status: ValidationStatus;
  evidence: string;
  metrics: ReplayMetrics;
  confidenceIntervals: ConfidenceInterval[];
  calibrationQuality: string;
  statisticalConfidence: string;
  driftDetected: boolean;
}

export interface Epic31BFinalReport {
  reportId: string;
  generatedAt: string;
  epic: 'EPIC 31B';
  title: string;
  replayCoverage: {
    matchesReplayed: number;
    marketsReplayed: number;
    leaguesCovered: LeagueName[];
    seasonsCovered: string[];
  };
  calibrationQuality: string;
  statisticalConfidence: string;
  mathematicalConsistency: string;
  performance: PerformanceProfile;
  researchReproducibility: boolean;
  productionReadiness: string;
  remainingRisks: string[];
  leagueResults: LeagueValidationResult[];
  validationSummaries: ValidationSummary[];
  decision: Epic32Decision;
  recommendation: string;
}

export interface ValidationSummary {
  phase: string;
  status: ValidationStatus;
  evidence: string;
  files: string[];
  metrics: Record<string, number>;
  confidence: string;
}

export interface ExperimentMetadata {
  experimentId: string;
  name: string;
  description: string;
  createdAt: string;
  datasetVersion: string;
  featureVersion: string;
  modelVersion: string;
  seed: number;
  parameters: Record<string, unknown>;
  phases: string[];
}

export interface CalibrationBin {
  binIndex: number;
  lowerBound: number;
  upperBound: number;
  predictedConfidence: number;
  realizedAccuracy: number;
  sampleCount: number;
}

export interface RocPoint {
  threshold: number;
  fpr: number;
  tpr: number;
}

export interface PrPoint {
  threshold: number;
  recall: number;
  precision: number;
}

export interface DecileLift {
  decile: number;
  sampleCount: number;
  winCount: number;
  accuracy: number;
  cumulativeLift: number;
}

export interface KellyRiskMetric {
  avgKellyStake: number;
  stdDevKellyStake: number;
  expectedKellyGrowth: number;
  realizedKellyGrowth: number;
  riskStatus: 'SAFE' | 'WARN_OVERALLOCATION' | 'CRITICAL';
}

export interface DixonColesAudit {
  rho: number;
  lowScoreCorrectionFactor: number; // correction factor for low scoring matches
  adjustmentMatchCount: number;
  status: 'OPTIMAL' | 'SUB_OPTIMAL';
}

export interface StabilityWindow {
  windowIndex: number;
  rangeStart: string;
  rangeEnd: string;
  sampleCount: number;
  roi: number;
  brierScore: number;
}

export interface MultipleComparisonAudit {
  leagueId: LeagueId;
  leagueName: LeagueName;
  rawPValue: number;
  adjustedPValue: number;
  significant: boolean;
}

export interface StatisticalValidatorOutput {
  metrics: ReplayMetrics;
  confidenceIntervals: ConfidenceInterval[];
  calibrationQuality: string;
  statisticalConfidence: string;
  driftDetected: boolean;
  calibrationBins: CalibrationBin[];
  rocPoints: RocPoint[];
  prPoints: PrPoint[];
  decileLifts: DecileLift[];
  kellyRisk: KellyRiskMetric;
  dixonColesAudit: DixonColesAudit;
  stabilityWindows: StabilityWindow[];
  multipleComparisons: MultipleComparisonAudit[];
}

