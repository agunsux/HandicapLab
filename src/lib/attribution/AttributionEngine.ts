import { 
  AttributionInput, 
  AttributionObject, 
  DriverSummary, 
  Contribution,
  ATTRIBUTION_VERSION,
  BUILDER_VERSION
} from './types';
import { DecisionAttribution } from './DecisionAttribution';
import { ConfidenceAttribution } from './ConfidenceAttribution';
import { UncertaintyAttribution } from './UncertaintyAttribution';
import { RiskAttribution } from './RiskAttribution';
import { InteractionEngine } from './InteractionEngine';
import { DecisionDNABuilder } from './DecisionDNABuilder';
import { CausalGraphBuilder } from './CausalGraphBuilder';
import { DriverRegistry } from './DriverRegistry';

export class AttributionEngine {
  /**
   * Orchestrates the construction of AttributionObject v1 (Decision-Time).
   * Generates structural causal data and reads from Driver Intelligence.
   */
  static buildDraft(input: AttributionInput): AttributionObject {
    const { decisionId, decisionObject, explanationObject, healthScore } = input;

    // 1. Dimensional Contributions
    const decisionContribution = DecisionAttribution.build(explanationObject);
    const confidenceContribution = ConfidenceAttribution.build(decisionObject, healthScore);
    const uncertaintyContribution = UncertaintyAttribution.build(decisionObject);
    const riskContribution = RiskAttribution.build(decisionObject);

    // Aggregate all contributions for global analysis
    const allContributions = [
      ...decisionContribution,
      ...confidenceContribution,
      ...uncertaintyContribution,
      ...riskContribution
    ];

    // 2. Complex Dynamics
    const interactionEffects = InteractionEngine.detectInteractions(allContributions);
    const counteractingFactors = InteractionEngine.detectCounteracting(allContributions);

    // 3. Overall Contribution (Magnitude Sum)
    const overallContribution = allContributions.reduce((sum, c) => sum + c.normalizedContribution, 0);

    // 4. Dominant Drivers & Suppressors
    const pos = allContributions.filter(c => c.direction === 'POSITIVE');
    const neg = allContributions.filter(c => c.direction === 'NEGATIVE');

    const dominantDrivers = this.mapToDriverSummary(pos.sort((a, b) => b.normalizedContribution - a.normalizedContribution).slice(0, 3));
    const dominantSuppressors = this.mapToDriverSummary(neg.sort((a, b) => b.normalizedContribution - a.normalizedContribution).slice(0, 3));

    // 5. Causal Graph & DNA
    const causalGraph = CausalGraphBuilder.build(decisionObject, allContributions, interactionEffects);
    const decisionDNA = DecisionDNABuilder.build(decisionObject, allContributions, interactionEffects);

    // 6. Quality Score
    const qualityScore = this.calculateQualityScore(allContributions, explanationObject.completenessScore);

    return {
      decisionId,
      decisionVersion: decisionObject.decision_version,
      attributionVersion: ATTRIBUTION_VERSION,
      builderVersion: BUILDER_VERSION,
      generatedAt: new Date(),
      phase: 'DECISION_TIME',

      overallContribution,
      
      decisionContribution,
      confidenceContribution,
      uncertaintyContribution,
      riskContribution,
      
      dominantDrivers,
      dominantSuppressors,
      interactionEffects,
      counteractingFactors,
      
      causalGraph,
      decisionDNA,
      qualityScore
    };
  }

  /**
   * Maps raw contributions to DriverSummary by looking up DriverRegistry stats (Intelligence).
   */
  private static mapToDriverSummary(contributions: Contribution[]): DriverSummary[] {
    return contributions.map(c => {
      const stats = DriverRegistry.get(c.name);
      return {
        name: c.name,
        magnitude: c.normalizedContribution,
        reliabilityScore: stats.reliabilityScore
      };
    });
  }

  /**
   * Evaluates the robustness of the attribution itself.
   */
  private static calculateQualityScore(contributions: Contribution[], explCompleteness: number): number {
    let score = explCompleteness;
    
    // Penalize if no feature attributions exist
    if (contributions.filter(c => c.type === 'FEATURE').length === 0) {
      score = Math.max(0, score - 30);
    }
    
    return score;
  }
}
