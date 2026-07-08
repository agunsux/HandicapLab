import { DecisionObject } from '../decision/DecisionObject';
import { Factor, Risk, Signal } from './types';
import { HealthScoreBreakdown } from '../monitoring/types';

export class StructuredEvidenceBuilder {
  /**
   * Extracts contributing and opposing factors from the DecisionObject and HealthScore.
   */
  static buildFactors(decisionObject: DecisionObject, healthScore?: HealthScoreBreakdown): { contributing: Factor[]; opposing: Factor[] } {
    const contributing: Factor[] = [];
    const opposing: Factor[] = [];
    const vector = decisionObject.uncertainty_vector;

    if (vector) {
      if (vector.epistemic !== undefined) {
        if (vector.epistemic < 0.4) contributing.push({ name: 'epistemic_uncertainty', description: 'Low model uncertainty', direction: 'POSITIVE', magnitude: 1 - vector.epistemic });
        else if (vector.epistemic > 0.6) opposing.push({ name: 'epistemic_uncertainty', description: 'High model uncertainty', direction: 'NEGATIVE', magnitude: vector.epistemic });
      }

      if (vector.data_quality !== undefined) {
        if (vector.data_quality > 0.8) contributing.push({ name: 'data_quality', description: 'High data quality', direction: 'POSITIVE', magnitude: vector.data_quality });
        else if (vector.data_quality < 0.6) opposing.push({ name: 'data_quality', description: 'Poor data quality', direction: 'NEGATIVE', magnitude: 1 - vector.data_quality });
      }
    }

    if (healthScore) {
      if (healthScore.components.calibration > 15) {
        contributing.push({ name: 'calibration_health', description: 'Calibration is stable and healthy', direction: 'POSITIVE', magnitude: healthScore.components.calibration / 20 });
      } else if (healthScore.components.calibration < 10) {
        opposing.push({ name: 'calibration_health', description: 'Calibration has degraded', direction: 'NEGATIVE', magnitude: 1 - (healthScore.components.calibration / 20) });
      }
    }

    // Sort by magnitude descending
    contributing.sort((a, b) => b.magnitude - a.magnitude);
    opposing.sort((a, b) => b.magnitude - a.magnitude);

    return { contributing, opposing };
  }

  /**
   * Extracts risks from the DecisionObject's blocking flags and risk level.
   */
  static buildRisks(decisionObject: DecisionObject): Risk[] {
    const risks: Risk[] = [];
    const flags = decisionObject.blocking_flags || [];

    for (const flag of flags) {
      let severity: Risk['severity'] = 'HIGH';
      if (flag === 'CONFLICTING_EVIDENCE' || flag === 'DISTRIBUTION_SHIFT_DETECTED') {
        severity = 'CRITICAL';
      } else if (flag === 'LOW_CONFIDENCE') {
        severity = 'MEDIUM';
      }

      risks.push({
        flag,
        severity,
        description: `Decision gate failed due to ${flag.replace(/_/g, ' ').toLowerCase()}`
      });
    }

    // Sort: CRITICAL -> HIGH -> MEDIUM -> LOW
    const severityOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    risks.sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity]);

    return risks;
  }

  /**
   * Extracts dominant signals (e.g. key drivers for the decision).
   */
  static buildSignals(decisionObject: DecisionObject): Signal[] {
    const signals: Signal[] = [];
    
    if (decisionObject.confidence !== undefined) {
      signals.push({
        source: 'Decision Confidence',
        value: decisionObject.confidence,
        interpretation: decisionObject.confidence > 0.7 ? 'Confidence is sufficiently high' : 'Confidence is below ideal threshold'
      });
    }

    if (decisionObject.expected_value !== undefined) {
      signals.push({
        source: 'Expected Value',
        value: decisionObject.expected_value,
        interpretation: decisionObject.expected_value > 0.05 ? 'Positive expected value identified' : 'Expected value is too low'
      });
    }

    return signals.sort((a, b) => b.value - a.value);
  }
}
