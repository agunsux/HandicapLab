/**
 * HandicapLab — Decision Intelligence Platform (EPIC 20)
 * =========================================================
 * Complete decision-making infrastructure.
 */

export { DECISION_INTELLIGENCE_VERSION } from './types';
export type {
  PolicyId, DecisionPolicy, DecisionInput, DecisionStageLog,
  EVResult, StakeResult, RiskProfile, PortfolioConstraint, PortfolioAllocation,
  DecisionExplanation, ConsistencyResult,
  AttributionResult, AttributionReport,
  DecisionArtifact, DecisionReport,
  ChampionDecisionCriteria, ChampionDecisionGateResult, ChampionDecisionGateDecision,
} from './types';

export { PolicyRegistry, defaultPolicyRegistry } from './policies';
export { DecisionPipeline, defaultDecisionPipeline } from './decisionPipeline';
export { EVLaboratory, defaultEVLaboratory } from './evLaboratory';
export { RiskEngine, defaultRiskEngine } from './riskEngine';
export { PortfolioOptimizer, defaultPortfolioOptimizer } from './portfolioOptimizer';
export { ConsistencyEngine, defaultConsistencyEngine } from './consistencyEngine';
export { AttributionEngine, defaultAttributionEngine } from './attributionEngine';
export { DecisionArtifactIntegration, defaultDecisionArtifactIntegration } from './artifactIntegration';
export { ChampionDecisionGate, defaultChampionDecisionGate } from './championDecisionGate';
export { DecisionReportGenerator, defaultDecisionReportGenerator } from './reporting';