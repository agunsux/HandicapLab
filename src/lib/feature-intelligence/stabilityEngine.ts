/**
 * EPIC 19.5 — Feature Stability Analysis
 */

import type { FeatureStabilityResult, StabilityReport } from './types';
import { generateFStabilityId } from './id';

export class FeatureStabilityEngine {
  analyze(featureId: string, segments: readonly { label: string; values: number[] }[]): FeatureStabilityResult {
    const segs = segments.map((s) => {
      const mean = s.values.reduce((a, v) => a + v, 0) / (s.values.length || 1);
      const variance = s.values.reduce((a, v) => a + Math.pow(v - mean, 2), 0) / (s.values.length || 1);
      return { label: s.label, mean: Math.round(mean * 10000) / 10000, std: Math.round(Math.sqrt(variance) * 10000) / 10000 };
    });

    const means = segs.map((s) => s.mean);
    const globalMean = means.reduce((a, v) => a + v, 0) / (means.length || 1);
    const maxDev = Math.max(...means.map((m) => Math.abs(m - globalMean)));
    const stabilityScore = Math.max(0, Math.round((100 - maxDev * 20) * 100) / 100);

    return {
      featureId,
      stabilityScore,
      degradationDetected: maxDev > 0.3,
      segments: segs,
    };
  }
}

export const defaultFeatureStabilityEngine = new FeatureStabilityEngine();