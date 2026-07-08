import { Contribution } from './types';
import { ExplanationObject } from '../explainability/types';

export class DecisionAttribution {
  /**
   * Deterministically attributes the final decision to underlying features.
   * Uses the normalized feature contributions from Module 4 as the base,
   * but maps them to the AttributionObject Contribution schema.
   */
  static build(explanation: ExplanationObject): Contribution[] {
    const featureData = explanation.structured.featureContributions;
    
    if (featureData.status !== 'AVAILABLE') {
      return [];
    }

    return featureData.factors.map(f => ({
      name: f.name,
      type: 'FEATURE',
      // Since M4 already normalized them based on absolute value sum, 
      // we use that directly as normalizedContribution.
      weight: f.contribution, 
      direction: f.direction,
      normalizedContribution: f.contribution,
      confidence: f.confidence,
      evidenceSource: 'Model Engine' // Future: could come from other engines
    }));
  }
}
