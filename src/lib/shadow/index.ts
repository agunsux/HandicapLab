/**
 * HandicapLab — Live Shadow Research Platform (EPIC 21)
 * =======================================================
 * Production-grade shadow research — executes predictions against LIVE
 * fixtures without placing bets. Every prediction becomes immutable evidence.
 */

export { SHADOW_PLATFORM_VERSION } from './types';
export type {
  ShadowFixture, FixtureStatus, FixtureQueueState,
  PredictionSnapshot, OddsPoint, OddsTimeline,
  MarketEvent, MarketEventType, MatchResult,
  LiveEvaluationResult, ResearchEntry,
  DashboardMetrics, DashboardBreakdown, DashboardReport,
  DriftAlert, DriftDimension, DriftReport,
  ChampionValidationGate, ChampionStatus, ChampionValidationResult,
  ShadowReport, ShadowReportType, ShadowArtifact,
} from './types';

export { FixtureQueue, defaultFixtureQueue } from './fixtureQueue';
export { ShadowPredictionSnapshot, defaultShadowPredictionSnapshot } from './predictionSnapshot';
export { OddsTimelineTracker, defaultOddsTimelineTracker } from './oddsTimeline';
export { MarketMonitor, defaultMarketMonitor } from './marketMonitor';
export { ResultCollector, defaultResultCollector } from './resultCollector';
export { LiveEvaluator, defaultLiveEvaluator } from './liveEvaluator';
export { ResearchLedger, defaultResearchLedger } from './researchLedger';
export { ShadowDashboardEngine, defaultShadowDashboardEngine } from './dashboardEngine';
export { ShadowDriftDetector, defaultShadowDriftDetector } from './driftDetector';
export { ShadowChampionValidator, defaultShadowChampionValidator } from './championValidator';
export { ShadowReportGenerator, defaultShadowReportGenerator } from './reporting';
export { ShadowArtifactIntegration, defaultShadowArtifactIntegration } from './artifactIntegration';