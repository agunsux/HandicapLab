import { Contribution } from './types';
import { DecisionObject } from '../decision/DecisionObject';

export class UncertaintyAttribution {
  /**
   * Attributes which uncertainty dimensions suppressed the decision confidence.
   */
  static build(decision: DecisionObject): Contribution[] {
    const contributions: Contribution[] = [];
    const vector = decision.uncertainty_vector;

    if (!vector) return contributions;

    const mapDim = (name: string, val: number | undefined | null, invert: boolean = false) => {
      if (val === undefined || val === null) return;
      // Some dimensions (like epistemic) are bad when high.
      // Some (like data_quality) are bad when low (so we invert them).
      const magnitude = invert ? 1 - val : val;
      
      // Only include if it represents notable uncertainty (e.g. > 0.3)
      if (magnitude > 0.3) {
        contributions.push({
          name, type: 'UNCERTAINTY',
          weight: magnitude,
          direction: 'NEGATIVE',
          normalizedContribution: magnitude, // already 0-1
          confidence: 0.8
        });
      }
    };

    mapDim('epistemic_uncertainty', vector.epistemic, false);
    mapDim('aleatoric_uncertainty', vector.aleatoric, false);
    mapDim('data_quality_uncertainty', vector.data_quality, true);
    mapDim('distribution_shift_uncertainty', vector.distribution_shift, true);
    mapDim('calibration_uncertainty', vector.calibration_quality, true);
    mapDim('ensemble_disagreement', vector.ensemble_agreement, true);

    return contributions.sort((a, b) => b.normalizedContribution - a.normalizedContribution);
  }
}
