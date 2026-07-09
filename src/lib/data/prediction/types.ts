// Prediction Snapshot Types — Shadow Prediction Pipeline
import type { MarketType, MarketSelection } from '../providers/types';

export interface PredictionSnapshot {
  id: string;
  fixtureId: string;
  modelVersion: string;
  /** SHA-256 of the model version + config for reproducibility */
  modelHash: string;
  marketType: MarketType;
  /** The side/selection the model predicts: home, away, draw, over, under */
  selection: MarketSelection;
  line: number;
  /** Model's implied probability for the selected side */
  predictionProb: number;
  /** Market implied probability (from odds snapshot, vig-removed) */
  marketProb: number;
  /** Edge = predictionProb - marketProb */
  edge: number;
  /** Expected value = edge * odds multiplier */
  expectedValue: number;
  /** Confidence score from the prediction engine (0-1) */
  confidence: number;
  /** Reference to the odds snapshot used for marketProb */
  oddsSnapshotId: string;
  /** SHA-256 of the input feature vector used for this prediction */
  inputDataHash: string;
  /** Feature pipeline version that produced the input data */
  featureVersion: string;
  /** Dataset/environment version at prediction time */
  datasetVersion: string;
  /** Timestamp when prediction was generated */
  timestamp: Date;
}

export interface SettlementRecord {
  id: string;
  predictionId: string;
  fixtureId: string;
  modelVersion: string;
  marketType: MarketType;
  selection: MarketSelection;
  line: number;
  /** The odds at settlement time (closing odds) */
  oddsAtSettlement: number;
  /** Actual outcome as numeric: 1 = win, 0 = loss, 0.5 = push, null = unsettled */
  actualOutcome: number | null;
  /** Profit in units (1 = full stake, 0 = push, -1 = loss) */
  profit: number | null;
  /** ROI for this single bet */
  roi: number | null;
  /** CLV = closingOddsProb - predictionMarketProb (positive means model beat the closing line) */
  clv: number | null;
  /** Timestamp when result was recorded */
  settledAt: Date | null;
  /** Whether the standing score settled */
  isSettled: boolean;
}
