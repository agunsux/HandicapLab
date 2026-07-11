/**
 * HandicapLab — Baseline Validation Suite (EPIC 17)
 * ====================================================
 * Complete baseline validation infrastructure.
 *
 * Public surface:
 *   - Types & Constants
 *   - ID Generation
 *   - Baseline Registry (17.1)
 *   - Evaluation Protocol (17.2)
 *   - Research Scenario Engine (17.3)
 *   - Evaluation Metrics Engine (17.4)
 *   - Statistical Comparison Engine (17.5)
 *   - Ranking Engine (17.6)
 *   - Champion Validator (17.7)
 *   - Stability Analyzer (17.8)
 *   - Benchmark Reporting (17.9)
 *   - Research Artifact Integration (17.10)
 */

export { BASELINE_VALIDATION_VERSION, BUILTIN_BASELINE_DESCRIPTORS } from './types';
export type {
  BaselineDescriptor, DecisionRules, StakeSizing,
  ScenarioConfig, ScenarioResult, BaselineScenarioMetrics,
  EvaluationMetricsResult, StatisticalComparisonResult,
  RankingCriteria, RankingEntry, RankingReport,
  ChampionPromotionCriteria, PromotionGatesResult, ChampionPromotionDecision,
  StabilityDimension, StabilitySegment, StabilityReport,
  BenchmarkReport, ValidationArtifact,
} from './types';

export {
  generateScenarioId, generateRankingId, generatePromotionId,
  generateStabilityId, generateBVReportId, generateArtifactId,
} from './id';

export { MetricsEngine, defaultMetricsEngine } from './metricsEngine';
export { ScenarioEngine, defaultScenarioEngine } from './scenarioEngine';
export { StatisticalComparisonEngine, defaultStatsComparison } from './statisticalComparison';
export { RankingEngine, defaultRankingEngine } from './rankingEngine';
export { ChampionValidator, defaultChampionValidator } from './championValidator';
export { StabilityAnalyzer, defaultStabilityAnalyzer } from './stabilityAnalyzer';
export { BenchmarkReportGenerator, defaultBenchmarkReportGenerator } from './benchmarkReporting';
export { ArtifactIntegration, defaultArtifactIntegration } from './artifactIntegration';