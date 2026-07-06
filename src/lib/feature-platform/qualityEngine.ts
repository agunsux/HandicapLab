// HandicapLab Feature Platform - Quality Engine
import { FeatureDefinition } from './registry';

export interface QualityReport {
  score: number; // 0 to 100
  warnings: string[];
  isUnsafe: boolean;
}

export class QualityEngine {
  /**
   * Computes a quality score based on metadata and historical statistics.
   * Mock implementation for Sprint 30.
   */
  public static evaluateFeature(def: FeatureDefinition, missingRate: number, stabilityScore: number): QualityReport {
    const warnings: string[] = [];
    let score = 100;

    if (missingRate > def.qualityRules.maxMissingRate) {
      warnings.push(`Missing rate ${missingRate} exceeds max allowed ${def.qualityRules.maxMissingRate}`);
      score -= 30;
    }

    if (stabilityScore < 0.5) {
      warnings.push(`Low stability score detected: ${stabilityScore}`);
      score -= 20;
    }

    if (def.leakageClassification === 'Warning') {
      warnings.push(`Feature carries a leakage warning: ${def.leakageReasoning}`);
      score -= 10;
    }

    const isUnsafe = def.leakageClassification === 'Unsafe';
    if (isUnsafe) {
      warnings.push(`CRITICAL: Feature is classified as UNSAFE for time-travel. ${def.leakageReasoning}`);
      score = 0;
    }

    return {
      score: Math.max(0, score),
      warnings,
      isUnsafe
    };
  }
}
