import { Contribution } from './types';
import { DecisionObject } from '../decision/DecisionObject';

export class RiskAttribution {
  /**
   * Translates blocking flags and risk levels into attribution contributions.
   */
  static build(decision: DecisionObject): Contribution[] {
    const contributions: Contribution[] = [];
    const flags = decision.blocking_flags || [];

    for (const flag of flags) {
      // Assign deterministic magnitudes based on flag severity
      let magnitude = 0.5;
      if (flag === 'CONFLICTING_EVIDENCE' || flag === 'DISTRIBUTION_SHIFT_DETECTED') {
        magnitude = 1.0;
      } else if (flag === 'LOW_CONFIDENCE' || flag === 'POOR_DATA_QUALITY') {
        magnitude = 0.8;
      }

      contributions.push({
        name: flag.toLowerCase(),
        type: 'RISK',
        weight: magnitude,
        direction: 'NEGATIVE',
        normalizedContribution: magnitude,
        confidence: 1.0
      });
    }

    return contributions.sort((a, b) => b.normalizedContribution - a.normalizedContribution);
  }
}
