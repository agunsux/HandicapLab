/**
 * EPIC 19.4 — Ablation Laboratory
 */

import type { AblationStrategy, AblationResult, AblationReport } from './types';
import { generateAblationId } from './id';

export class AblationEngine {
  runSingleRemoval(
    featureIds: readonly string[],
    baselineMetric: number,
    metricWithRemoved: (removedId: string) => number
  ): AblationReport {
    const results: AblationResult[] = featureIds.map((fid) => {
      const after = metricWithRemoved(fid);
      const delta = after - baselineMetric;
      const deltaPct = baselineMetric !== 0 ? (delta / Math.abs(baselineMetric)) * 100 : 0;
      return {
        removedFeatureId: fid,
        baselineMetric,
        afterMetric: after,
        delta: Math.round(delta * 10000) / 10000,
        deltaPct: Math.round(deltaPct * 100) / 100,
      };
    });

    return {
      ablationId: generateAblationId(),
      strategy: 'single_removal',
      results,
      generatedAt: new Date().toISOString(),
    };
  }
}

export const defaultAblationEngine = new AblationEngine();