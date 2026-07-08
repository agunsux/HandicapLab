import { DecisionObject } from './DecisionObject';
import { UncertaintyVector } from './UncertaintyVector';

export class DecisionGate {
  /**
   * Final filter that determines if a signal should be allowed.
   */
  static evaluate(
    probability: number,
    expectedValue: number,
    confidence: number,
    vector: UncertaintyVector
  ): DecisionObject {
    const reasoning: string[] = [];
    const blocking_flags: string[] = [];

    // Thresholds
    const PROB_THRESHOLD = 0.55;
    const EV_THRESHOLD = 0.05;
    const CONFIDENCE_THRESHOLD = 0.70;

    let decision: 'BET' | 'NO_BET' | 'INCONCLUSIVE' | 'WAIT' = 'NO_BET';
    let risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';

    // 1. Evidence Agreement Check
    if (vector.evidence_agreement != null && vector.evidence_agreement < 0.5) {
      decision = 'INCONCLUSIVE';
      blocking_flags.push('CONFLICTING_EVIDENCE');
      reasoning.push('Sources are providing conflicting signals.');
      risk_level = 'CRITICAL';
      
      return {
        decision_version: 'v1',
        probability,
        expected_value: expectedValue,
        uncertainty_vector: vector,
        confidence,
        risk_level,
        decision,
        reasoning,
        blocking_flags
      };
    }

    // 2. Data Quality Check
    if (vector.data_quality != null && vector.data_quality < 0.6) {
      blocking_flags.push('POOR_DATA_QUALITY');
      reasoning.push('Data quality is below acceptable thresholds.');
      risk_level = 'HIGH';
    }

    // 3. Epistemic Uncertainty Check
    if (vector.epistemic != null && vector.epistemic > 0.4) {
      blocking_flags.push('HIGH_EPISTEMIC_UNCERTAINTY');
      reasoning.push('Model lacks knowledge about this specific scenario.');
      risk_level = 'HIGH';
    }

    // 4. Aleatoric Uncertainty Check
    if (vector.aleatoric != null && vector.aleatoric > 0.6) {
      blocking_flags.push('HIGH_ALEATORIC_UNCERTAINTY');
      reasoning.push('Inherent randomness is too high for a confident prediction.');
      risk_level = 'HIGH';
    }

    // 5. Distribution Shift Check
    if (vector.distribution_shift != null && vector.distribution_shift > 0.3) {
      blocking_flags.push('DISTRIBUTION_SHIFT_DETECTED');
      reasoning.push('Current data distribution deviates from training data.');
      risk_level = 'HIGH';
    }

    // 4. Confidence Check
    if (confidence < CONFIDENCE_THRESHOLD) {
      blocking_flags.push('LOW_CONFIDENCE');
      reasoning.push(`Overall confidence (${(confidence * 100).toFixed(1)}%) is below threshold (${CONFIDENCE_THRESHOLD * 100}%).`);
      risk_level = 'HIGH';
    }

    // 5. Value Check
    if (expectedValue < EV_THRESHOLD) {
      blocking_flags.push('LOW_EXPECTED_VALUE');
      reasoning.push(`Expected value (${(expectedValue * 100).toFixed(1)}%) is below threshold (${EV_THRESHOLD * 100}%).`);
    }

    if (probability < PROB_THRESHOLD && expectedValue >= EV_THRESHOLD) {
      // Technically an edge case, but standard logic
      reasoning.push(`Probability is low, but EV is sufficient.`);
    }

    // Final Decision
    if (blocking_flags.length === 0) {
      decision = 'BET';
      reasoning.push('All decision gates passed successfully.');
    }

    return {
      decision_version: 'v1',
      probability,
      expected_value: expectedValue,
      uncertainty_vector: vector,
      confidence,
      risk_level,
      decision,
      reasoning,
      blocking_flags
    };
  }
}
