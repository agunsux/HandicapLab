/**
 * EPIC 19.8 — Feature Explainability
 */

import type { PredictionFeatureContribution } from './types';

export class FeatureExplainabilityEngine {
  explain(params: {
    featureId: string;
    contribution: number;
    importance: number;
    confidence: number;
    quality: number;
    freshness: string;
    provenance: string;
  }): PredictionFeatureContribution {
    return {
      featureId: params.featureId,
      contribution: Math.round(params.contribution * 10000) / 10000,
      importance: Math.round(params.importance * 10000) / 10000,
      confidence: Math.round(params.confidence * 10000) / 10000,
      quality: Math.round(params.quality * 10000) / 10000,
      freshness: params.freshness,
      provenance: params.provenance,
      active: params.importance > 0.01,
    };
  }
}

export const defaultFeatureExplainabilityEngine = new FeatureExplainabilityEngine();