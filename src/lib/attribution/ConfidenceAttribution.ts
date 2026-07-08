import { Contribution } from './types';
import { DecisionObject } from '../decision/DecisionObject';
import { HealthScoreBreakdown } from '../monitoring/types';

export class ConfidenceAttribution {
  /**
   * Deterministically attributes the final confidence score to underlying factors.
   * Maps HealthScore and Uncertainty dimensions that directly impacted confidence.
   */
  static build(decision: DecisionObject, healthScore?: HealthScoreBreakdown): Contribution[] {
    const contributions: Contribution[] = [];
    const vector = decision.uncertainty_vector;

    // 1. Health Score Contributions
    if (healthScore) {
      if (healthScore.components.calibration > 15) {
        contributions.push({
          name: 'calibration_health', type: 'HEALTH',
          weight: healthScore.components.calibration,
          direction: 'POSITIVE',
          normalizedContribution: healthScore.components.calibration / 20,
          confidence: 1.0, evidenceSource: 'Model Health Monitor'
        });
      } else if (healthScore.components.calibration < 10) {
        contributions.push({
          name: 'calibration_health', type: 'HEALTH',
          weight: healthScore.components.calibration,
          direction: 'NEGATIVE',
          normalizedContribution: 1 - (healthScore.components.calibration / 20),
          confidence: 1.0, evidenceSource: 'Model Health Monitor'
        });
      }
    }

    // 2. Evidence Agreement Contribution
    if (vector?.evidence_agreement !== undefined) {
      contributions.push({
        name: 'evidence_agreement', type: 'EVIDENCE',
        weight: vector.evidence_agreement,
        direction: vector.evidence_agreement >= 0.5 ? 'POSITIVE' : 'NEGATIVE',
        normalizedContribution: vector.evidence_agreement >= 0.5 ? vector.evidence_agreement : 1 - vector.evidence_agreement,
        confidence: 0.9, evidenceSource: 'Evidence Agreement Scaffold'
      });
    }

    return contributions;
  }
}
