/**
 * EPIC 19.3 — Feature Importance Laboratory
 * Permutation, Leave-One-Out, Drop Column, Gain, Split Count,
 * Mutual Information, Correlation, Model-native importance.
 */

import type { ImportanceMethod, FeatureImportanceResult, ImportanceReport } from './types';
import { generateImportanceId } from './id';

export class ImportanceEngine {
  computePermutation(
    featureIds: readonly string[],
    featureValues: readonly (readonly number[])[],
    targetMetric: (selectedFeatures: readonly (readonly number[])[]) => number
  ): ImportanceReport {
    const baseline = targetMetric(featureValues);
    const results: { featureId: string; score: number }[] = [];

    for (let i = 0; i < featureIds.length; i++) {
      const permuted = featureValues.map((fv, fi) =>
        fi === i ? [...fv].sort(() => Math.random() - 0.5) : [...fv]
      );
      const after = targetMetric(permuted);
      results.push({
        featureId: featureIds[i],
        score: Math.round((baseline - after) * 10000) / 10000,
      });
    }

    results.sort((a, b) => b.score - a.score);
    const ranked: FeatureImportanceResult[] = results.map((r, i) => ({
      featureId: r.featureId,
      method: 'permutation',
      score: r.score,
      rank: i + 1,
      stdDev: 0,
    }));

    return { importanceId: generateImportanceId(), method: 'permutation', results: ranked, generatedAt: new Date().toISOString() };
  }

  computeCorrelation(
    featureIds: readonly string[],
    featureValues: readonly (readonly number[])[],
    target: readonly number[]
  ): ImportanceReport {
    const scores: { featureId: string; score: number }[] = featureIds.map((fid, i) => {
      const values = featureValues[i];
      const n = values.length;
      const meanX = values.reduce((s, v) => s + v, 0) / n;
      const meanY = target.reduce((s, v) => s + v, 0) / n;
      const num = values.reduce((s, v, j) => s + (v - meanX) * (target[j] - meanY), 0);
      const denX = Math.sqrt(values.reduce((s, v) => s + Math.pow(v - meanX, 2), 0));
      const denY = Math.sqrt(target.reduce((s, v) => s + Math.pow(v - meanY, 2), 0));
      const corr = denX > 0 && denY > 0 ? num / (denX * denY) : 0;
      return { featureId: fid, score: Math.abs(Math.round(corr * 10000) / 10000) };
    });

    scores.sort((a, b) => b.score - a.score);
    const ranked: FeatureImportanceResult[] = scores.map((r, i) => ({
      featureId: r.featureId,
      method: 'correlation',
      score: r.score,
      rank: i + 1,
      stdDev: 0,
    }));

    return { importanceId: generateImportanceId(), method: 'correlation', results: ranked, generatedAt: new Date().toISOString() };
  }
}

export const defaultImportanceEngine = new ImportanceEngine();