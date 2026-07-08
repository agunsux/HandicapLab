import { RuleResult } from '../types';
import { GovernancePolicy } from './GovernancePolicy';

export class ReliabilityScoreRule {
  static evaluate(evidence: any, config: GovernancePolicy): RuleResult {
    // Evidence from M5 containing Reliability scores
    const averageReliability = evidence?.averageReliability ?? 0;
    const threshold = config.minimum_reliability;

    if (averageReliability < threshold) {
      return {
        status: 'VETO',
        code: 'GV002_RELIABILITY_TOO_LOW',
        reason: `Driver reliability (${averageReliability}) is below the required minimum (${threshold}).`,
        provenance: this.getProvenance(config)
      };
    }

    // Soft Scoring: Add up to 20 confidence points based on how far above the threshold we are
    const maxBonus = 20;
    const scoreAdjustment = Math.min(maxBonus, Math.round(((averageReliability - threshold) / (100 - threshold)) * maxBonus));

    return {
      status: 'SCORE',
      code: 'GV201_SCORE_ADJUSTMENT',
      scoreAdjustment,
      reason: `High reliability drivers present (+${scoreAdjustment} confidence).`,
      provenance: this.getProvenance(config)
    };
  }

  private static getProvenance(config: GovernancePolicy) {
    return {
      rule_id: 'RULE_RELIABILITY_SCORE',
      rule_version: '1.0.0',
      configuration_version: config.policy_version,
      execution_time_ms: Date.now()
    };
  }
}
