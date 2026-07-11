/**
 * EPIC 19.6 — Redundancy Detection
 */

import type { CorrelationPair, RedundancyReport } from './types';
import { generateRedundancyId } from './id';

export class RedundancyEngine {
  detect(featureIds: string[], featureData: number[][]): RedundancyReport {
    const pairs: CorrelationPair[] = [];
    const n = featureIds.length;

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = featureData[i];
        const b = featureData[j];
        const meanA = a.reduce((s, v) => s + v, 0) / a.length;
        const meanB = b.reduce((s, v) => s + v, 0) / b.length;
        const num = a.reduce((s, v, k) => s + (v - meanA) * (b[k] - meanB), 0);
        const den = Math.sqrt(a.reduce((s, v) => s + Math.pow(v - meanA, 2), 0)) * Math.sqrt(b.reduce((s, v) => s + Math.pow(v - meanB, 2), 0));
        const corr = den > 0 ? num / den : 0;
        if (Math.abs(corr) > 0.7) {
          pairs.push({ featureA: featureIds[i], featureB: featureIds[j], correlation: Math.round(corr * 10000) / 10000, type: corr > 0 ? 'positive' : 'negative' });
        }
      }
    }

    return {
      redundancyId: generateRedundancyId(),
      highCorrelationPairs: pairs,
      multicollinearityDetected: pairs.length > n,
      featureClusters: [],
      generatedAt: new Date().toISOString(),
    };
  }
}

export const defaultRedundancyEngine = new RedundancyEngine();