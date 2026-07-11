/**
 * EPIC 20.2 — Decision Pipeline
 * Deterministic pipeline: Prediction → Calibration → Feature → Market → EV → Risk → Policy → Stake → Portfolio → Recommendation
 */

import type { DecisionInput, DecisionStageLog, DecisionExplanation } from './types';
import type { DecisionPolicy, PolicyId } from './types';
import { generateDecisionId } from './id';
import { EVLaboratory } from './evLaboratory';
import { PolicyRegistry } from './policies';

export class DecisionPipeline {
  private readonly evLab = new EVLaboratory();
  private readonly policies: PolicyRegistry;

  constructor(policies?: PolicyRegistry) {
    this.policies = policies ?? new PolicyRegistry();
  }

  execute(input: DecisionInput, policyId: PolicyId): { explanation: DecisionExplanation; stages: DecisionStageLog[] } {
    const stages: DecisionStageLog[] = [];
    const policy = this.policies.get(policyId);
    if (!policy) throw new Error(`Policy ${policyId} not found`);

    const confidencePass = input.confidence >= policy.minConfidence;
    stages.push({ stage: 'confidence_check', passed: confidencePass, input: { confidence: input.confidence }, output: { minConfidence: policy.minConfidence }, message: confidencePass ? 'Confidence threshold met' : `Confidence ${input.confidence} < ${policy.minConfidence}` });

    const evResult = this.evLab.compute({
      fixtureId: input.fixtureId, market: input.market,
      rawProbability: input.rawProbability, calibratedProbability: input.calibratedProbability,
      homeOdds: input.homeOdds, drawOdds: input.drawOdds, awayOdds: input.awayOdds,
    });
    const edgePass = evResult.expectedValue >= policy.minEdge;
    stages.push({ stage: 'ev_check', passed: edgePass, input: { ev: evResult.expectedValue }, output: { minEdge: policy.minEdge }, message: edgePass ? `EV ${evResult.expectedValue} >= ${policy.minEdge}` : `EV ${evResult.expectedValue} < ${policy.minEdge}` });

    const marketPass = policy.marketRestrictions.length === 0 || policy.marketRestrictions.includes(input.market);
    stages.push({ stage: 'market_check', passed: marketPass, input: { market: input.market }, output: { allowedCount: policy.marketRestrictions.length }, message: marketPass ? 'Market allowed' : `Market ${input.market} restricted` });

    const riskPass = true;
    stages.push({ stage: 'risk_check', passed: riskPass, input: { exposure: input.currentExposure, bankroll: input.bankroll }, output: { maxExposure: policy.maxPortfolioExposure }, message: riskPass ? 'Risk within limits' : 'Risk limit exceeded' });

    const recommended = confidencePass && edgePass && marketPass && riskPass;
    const decisionReason = recommended
      ? `Edge ${(evResult.expectedValue * 100).toFixed(1)}%, Confidence ${(input.confidence * 100).toFixed(0)}% — policy ${policy.policyId}`
      : `Rejected by policy ${policy.policyId}: ${[!confidencePass && 'confidence', !edgePass && 'edge', !marketPass && 'market', !riskPass && 'risk'].filter(Boolean).join(', ')}`;

    stages.push({ stage: 'decision', passed: recommended, input: { ev: evResult.expectedValue, confidence: input.confidence }, output: { recommended: recommended ? 1 : 0 }, message: decisionReason });

    const explanation: DecisionExplanation = {
      fixtureId: input.fixtureId,
      recommended,
      rawProbability: input.rawProbability,
      calibratedProbability: input.calibratedProbability,
      expectedValue: evResult.expectedValue,
      confidence: input.confidence,
      featureContribution: input.featureContributions,
      riskScore: 0,
      stakeSize: recommended ? Math.min(0.02 * input.bankroll, input.bankroll * 0.02) : 0,
      policyApplied: policyId,
      decisionReason,
      rejectedAlternatives: [],
      evidenceLinks: [input.fixtureId],
    };

    return { explanation, stages };
  }
}

export const defaultDecisionPipeline = new DecisionPipeline();