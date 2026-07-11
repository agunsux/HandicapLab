/**
 * EPIC 19.10 — Feature Quality Engine
 * Measures: missing values, constant values, variance, entropy, outliers,
 * coverage, freshness, cardinality, distribution quality, overall quality score.
 */

import type { FeatureQualityResult, QualityReport } from './types';
import { generateQualityId } from './id';

export class QualityEngine {
  evaluate(featureId: string, values: readonly number[]): FeatureQualityResult {
    const n = values.length;
    if (n === 0) return this.emptyResult(featureId);

    const missing = values.filter((v) => v === null || v === undefined || Number.isNaN(v)).length;
    const missingValuesPct = (missing / n) * 100;

    const valid = values.filter((v) => v !== null && v !== undefined && !Number.isNaN(v));
    const validN = valid.length;
    const mean = validN > 0 ? valid.reduce((s, v) => s + v, 0) / validN : 0;
    const variance = validN > 0 ? valid.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / validN : 0;
    const constantValue = variance === 0;
    const std = Math.sqrt(variance);

    // Entropy (approximated via histogram)
    const bins = 20;
    const hist = new Array(bins).fill(0);
    const min = Math.min(...valid, 0);
    const max = Math.max(...valid, 1);
    const range = max - min || 1;
    for (const v of valid) {
      const idx = Math.min(bins - 1, Math.floor(((v - min) / range) * bins));
      hist[idx]++;
    }
    const entropy = -hist.reduce((s, c) => {
      const p = c / validN;
      return s + (p > 0 ? p * Math.log(p) : 0);
    }, 0);

    // Outliers (3 sigma)
    const outliers = valid.filter((v) => Math.abs(v - mean) > 3 * std).length;
    const outlierPct = (outliers / validN) * 100;

    // Coverage (fraction non-missing)
    const coverage = validN / n;

    // Cardinality (unique normalized)
    const unique = new Set(valid).size;
    const cardinality = validN > 0 ? unique / validN : 0;

    // Distribution quality: KS-like against uniform
    const sorted = [...valid].sort((a, b) => a - b);
    let maxDev = 0;
    for (let i = 0; i < sorted.length; i++) {
      const expected = (i + 1) / sorted.length;
      const observed = (sorted[i] - min) / range;
      maxDev = Math.max(maxDev, Math.abs(expected - observed));
    }
    const distributionQuality = Math.max(0, 1 - maxDev);

    const overallQualityScore = (
      (100 - missingValuesPct) * 0.2 +
      (constantValue ? 0 : 20) +
      Math.min(20, variance * 10) * 0.2 +
      Math.min(20, entropy * 5) * 0.1 +
      Math.max(0, 10 - outlierPct * 2) * 0.1 +
      coverage * 10 * 0.1 +
      cardinality * 10 * 0.1
    );

    return {
      featureId,
      missingValuesPct: Math.round(missingValuesPct * 100) / 100,
      constantValue,
      variance: Math.round(variance * 10000) / 10000,
      entropy: Math.round(entropy * 10000) / 10000,
      outlierPct: Math.round(outlierPct * 100) / 100,
      coverage: Math.round(coverage * 10000) / 10000,
      freshness: 1,
      cardinality: Math.round(cardinality * 10000) / 10000,
      distributionQuality: Math.round(distributionQuality * 10000) / 10000,
      overallQualityScore: Math.round(overallQualityScore * 100) / 100,
    };
  }

  private emptyResult(featureId: string): FeatureQualityResult {
    return { featureId, missingValuesPct: 100, constantValue: true, variance: 0, entropy: 0, outlierPct: 0, coverage: 0, freshness: 0, cardinality: 0, distributionQuality: 0, overallQualityScore: 0 };
  }
}

export const defaultQualityEngine = new QualityEngine();