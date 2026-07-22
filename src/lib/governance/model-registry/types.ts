// Model Governance & MLOps Type Definitions
// Location: src/lib/governance/model-registry/types.ts

export type ModelState =
  | 'DRAFT'
  | 'TRAINING'
  | 'VALIDATED'
  | 'CANDIDATE'
  | 'SHADOW'
  | 'CHALLENGER'
  | 'CHAMPION'
  | 'DEPRECATED'
  | 'ARCHIVED';

export interface FingerprintSet {
  datasetSha: string;
  featureSchemaSha: string;
  featureTransformSha: string;
  calibrationSha: string;
  hyperparameterSha: string;
  gitCommitSha: string;
}

export interface ProviderSnapshot {
  provider: string;
  version: string;
  endpoint: string;
  responseSchema: string;
  timestamp: string;
  credentialProfile: string; // Environment profile name (no raw secrets stored)
}

export interface ModelMetrics {
  roiPercent: number;
  clvPercent: number;
  brierScore: number;
  ece: number; // Expected Calibration Error
  logLoss: number;
  sampleSize: number;
  shadowDaysEvaluated?: number;
  calibrationDrift?: number;
  featureDrift?: number;
  predictionCoveragePercent?: number;
  providerReliabilityPercent?: number;
}

export interface PromotionCriteria {
  minRoiPercent: number;
  minClvPercent: number;
  maxBrierScore: number;
  maxEce: number;
  minSampleSize: number;
  minShadowDays: number;
  maxCalibrationDrift: number;
  maxFeatureDrift: number;
  minPredictionCoveragePercent: number;
  minProviderReliabilityPercent: number;
}

export interface AuditRecord {
  id: string;
  modelId: string;
  fromState: ModelState;
  toState: ModelState;
  actor: string;
  reason: string;
  gateEvaluations?: Record<string, any>;
  createdAt: string;
}

export interface ModelMetadata {
  id: string; // e.g. "HL-DC-POISSON-v2.4.1"
  name: string;
  version: string;
  state: ModelState;
  artifactUri: string; // Object storage URI, not raw binary
  fingerprints: FingerprintSet;
  providerSnapshot: ProviderSnapshot;
  parameters: Record<string, any>;
  metrics: ModelMetrics;
  createdAt: string;
  promotedAt?: string;
  archivedAt?: string;
  previousVersionId?: string;
}

export interface ReproducibilityContext {
  predictionId: string;
  modelVersionId: string;
  fingerprints: FingerprintSet;
  providerSnapshot: ProviderSnapshot;
  oddsSnapshot: {
    homeWin: number;
    draw: number;
    awayWin: number;
    handicapLine?: number;
    totalGoalsLine?: number;
    capturedAt: string;
  };
  randomSeed?: number;
  inputFeatures: Record<string, any>;
  outputProbabilities: {
    pHome: number;
    pDraw: number;
    pAway: number;
    pOver?: number;
    pUnder?: number;
  };
  reproducedTimestamp?: string;
}

export interface ReproducibilityResult {
  isExactMatch: boolean;
  predictionId: string;
  modelVersionId: string;
  fingerprintMatches: {
    dataset: boolean;
    featureSchema: boolean;
    featureTransform: boolean;
    calibration: boolean;
    hyperparameters: boolean;
    gitCommit: boolean;
  };
  probabilityDelta: number;
  verifiedAt: string;
}
