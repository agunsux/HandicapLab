/**
 * Versioned Configuration for Governance Policies
 */

export interface GovernancePolicy {
  policy_version: string; // e.g. "v1.2.0"
  minimum_health: number;
  minimum_reliability: number;
  minimum_confidence: number;
  
  // Weights for soft rules
  weights: {
    health: number;
    reliability: number;
    evidence: number;
  };
}

export class GovernanceConfigProvider {
  /**
   * Retrieves the governance policy active at the given timestamp.
   * Hardcoded for Phase 2 scaffold.
   */
  static getActivePolicy(timestamp?: string): GovernancePolicy {
    return {
      policy_version: 'v1.0.0',
      minimum_health: 80,
      minimum_reliability: 60,
      minimum_confidence: 0.70,
      weights: {
        health: 0.4,
        reliability: 0.4,
        evidence: 0.2
      }
    };
  }
}
