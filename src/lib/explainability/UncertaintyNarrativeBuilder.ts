import { UncertaintyVector } from '../decision/UncertaintyVector';

export class UncertaintyNarrativeBuilder {
  /**
   * Translates the UncertaintyVector into a human-readable narrative.
   */
  static build(vector: UncertaintyVector): string {
    const lines: string[] = [];
    
    if (vector.epistemic != null) {
      lines.push(`• Epistemic (model knowledge): ${this.describeLevel(vector.epistemic)}`);
    }
    if (vector.aleatoric != null) {
      lines.push(`• Aleatoric (inherent variance): ${this.describeLevel(vector.aleatoric)}`);
    }
    if (vector.data_quality != null) {
      lines.push(`• Data quality impact: ${this.describeLevel(1 - vector.data_quality)}`);
    }
    if (vector.distribution_shift != null) {
      lines.push(`• Distribution shift: ${this.describeLevel(1 - vector.distribution_shift)}`);
    }
    if (vector.calibration_quality != null) {
      lines.push(`• Calibration uncertainty: ${this.describeLevel(1 - vector.calibration_quality)}`);
    }
    if (vector.ensemble_agreement != null) {
      lines.push(`• Ensemble disagreement: ${this.describeLevel(1 - vector.ensemble_agreement)}`);
    }
    if (vector.external_consensus != null) {
      lines.push(`• External disagreement: ${this.describeLevel(1 - vector.external_consensus)}`);
    }

    if (lines.length === 0) {
      return 'No specific uncertainty sources were quantified for this decision.';
    }

    return 'Decision uncertainty is driven by the following factors:\n' + lines.join('\n');
  }

  private static describeLevel(val: number): string {
    if (val >= 0.8) return 'CRITICAL';
    if (val >= 0.6) return 'HIGH';
    if (val >= 0.4) return 'MODERATE';
    if (val >= 0.2) return 'LOW';
    return 'NEGLIGIBLE';
  }
}
