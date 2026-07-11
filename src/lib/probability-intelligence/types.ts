/**
 * HandicapLab — Probability Intelligence Platform (EPIC 18)
 * ==========================================================
 * Strongly-typed contracts for calibration, reliability, drift detection,
 * explainability, and champion calibration gates.
 */

export const PROBABILITY_INTELLIGENCE_VERSION = '1.0.0' as const;

export const PI_ID_PREFIX = {
  CALIBRATOR: 'pical',
  RELIABILITY: 'pirel',
  CROSSVAL: 'picv',
  DRIFT: 'pidrift',
  EXPLAIN: 'piexp',
  REPORT: 'pirep',
  ARTIFACT: 'piart',
  DASHBOARD: 'pidash',
  CALGATE: 'pigate',
} as const;

// ─── EPIC 18.1 — Calibration Registry ───────────────────────────────────

export type CalibratorId = 'raw' | 'platt' | 'isotonic' | 'beta' | 'temperature' | 'histogram' | 'bayesian_binning' | 'ensemble';

export interface CalibratorDescriptor {
  readonly id: CalibratorId;
  readonly version: string;
  readonly description: string;
  readonly supportedMarkets: readonly string[];
  readonly requiresTraining: boolean;
  readonly deterministic: boolean;
  readonly hyperparameters: readonly string[];
}

export const BUILTIN_CALIBRATORS: readonly CalibratorDescriptor[] = [
  { id: 'raw', version: '1.0.0', description: 'No calibration — uses raw predicted probabilities', supportedMarkets: ['ML', 'AH', 'OU', 'BTTS'], requiresTraining: false, deterministic: true, hyperparameters: [] },
  { id: 'platt', version: '1.0.0', description: 'Platt scaling — logistic regression on logits', supportedMarkets: ['ML', 'AH', 'OU'], requiresTraining: true, deterministic: true, hyperparameters: ['max_iter', 'l2_regularization'] },
  { id: 'isotonic', version: '1.0.0', description: 'Isotonic regression — non-parametric monotone fit', supportedMarkets: ['ML', 'AH', 'OU'], requiresTraining: true, deterministic: true, hyperparameters: ['increasing'] },
  { id: 'beta', version: '1.0.0', description: 'Beta calibration — beta distribution transformation', supportedMarkets: ['ML'], requiresTraining: true, deterministic: true, hyperparameters: ['max_iter'] },
  { id: 'temperature', version: '1.0.0', description: 'Temperature scaling — single parameter scaling', supportedMarkets: ['ML', 'AH', 'OU', 'BTTS'], requiresTraining: true, deterministic: true, hyperparameters: ['initial_temperature'] },
  { id: 'histogram', version: '1.0.0', description: 'Histogram binning — equal-width bin calibration', supportedMarkets: ['ML', 'AH', 'OU'], requiresTraining: true, deterministic: true, hyperparameters: ['num_bins'] },
  { id: 'bayesian_binning', version: '1.0.0', description: 'Bayesian binning with Dirichlet priors', supportedMarkets: ['ML'], requiresTraining: true, deterministic: true, hyperparameters: ['num_bins', 'alpha_prior'] },
  { id: 'ensemble', version: '1.0.0', description: 'Ensemble calibration — average of multiple methods', supportedMarkets: ['ML', 'AH', 'OU'], requiresTraining: true, deterministic: true, hyperparameters: ['methods', 'weights'] },
];

// ─── EPIC 18.2 — Reliability Engine ─────────────────────────────────────

export interface BucketStats {
  readonly binIndex: number;
  readonly binLower: number;
  readonly binUpper: number;
  readonly count: number;
  readonly expectedFrequency: number;
  readonly observedFrequency: number;
  readonly expectedCount: number;
  readonly observedCount: number;
  readonly residual: number;
  readonly confidence: number;
}

export interface ReliabilityCurve {
  readonly datasetId: string;
  readonly market: string;
  readonly calibratorId: CalibratorId;
  readonly buckets: readonly BucketStats[];
  readonly ece: number;
  readonly mce: number;
  readonly brierScore: number;
  readonly logLoss: number;
}

export interface ConfidenceHistogram {
  readonly binLower: number;
  readonly binUpper: number;
  readonly count: number;
}

// ─── EPIC 18.3 — Calibration Metrics Engine ──────────────────────────────

export interface CalibrationMetricsResult {
  readonly ece: number;
  readonly mce: number;
  readonly ace: number;
  readonly brierScore: number;
  readonly logLoss: number;
  readonly negativeLogLikelihood: number;
  readonly calibrationLoss: number;
  readonly sharpness: number;
  readonly resolution: number;
  readonly uncertainty: number;
  readonly murphyDecomposition: {
    readonly reliability: number;
    readonly resolution: number;
    readonly uncertainty: number;
  };
}

// ─── EPIC 18.4 — Multi-Market Calibration ───────────────────────────────

export interface MarketCalibrationProfile {
  readonly market: string;
  readonly calibratorId: CalibratorId;
  readonly params: Record<string, number>;
  readonly metrics: CalibrationMetricsResult;
  readonly trainedAt: string;
  readonly trainingSize: number;
}

// ─── EPIC 18.5 — Calibration Comparison ─────────────────────────────────

export interface CalibrationComparisonResult {
  readonly calibratorA: CalibratorId;
  readonly calibratorB: CalibratorId;
  readonly market: string;
  readonly eceDelta: number;
  readonly brierDelta: number;
  readonly logLossDelta: number;
  readonly sharpnessDelta: number;
  readonly resolutionDelta: number;
  readonly expectedImprovement: number;
  readonly significant: boolean;
}

// ─── EPIC 18.6 — Cross Validation Laboratory ────────────────────────────

export type CrossValidationStrategy = 'kfold' | 'walk_forward' | 'rolling' | 'expanding' | 'leave_one_season' | 'leave_one_league' | 'cross_market';

export interface CrossValidationFold {
  readonly foldIndex: number;
  readonly trainSize: number;
  readonly testSize: number;
  readonly trainStart: string;
  readonly trainEnd: string;
  readonly testStart: string;
  readonly testEnd: string;
  readonly metrics: CalibrationMetricsResult;
}

export interface CrossValidationReport {
  readonly datasetId: string;
  readonly strategy: CrossValidationStrategy;
  readonly folds: readonly CrossValidationFold[];
  readonly aggregateMetrics: CalibrationMetricsResult;
  readonly stdDevMetrics: CalibrationMetricsResult;
  readonly generatedAt: string;
}

// ─── EPIC 18.7 — Probability Drift Detection ────────────────────────────

export interface DriftResult {
  readonly dimension: string;
  readonly pstabilityIndex: number;
  readonly klDivergence: number;
  readonly jsDistance: number;
  readonly earthMoverDistance: number;
  readonly driftDetected: boolean;
  readonly severity: 'none' | 'low' | 'medium' | 'high';
}

export interface DriftReport {
  readonly baselineLabel: string;
  readonly currentLabel: string;
  readonly results: readonly DriftResult[];
  readonly overallDriftDetected: boolean;
  readonly generatedAt: string;
}

// ─── EPIC 18.8 — Probability Explainability ─────────────────────────────

export interface ProbabilityExplanation {
  readonly fixtureId: string;
  readonly market: string;
  readonly rawProbability: number;
  readonly calibratedProbability: number;
  readonly calibrationDelta: number;
  readonly confidence: number;
  readonly reliabilityBucket: BucketStats | null;
  readonly historicalAccuracy: number;
  readonly calibrationMethod: CalibratorId;
  readonly researchEvidence: readonly string[];
}

// ─── EPIC 18.9 — Reliability Reporting ──────────────────────────────────

export interface ReliabilityReport {
  readonly reportId: string;
  readonly generatedAt: string;
  readonly datasetId: string;
  readonly calibratorId: CalibratorId;
  readonly market: string;
  readonly reliabilityCurve: ReliabilityCurve;
  readonly metrics: CalibrationMetricsResult;
  readonly crossValidation: CrossValidationReport | null;
  readonly drift: DriftReport | null;
  readonly comparisonResults: readonly CalibrationComparisonResult[];
}

// ─── EPIC 18.10 — Calibration Artifact Integration ──────────────────────

export interface CalibrationArtifact {
  readonly artifactId: string;
  readonly datasetId: string;
  readonly experimentId: string;
  readonly modelVersion: string;
  readonly featureVersion: string;
  readonly calibratorId: CalibratorId;
  readonly calibrationProfile: MarketCalibrationProfile;
  readonly reliabilityCurve: ReliabilityCurve;
  readonly metrics: CalibrationMetricsResult;
  readonly timestamp: string;
  readonly immutable: true;
}

// ─── EPIC 18.11 — Dashboard Dataset ─────────────────────────────────────

export interface CalibrationDashboardDataset {
  readonly datasetId: string;
  readonly generatedAt: string;
  readonly reliabilityCurves: readonly ReliabilityCurve[];
  readonly eceTimeline: readonly { timestamp: string; ece: number }[];
  readonly brierTimeline: readonly { timestamp: string; brierScore: number }[];
  readonly logLossTimeline: readonly { timestamp: string; logLoss: number }[];
  readonly probabilityHistograms: readonly ConfidenceHistogram[];
  readonly driftTimeline: readonly { timestamp: string; driftDetected: boolean; psi: number }[];
}

// ─── EPIC 18.12 — Champion Calibration Gate ─────────────────────────────

export interface CalibrationGateCriteria {
  readonly maxEce: number;
  readonly maxMce: number;
  readonly minSharpness: number;
  readonly maxLogLoss: number;
  readonly maxCalibrationDrift: number;
  readonly requireCrossValidationSuccess: boolean;
  readonly requireBucketStability: boolean;
  readonly maxProbabilityDrift: number;
}

export interface CalibrationGateResult {
  readonly gate: string;
  readonly passed: boolean;
  readonly value: number;
  readonly threshold: number;
  readonly detail: string;
}

export interface ChampionCalibrationDecision {
  readonly decisionId: string;
  readonly candidateBaselineId: string;
  readonly criteria: CalibrationGateCriteria;
  readonly gates: readonly CalibrationGateResult[];
  readonly passed: boolean;
  readonly decisionReport: string;
  readonly generatedAt: string;
}