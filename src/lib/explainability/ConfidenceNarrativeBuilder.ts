import { DecisionObject } from '../decision/DecisionObject';
import { HealthScoreBreakdown } from '../monitoring/types';
import { EvidenceSourceSummary } from './types';

export class ConfidenceNarrativeBuilder {
  /**
   * Translates confidence score and context into a narrative.
   */
  static build(
    decisionObject: DecisionObject,
    healthScore?: HealthScoreBreakdown,
    evidenceSources?: EvidenceSourceSummary[]
  ): string {
    const confidence = decisionObject.confidence ?? 0;
    const confidenceLevel =
      confidence >= 0.8 ? 'VERY HIGH'
      : confidence >= 0.7 ? 'HIGH'
      : confidence >= 0.5 ? 'MEDIUM'
      : 'LOW';

    let narrative = `Overall confidence is ${(confidence * 100).toFixed(1)}% (${confidenceLevel}).\n`;

    const positiveFactors: string[] = [];
    const negativeFactors: string[] = [];

    // Health Score context
    if (healthScore) {
      if (healthScore.score >= 80) {
        positiveFactors.push('Overall model health is GOOD');
      } else if (healthScore.score < 60) {
        negativeFactors.push('Overall model health is CRITICAL');
      }

      if (healthScore.components.calibration >= 15) {
        positiveFactors.push('Calibration is stable');
      } else {
        negativeFactors.push('Calibration is degraded');
      }

      if (healthScore.components.dataQuality >= 12) {
        positiveFactors.push('Data quality is high');
      } else {
        negativeFactors.push('Data quality is below target');
      }
    }

    // Evidence Agreement context
    if (evidenceSources && evidenceSources.length > 1) {
      const allSignals = evidenceSources.map(e => e.signal).filter(s => s !== 'UNKNOWN');
      const uniqueSignals = new Set(allSignals);
      
      if (uniqueSignals.size === 1) {
        positiveFactors.push('High agreement across evidence sources');
      } else if (uniqueSignals.has('BET') && uniqueSignals.has('NO_BET')) {
        negativeFactors.push('Conflicting signals among evidence sources');
      }
    }

    // Uncertainty context
    const vector = decisionObject.uncertainty_vector;
    if (vector) {
      if (vector.epistemic !== undefined && vector.epistemic < 0.3) positiveFactors.push('Epistemic uncertainty is low');
      if (vector.epistemic !== undefined && vector.epistemic > 0.7) negativeFactors.push('Epistemic uncertainty is high');
      
      if (vector.aleatoric !== undefined && vector.aleatoric > 0.8) negativeFactors.push('Aleatoric (inherent) uncertainty is very high');
    }

    if (positiveFactors.length > 0) {
      narrative += `Factors increasing confidence: ${positiveFactors.join(', ')}.\n`;
    }
    
    if (negativeFactors.length > 0) {
      narrative += `Factors reducing confidence: ${negativeFactors.join(', ')}.\n`;
    }

    return narrative.trim();
  }
}
