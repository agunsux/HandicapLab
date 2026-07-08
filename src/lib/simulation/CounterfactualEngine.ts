import { CounterfactualConfig } from './types';
import { DecisionObject } from '../decision/DecisionObject';

export class CounterfactualEngine {
  /**
   * Applies the counterfactual configuration to a historical decision.
   * Note: For Mode B (Proxy), we approximate the resulting changes directly on the object.
   */
  static applyProxy(decision: DecisionObject, config: CounterfactualConfig): DecisionObject {
    const mutated = { ...decision };

    // 1. Confidence Adjustments (e.g., driver toggle proxy)
    if (config.confidenceAdjustment !== undefined) {
      mutated.confidence = Math.max(0, Math.min(1.0, (mutated.confidence ?? 0) + config.confidenceAdjustment));
    }

    // 2. Threshold Adjustments
    // (If the config raises the threshold, some BETs might become NO_BET if confidence < newThreshold)
    if (config.thresholdAdjustments?.['decisionThreshold']) {
      const newThreshold = config.thresholdAdjustments['decisionThreshold'];
      if ((mutated.confidence ?? 0) < newThreshold) {
        mutated.decision = 'NO_BET';
        mutated.blocking_flags = [...(mutated.blocking_flags || []), 'LOW_CONFIDENCE'];
      }
    }

    return mutated;
  }
}
