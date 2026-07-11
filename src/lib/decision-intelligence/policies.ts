/**
 * EPIC 20.1 — Decision Policy Registry
 */

import type { DecisionPolicy, PolicyId } from './types';

const DEFAULT_POLICIES: readonly DecisionPolicy[] = [
  { policyId: 'conservative', version: '1.0.0', description: 'Low risk, high confidence only', minEdge: 0.05, minConfidence: 0.75, maxRiskPerBet: 0.02, marketRestrictions: ['ML'], stakeSizingMethod: 'fractional_kelly', portfolioRules: ['max_5_per_league'], maxPortfolioExposure: 0.25, maxConcurrentBets: 10 },
  { policyId: 'balanced', version: '1.0.0', description: 'Moderate risk, research-backed', minEdge: 0.03, minConfidence: 0.6, maxRiskPerBet: 0.04, marketRestrictions: ['ML', 'AH', 'OU'], stakeSizingMethod: 'kelly', portfolioRules: ['max_8_per_league'], maxPortfolioExposure: 0.4, maxConcurrentBets: 20 },
  { policyId: 'aggressive', version: '1.0.0', description: 'Higher risk tolerance', minEdge: 0.01, minConfidence: 0.4, maxRiskPerBet: 0.08, marketRestrictions: ['ML', 'AH', 'OU', 'BTTS'], stakeSizingMethod: 'kelly', portfolioRules: ['max_15_per_league'], maxPortfolioExposure: 0.6, maxConcurrentBets: 40 },
  { policyId: 'value_only', version: '1.0.0', description: 'Only positive EV bets', minEdge: 0.02, minConfidence: 0.5, maxRiskPerBet: 0.03, marketRestrictions: ['ML', 'AH'], stakeSizingMethod: 'flat', portfolioRules: ['max_10_per_league'], maxPortfolioExposure: 0.3, maxConcurrentBets: 15 },
  { policyId: 'high_confidence', version: '1.0.0', description: 'Only bets with high confidence', minEdge: 0.02, minConfidence: 0.85, maxRiskPerBet: 0.05, marketRestrictions: ['ML'], stakeSizingMethod: 'fractional_kelly', portfolioRules: ['max_3_per_league'], maxPortfolioExposure: 0.2, maxConcurrentBets: 5 },
  { policyId: 'market_neutral', version: '1.0.0', description: 'Market-neutral positioning', minEdge: 0.01, minConfidence: 0.3, maxRiskPerBet: 0.02, marketRestrictions: ['ML'], stakeSizingMethod: 'flat', portfolioRules: ['hedge_required'], maxPortfolioExposure: 0.15, maxConcurrentBets: 50 },
  { policyId: 'research_mode', version: '1.0.0', description: 'All bets tracked, minimal stake', minEdge: 0, minConfidence: 0, maxRiskPerBet: 0.01, marketRestrictions: [], stakeSizingMethod: 'flat', portfolioRules: ['research_only'], maxPortfolioExposure: 0.05, maxConcurrentBets: 100 },
  { policyId: 'simulation_mode', version: '1.0.0', description: 'Paper trading, no real stake', minEdge: 0, minConfidence: 0, maxRiskPerBet: 0, marketRestrictions: [], stakeSizingMethod: 'flat', portfolioRules: ['simulation'], maxPortfolioExposure: 0, maxConcurrentBets: 0 },
];

export class PolicyRegistry {
  private readonly policies = new Map<PolicyId, DecisionPolicy>();

  constructor(policies: readonly DecisionPolicy[] = DEFAULT_POLICIES) {
    for (const p of policies) this.policies.set(p.policyId, p);
  }

  get(id: PolicyId): DecisionPolicy | undefined {
    return this.policies.get(id);
  }

  getAll(): readonly DecisionPolicy[] {
    return Array.from(this.policies.values());
  }

  register(policy: DecisionPolicy): void {
    this.policies.set(policy.policyId, policy);
  }
}

export const defaultPolicyRegistry = new PolicyRegistry();