import { 
  ExplanationObject, 
  ExplanationInput, 
  EXPLANATION_VERSION, 
  BUILDER_VERSION, 
  DECISION_SCHEMA_VERSION 
} from './types';
import { FeatureContributionEngine } from './FeatureContributionEngine';
import { DecisionReasonBuilder } from './DecisionReasonBuilder';
import { ConfidenceNarrativeBuilder } from './ConfidenceNarrativeBuilder';
import { UncertaintyNarrativeBuilder } from './UncertaintyNarrativeBuilder';
import { EvidenceSummaryBuilder } from './EvidenceSummaryBuilder';
import { RecommendationSummaryBuilder } from './RecommendationSummaryBuilder';
import { StructuredEvidenceBuilder } from './StructuredEvidenceBuilder';

export class ExplanationBuilder {
  /**
   * Orchestrates the construction of the full ExplanationObject.
   * Guaranteed to be 100% deterministic.
   */
  static build(input: ExplanationInput): ExplanationObject {
    const { decisionId, decisionObject, probabilityObject, healthScore, evidenceSources } = input;

    // 1. Compute Structured Data
    const featureContributions = FeatureContributionEngine.build(probabilityObject);
    const evidenceAgreement = EvidenceSummaryBuilder.buildSummary(evidenceSources);
    const { contributing, opposing } = StructuredEvidenceBuilder.buildFactors(decisionObject, healthScore);
    const dominantRisks = StructuredEvidenceBuilder.buildRisks(decisionObject);
    const dominantSignals = StructuredEvidenceBuilder.buildSignals(decisionObject);

    // 2. Compute Narrative Data
    const decisionReason = DecisionReasonBuilder.build(decisionObject);
    const confidenceReason = ConfidenceNarrativeBuilder.build(decisionObject, healthScore, evidenceSources);
    const uncertaintyReason = decisionObject.uncertainty_vector 
      ? UncertaintyNarrativeBuilder.build(decisionObject.uncertainty_vector)
      : 'Uncertainty metrics were not provided.';
    const evidenceSummary = EvidenceSummaryBuilder.build(evidenceAgreement);
    const recommendationSummary = RecommendationSummaryBuilder.build(decisionObject);
    const summary = `Decision for ${decisionId} is ${decisionObject.decision}: ${recommendationSummary}`;

    // 3. Compute Completeness Score (0-100)
    let completenessChecks = 0;
    const totalChecks = 6;
    
    if (decisionReason.length > 20) completenessChecks++;
    if (confidenceReason.length > 20) completenessChecks++;
    if (uncertaintyReason.length > 20) completenessChecks++;
    if (evidenceSummary.length > 20) completenessChecks++;
    if (featureContributions.status !== 'UNAVAILABLE') completenessChecks++;
    if (recommendationSummary.length > 10) completenessChecks++;

    const completenessScore = Math.round((completenessChecks / totalChecks) * 100);

    // 4. Assemble Final Object
    return {
      decisionId,
      explanationVersion: EXPLANATION_VERSION,
      builderVersion: BUILDER_VERSION,
      decisionSchemaVersion: DECISION_SCHEMA_VERSION,
      generatedAt: new Date(),
      completenessScore,
      
      structured: {
        contributingFactors: contributing,
        opposingFactors: opposing,
        dominantSignals,
        dominantRisks,
        featureContributions,
        evidenceAgreement,
      },
      
      narrative: {
        summary,
        decisionReason,
        confidenceReason,
        uncertaintyReason,
        evidenceSummary,
        recommendationSummary,
      }
    };
  }
}
