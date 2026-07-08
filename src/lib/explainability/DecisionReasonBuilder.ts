import { DecisionObject } from '../decision/DecisionObject';

export class DecisionReasonBuilder {
  /**
   * Translates DecisionObject reasoning and blocking flags into a plain-language narrative.
   */
  static build(decisionObject: DecisionObject): string {
    const { decision, reasoning, blocking_flags } = decisionObject;

    if (decision === 'BET') {
      const reasons = reasoning.length > 0 ? reasoning.join(' ') : 'All decision gates passed successfully.';
      return `The recommendation was accepted because ${reasons.toLowerCase()}`;
    }

    if (decision === 'NO_BET' || decision === 'WAIT' || decision === 'INCONCLUSIVE') {
      let narrative = `The recommendation was ${decision === 'NO_BET' ? 'rejected' : decision.toLowerCase()}. `;
      
      if (blocking_flags.length > 0) {
        narrative += `The following decision gates failed: ${blocking_flags.join(', ').replace(/_/g, ' ')}. `;
      }
      
      if (reasoning.length > 0) {
        narrative += `Specifically: ${reasoning.join(' ')}`;
      }
      
      return narrative.trim();
    }

    return 'Decision reasoning is unavailable.';
  }
}
