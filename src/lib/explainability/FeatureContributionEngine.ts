import { FeatureContributionSet, FeatureContribution } from './types';
import { ProbabilityObject } from '../probability/ProbabilityObject';

export class FeatureContributionEngine {
  /**
   * Deterministically normalizes feature attribution from a ProbabilityObject.
   * Does NOT compute SHAP or inspect models directly.
   */
  static build(probabilityObject?: ProbabilityObject): FeatureContributionSet {
    if (!probabilityObject) {
      return {
        status: 'UNAVAILABLE',
        reason: 'INSUFFICIENT_DATA',
        factors: []
      };
    }

    const attr = probabilityObject.feature_attribution;
    if (!attr || Object.keys(attr).length === 0) {
      return {
        status: 'UNAVAILABLE',
        reason: 'NOT_COMPUTED',
        factors: []
      };
    }

    const rawFactors = Object.entries(attr);
    if (rawFactors.length === 0) {
      return {
        status: 'UNAVAILABLE',
        reason: 'NOT_COMPUTED',
        factors: []
      };
    }

    // Calculate sum of absolute values for normalization
    const totalAbsContribution = rawFactors.reduce((sum, [_, val]) => sum + Math.abs(val), 0);

    if (totalAbsContribution === 0) {
      return {
        status: 'UNAVAILABLE',
        reason: 'MODEL_LIMITATION',
        factors: []
      };
    }

    const factors: FeatureContribution[] = rawFactors.map(([name, val]) => ({
      name,
      contribution: Math.abs(val) / totalAbsContribution,
      direction: val >= 0 ? 'POSITIVE' : 'NEGATIVE',
      confidence: 1.0 // Sourced directly from ProbabilityObject
    }));

    // Sort by absolute contribution descending
    factors.sort((a, b) => b.contribution - a.contribution);

    return {
      status: 'AVAILABLE',
      factors
    };
  }
}
