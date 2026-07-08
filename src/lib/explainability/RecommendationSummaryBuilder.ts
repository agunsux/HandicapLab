import { DecisionObject } from '../decision/DecisionObject';

export class RecommendationSummaryBuilder {
  /**
   * Generates a short, single-sentence summary of the final recommendation.
   */
  static build(decisionObject: DecisionObject): string {
    const { decision, expected_value, confidence } = decisionObject;
    const confidencePct = confidence ? (confidence * 100).toFixed(0) + '%' : 'unknown';
    const evPct = expected_value ? (expected_value * 100).toFixed(1) + '%' : 'unknown';

    switch (decision) {
      case 'BET':
        return `STRONG SIGNAL: Recommend to bet with ${confidencePct} confidence (Expected Value: ${evPct}).`;
      case 'NO_BET':
        return `WEAK SIGNAL: Recommend to skip. Signal strength or expected value is insufficient.`;
      case 'INCONCLUSIVE':
        return `INCONCLUSIVE: Conflicting evidence or severe uncertainty prevents a clear recommendation.`;
      case 'WAIT':
        return `WAIT: Expected value may improve or more data is required before placing a bet.`;
      default:
        return `Recommendation status is unknown.`;
    }
  }
}
