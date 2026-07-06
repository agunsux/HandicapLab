import { CanonicalFixture } from '../../../data-platform/canonicalModel';
import { MatchFeatures } from '../../feature-engine/types';

export interface ModelMetadata {
  name: string;
  version: string;
  description: string;
  isOnline: boolean; // True if it's an OnlineModel
}

export interface Prediction {
  pHome: number;
  pDraw: number;
  pAway: number;
  expectedGoalsHome?: number;
  expectedGoalsAway?: number;
}

export interface PredictionModel {
  /**
   * Train the model on historical data.
   */
  train(trainData: any[]): Promise<void>;

  /**
   * Predict probabilities (home, draw, away) and expected goals.
   */
  predict(features: MatchFeatures | any): Promise<Prediction>;

  /**
   * Predict probabilities only.
   */
  predictProbability(features: MatchFeatures | any): Promise<{ pHome: number; pDraw: number; pAway: number }>;

  /**
   * Predict score only (expected goals).
   */
  predictScore(features: MatchFeatures | any): Promise<{ home: number; away: number }>;

  /**
   * Returns model metadata.
   */
  metadata(): ModelMetadata;
}

export interface ModelSnapshot {
  [key: string]: any;
}

export interface OnlineModel extends PredictionModel {
  /**
   * Reset to pristine state.
   */
  initialize(): void;

  /**
   * Ingest outcome, update internal state.
   */
  update(match: CanonicalFixture, features?: MatchFeatures): void;

  /**
   * Deep copy of internal state.
   */
  snapshot(): ModelSnapshot;

  /**
   * Restore from snapshot (used for deterministic replay).
   */
  restore(snapshot: ModelSnapshot): void;
}
