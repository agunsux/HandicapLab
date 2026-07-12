/**
 * 21.2 — Prediction Snapshot Engine
 * Immutable prediction snapshots frozen forever.
 */

import type { PredictionSnapshot } from './types';
import { generateSnapshotId } from './id';

export class ShadowPredictionSnapshot {
  capture(input: {
    fixtureId: string; provider: string; market: string;
    homeOdds: number; drawOdds: number | null; awayOdds: number;
    predictedHomeProb: number; predictedDrawProb: number; predictedAwayProb: number;
    fairOdds: number; expectedValue: number; recommendedStake: number;
    decisionPolicy: string; featureValues: Record<string, number>;
    calibrationVersion: string; modelVersion: string; experimentVersion: string;
    researchManifest: string;
  }): PredictionSnapshot {
    return Object.freeze({
      snapshotId: generateSnapshotId(),
      fixtureId: input.fixtureId,
      timestamp: new Date().toISOString(),
      provider: input.provider,
      market: input.market,
      homeOdds: input.homeOdds,
      drawOdds: input.drawOdds,
      awayOdds: input.awayOdds,
      predictedHomeProb: input.predictedHomeProb,
      predictedDrawProb: input.predictedDrawProb,
      predictedAwayProb: input.predictedAwayProb,
      fairOdds: input.fairOdds,
      expectedValue: input.expectedValue,
      recommendedStake: input.recommendedStake,
      decisionPolicy: input.decisionPolicy,
      featureValues: Object.freeze({ ...input.featureValues }),
      calibrationVersion: input.calibrationVersion,
      modelVersion: input.modelVersion,
      experimentVersion: input.experimentVersion,
      researchManifest: input.researchManifest,
      immutable: true as const,
    });
  }
}

export const defaultShadowPredictionSnapshot = new ShadowPredictionSnapshot();