/**
 * HandicapLab — Feature Intelligence Platform (EPIC 19)
 * =======================================================
 * Complete feature validation & research infrastructure.
 */

export { FEATURE_INTELLIGENCE_VERSION } from './types';
export type {
  FeatureDescriptor, FeatureRegistrationInput, FeatureCategory,
  FeatureLineageGraph, FeatureImportanceResult, ImportanceReport,
  AblationResult, AblationReport, FeatureStabilityResult, StabilityReport,
  CorrelationPair, RedundancyReport,
  FeatureDriftResult, FeatureDriftReport,
  PredictionFeatureContribution,
  GovernanceRecord, FeatureApprovalStatus, FeatureQualityResult, QualityReport,
  FeatureReport, FeatureArtifact,
} from './types';

export { FeatureRegistry, defaultFeatureRegistry } from './registry';
export { FeatureLineageEngine, defaultFeatureLineageEngine } from './lineageEngine';
export { ImportanceEngine, defaultImportanceEngine } from './importanceEngine';
export { AblationEngine, defaultAblationEngine } from './ablationEngine';
export { FeatureStabilityEngine, defaultFeatureStabilityEngine } from './stabilityEngine';
export { RedundancyEngine, defaultRedundancyEngine } from './redundancyEngine';
export { FeatureDriftEngine, defaultFeatureDriftEngine } from './driftEngine';
export { FeatureExplainabilityEngine, defaultFeatureExplainabilityEngine } from './explainability';
export { GovernanceEngine, defaultGovernanceEngine } from './governanceEngine';
export { QualityEngine, defaultQualityEngine } from './qualityEngine';
export { FeatureReportGenerator, defaultFeatureReportGenerator } from './reporting';
export { FeatureArtifactIntegration, defaultFeatureArtifactIntegration } from './artifactIntegration';