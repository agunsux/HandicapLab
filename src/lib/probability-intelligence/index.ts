/**
 * HandicapLab — Probability Intelligence Platform (EPIC 18)
 * ===========================================================
 * Complete calibration, reliability, drift detection, and champion gate infrastructure.
 */

export { PROBABILITY_INTELLIGENCE_VERSION, BUILTIN_CALIBRATORS } from './types';
export type {
  CalibratorId, CalibratorDescriptor,
  BucketStats, ReliabilityCurve, ConfidenceHistogram,
  CalibrationMetricsResult, MarketCalibrationProfile,
  CalibrationComparisonResult, CrossValidationStrategy,
  CrossValidationFold, CrossValidationReport,
  DriftResult, DriftReport,
  ProbabilityExplanation, ReliabilityReport,
  CalibrationArtifact, CalibrationDashboardDataset,
  CalibrationGateCriteria, CalibrationGateResult, ChampionCalibrationDecision,
} from './types';

export { CalibratorRegistry, defaultCalibratorRegistry } from './calibrators';
export type { Calibrator, CalibratorParams } from './calibrators';
export { ReliabilityEngine, defaultReliabilityEngine } from './reliabilityEngine';
export { CalibrationMetricsEngine, defaultCalibrationMetrics } from './calibrationMetrics';
export { ComparisonEngine, defaultComparisonEngine } from './comparisonEngine';
export { CrossValidationEngine, defaultCrossValidation } from './crossValidation';
export { DriftDetector, defaultDriftDetector } from './driftDetector';
export { ExplainabilityEngine, defaultExplainabilityEngine } from './explainability';
export { ReliabilityReportGenerator, defaultReliabilityReportGenerator } from './reporting';
export { CalibrationArtifactIntegration, defaultCalibrationArtifactIntegration } from './artifactIntegration';
export { ChampionCalibrationGate, defaultChampionCalibrationGate } from './championCalibrationGate';