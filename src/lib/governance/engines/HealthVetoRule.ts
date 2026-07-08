import { RuleResult } from '../types';
import { GovernancePolicy } from './GovernancePolicy';

export class HealthVetoRule {
  static evaluate(health: any, config: GovernancePolicy): RuleResult {
    // Health object in M3 is out of scope for strict typing here, we assume it has an overallScore
    const overallScore = health?.overallScore ?? 0;
    const threshold = config.minimum_health;

    if (overallScore < threshold) {
      return {
        status: 'VETO',
        code: 'GV001_HEALTH_BELOW_THRESHOLD',
        reason: `System health (${overallScore}) is below the required minimum (${threshold}).`,
        provenance: this.getProvenance(config)
      };
    }

    return {
      status: 'PASS',
      code: 'GV200_APPROVED',
      reason: `System health (${overallScore}) meets the minimum threshold.`,
      provenance: this.getProvenance(config)
    };
  }

  private static getProvenance(config: GovernancePolicy) {
    return {
      rule_id: 'RULE_HEALTH_VETO',
      rule_version: '1.0.0',
      configuration_version: config.policy_version,
      execution_time_ms: Date.now() // Mock timestamp for execution
    };
  }
}
