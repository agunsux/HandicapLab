export { makeDecision, buildEvidenceCard, buildTrustCard, buildStory } from './engine';
export type { DecisionInput } from './engine';

export type {
  Decision, EvidenceCard, TrustCard, Recommendation,
  MarketQualityLabel as MQLabel, ResearchGrade, DecisionConfig, RiskLevel as RiskLevelType,
} from './types';
export { DEFAULT_DECISION_CONFIG } from './types';

export { DecisionSerializer } from './serializer';
export type { SerializedDecision } from './serializer';

export { buildFullStory } from './storyEngine';
export type { StoryContext } from './storyEngine';

export { getAlternatives } from './alternativeEngine';
export type { AlternativeRecommendation } from './alternativeEngine';

export { assessRisk } from './riskLayer';
export type { RiskAssessment, RiskFactor } from './riskLayer';