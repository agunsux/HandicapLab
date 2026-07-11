/**
 * EPIC 18.8 — Probability Explainability
 * For every prediction: raw probability, calibrated probability, calibration delta,
 * confidence, reliability bucket, historical accuracy, calibration method.
 */

import type { ProbabilityExplanation, CalibratorId, BucketStats } from './types';
import { generateExplainId } from './id';

export class ExplainabilityEngine {
  explain(params: {
    fixtureId: string;
    market: string;
    rawProbability: number;
    calibratedProbability: number;
    confidence: number;
    reliabilityBucket?: BucketStats | null;
    historicalAccuracy?: number;
    calibrationMethod: CalibratorId;
    researchEvidence?: readonly string[];
  }): ProbabilityExplanation {
    return {
      fixtureId: params.fixtureId,
      market: params.market,
      rawProbability: params.rawProbability,
      calibratedProbability: params.calibratedProbability,
      calibrationDelta: Math.round((params.calibratedProbability - params.rawProbability) * 10000) / 10000,
      confidence: params.confidence,
      reliabilityBucket: params.reliabilityBucket ?? null,
      historicalAccuracy: params.historicalAccuracy ?? 0,
      calibrationMethod: params.calibrationMethod,
      researchEvidence: params.researchEvidence ?? [],
    };
  }
}

export const defaultExplainabilityEngine = new ExplainabilityEngine();