/**
 * HandicapLab Replay Engine
 * ==========================
 * Production-grade Historical Replay Engine.
 *
 * The Prediction Engine never knows whether data comes from
 * live API, CSV, JSON, or Supabase — only the provider changes.
 *
 * Exports:
 *   - Core types          → HistoricalMatch, ReplayConfig, ReplayResult, ReplayMetrics
 *   - Provider interfaces → FixtureProvider, OddsProvider, ResultProvider, Predictor
 *   - ReplayRunner        → batch execution engine
 *   - Dataset loaders     → JSON, Supabase, CSV (foundation)
 *   - Validator           → schema validation before replay
 *   - MockDataProvider    → 15-match EPL dataset for testing
 */

export { ReplayRunner } from './ReplayRunner';
export { createReplayContext } from './ReplayContext';
export { validateDataset } from './validator';
export { JsonDatasetLoader, SupabaseDatasetLoader, CsvDatasetLoader } from './DatasetLoader';
export type { DatasetLoader, LoadedDataset, DatasetSchema } from './DatasetLoader';
export { MockReplayDataProvider, MOCK_FIXTURES, MOCK_ODDS, MOCK_RESULTS } from './MockReplayDataProvider';

export type {
  HistoricalFixture,
  HistoricalOdds,
  HistoricalResult,
  HistoricalMatch,
  ReplayConfig,
  ReplayPredictionOutput,
  ReplayOutcome,
  ReplayMetrics,
  ReplayResult,
  ReplayContext,
  ReplayValidationReport,
  ReplayValidationError,
} from './types';

export type {
  FixtureProvider,
  OddsProvider,
  ResultProvider,
  HistoricalDataProvider,
  Predictor,
} from './providers';