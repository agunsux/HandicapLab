import { GovernanceEnginePlugin, GovernanceVerdict, RuleResult } from '../types';
import { GovernanceConfigProvider, GovernancePolicy } from './GovernancePolicy';
import { HealthVetoRule } from './HealthVetoRule';
import { ReliabilityScoreRule } from './ReliabilityScoreRule';

export class RuleBasedGovernance implements GovernanceEnginePlugin {
  
  evaluate(
    prediction: Readonly<any>, 
    health: Readonly<any>, 
    evidence: Readonly<any>, 
    configVersion: string
  ) {
    const config = GovernanceConfigProvider.getActivePolicy(configVersion);
    const ruleResults: RuleResult[] = [];
    
    // 1. Evaluate Hard Rules (Veto)
    const healthResult = HealthVetoRule.evaluate(health, config);
    ruleResults.push(healthResult);

    if (healthResult.status === 'VETO') {
      return this.buildRejection(ruleResults, healthResult.reason);
    }

    // 2. Evaluate Soft Rules (Score)
    const reliabilityResult = ReliabilityScoreRule.evaluate(evidence, config);
    ruleResults.push(reliabilityResult);

    if (reliabilityResult.status === 'VETO') {
      return this.buildRejection(ruleResults, reliabilityResult.reason);
    }

    // 3. Calculate Decision Confidence (Distinct from Prediction Confidence)
    // Base confidence starts at 50, modified by soft scoring rules
    let decisionConfidence = 50;
    for (const res of ruleResults) {
      if (res.status === 'SCORE' && res.scoreAdjustment) {
        decisionConfidence += res.scoreAdjustment;
      }
    }

    // 4. Final Threshold Gate
    // Governance is Conservative: Do not execute if decision confidence is below the target.
    const targetConfidence = config.minimum_confidence * 100;
    if (decisionConfidence < targetConfidence) {
       return this.buildRejection(ruleResults, `Governance confidence (${decisionConfidence}) failed to meet target (${targetConfidence}).`);
    }

    return {
      verdict: 'EXECUTE' as GovernanceVerdict,
      decisionConfidence,
      ruleResults,
      explanation: `Approved with decision confidence ${decisionConfidence}.`
    };
  }

  private buildRejection(ruleResults: RuleResult[], explanation: string) {
    return {
      verdict: 'REJECT' as GovernanceVerdict,
      decisionConfidence: 0,
      ruleResults,
      explanation
    };
  }
}
