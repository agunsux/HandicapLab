/**
 * Closing Odds Infrastructure — Barrel Exports
 */

export { CaptureEngine, CAPTURE_SCHEDULE } from './CaptureEngine';
export { CaptureMonitor } from './CaptureMonitor';
export {
  captureUpcomingMatches,
  backfillClosingOdds,
  generateCaptureReport,
  recomputeCLV,
} from '../../crons/closingOddsCapture';

// Types
export type {
  CapturePhase,
  MarketType as CaptureMarketType,
  CaptureStatus,
  MatchToCapture,
  CaptureResult,
  CaptureRunResult,
  CaptureConfig,
} from './CaptureEngine';

export type {
  CaptureHealthMetrics,
  LeagueCoverageMetric,
  MarketCoverageMetric,
  ProviderCoverageMetric,
  TimelineStats,
} from './CaptureMonitor';