import { UncertaintyVector } from './UncertaintyVector';

export class DecisionConfidenceEngine {
  /**
   * Aggregates the Uncertainty Vector into a final confidence score.
   */
  static calculate(vector: UncertaintyVector): number {
    let confidence = 1.0;

    // Use a multiplicative model to severely penalize poor components
    const components = [
      vector.data_quality ?? 1.0,
      vector.distribution_shift ?? 1.0,
      vector.calibration_quality ?? 1.0,
      vector.ensemble_agreement ?? 1.0,
      vector.external_consensus ?? 1.0,
      vector.evidence_agreement ?? 1.0
    ];

    for (const comp of components) {
      confidence *= Math.max(0, Math.min(1, comp));
    }

    return confidence;
  }
}
