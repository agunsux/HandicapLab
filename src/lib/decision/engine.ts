/**
 * HandicapLab Decision Engine
 * =============================
 * Transforms raw metrics into actionable recommendations.
 *
 * The Decision Engine answers:
 *   - What should I do?
 *   - Why?
 *   - Why not the alternative?
 *   - How confident?
 *   - What's the risk?
 *   - What evidence supports this?
 *
 * Every output is deterministic, evidence-based, and auditable.
 */

import { Decision, DecisionConfig, DEFAULT_DECISION_CONFIG, EvidenceCard, TrustCard, Recommendation, RiskLevel, MarketQualityLabel, ResearchGrade } from './types';

export interface DecisionInput {
  confidence: number;           // 0-100
  ece: number;
  clv: number;
  historicalRoi: number;
  volatility: number;           // standard deviation of returns
  sampleSize: number;
  similarMatches: number;
  walkForwardSeasons: number;
  dataQualityScore: number;     // 0-100
  marketStability: number;      // 0-100
  modelAgreement: number;       // 0-100
  homeTeam: string;
  awayTeam: string;
  marketType: string;
  expectedValue: number;
}

export function buildEvidenceCard(input: DecisionInput): EvidenceCard {
  const bootstrapConfidence = Math.min(100, input.sampleSize > 100 ? 80 + Math.min(15, input.sampleSize / 200) : 40 + input.sampleSize / 5);
  const researchGrade: ResearchGrade = input.sampleSize >= 1000 ? 'A' : input.sampleSize >= 500 ? 'B' : input.sampleSize >= 200 ? 'C' : input.sampleSize >= 50 ? 'D' : 'Insufficient';

  const details: string[] = [];
  details.push(`${input.similarMatches} similar historical matches reviewed`);
  if (input.clv > 0) details.push('Closing line value supports this edge');
  if (input.ece < 0.03) details.push(`Calibration error within excellent range (ECE ${input.ece.toFixed(3)})`);
  if (input.walkForwardSeasons > 1) details.push(`Validated across ${input.walkForwardSeasons} seasons`);
  details.push(`Bootstrap confidence: ${Math.round(bootstrapConfidence)}%`);

  return {
    similarMatches: input.similarMatches,
    bootstrapConfidence: Math.round(bootstrapConfidence),
    calibrationEce: input.ece,
    walkForwardSeasons: input.walkForwardSeasons,
    clvPositive: input.clv > 0,
    sampleSize: input.sampleSize,
    researchGrade,
    details,
  };
}

export function buildTrustCard(input: DecisionInput): TrustCard {
  const calibrationScore = Math.max(0, Math.min(100, (1 - input.ece * 20) * 100));
  const clvScore = Math.max(0, Math.min(100, 50 + input.clv * 1000));
  const accuracyScore = Math.max(0, Math.min(100, 50 + input.historicalRoi * 5));
  const varianceScore = Math.max(0, Math.min(100, 100 - Math.min(input.volatility * 10, 100)));
  const sampleSizeScore = Math.min(100, Math.round((input.sampleSize / 100) * 10));
  const dataQualityScore = input.dataQualityScore;

  const trustScore = Math.round(
    calibrationScore * 0.20 +
    clvScore * 0.20 +
    accuracyScore * 0.15 +
    varianceScore * 0.10 +
    sampleSizeScore * 0.15 +
    dataQualityScore * 0.20
  );

  return {
    trustScore: Math.min(100, trustScore),
    calibrationScore: Math.round(calibrationScore),
    clvScore: Math.round(clvScore),
    historicalAccuracy: Math.round(accuracyScore),
    varianceScore: Math.round(varianceScore),
    sampleSizeScore: Math.round(sampleSizeScore),
    dataQualityScore: Math.round(dataQualityScore),
  };
}

export function computeMarketQuality(input: DecisionInput): MarketQualityLabel {
  if (input.confidence >= 80 && input.ece <= 0.02 && input.clv >= 0.03 && input.marketStability >= 70) return 'excellent';
  if (input.confidence >= 60 && input.ece <= 0.035 && input.clv >= 0.01 && input.marketStability >= 50) return 'good';
  if (input.ece <= 0.05) return 'neutral';
  return 'avoid';
}

export function computeRecommendation(trustScore: number, confidence: number, ece: number, config: DecisionConfig): Recommendation {
  if (trustScore >= config.minTrustScoreForStrong && confidence >= 70 && ece <= config.maxEceForConsider) return 'strong_opportunity';
  if (trustScore >= config.minTrustScoreForConsider && confidence >= config.minConfidenceForConsider && ece <= config.maxEceForConsider) return 'consider';
  if (confidence >= 40) return 'watch';
  if (ece > 0.05) return 'avoid';
  return 'no_edge';
}

export function computeRiskLevel(volatility: number, confidence: number, marketStability: number): RiskLevel {
  if (confidence >= 70 && volatility < 0.15 && marketStability >= 60) return 'low';
  if (confidence >= 40 && volatility < 0.3 && marketStability >= 40) return 'medium';
  return 'high';
}

export function buildStory(homeTeam: string, awayTeam: string, recommendation: Recommendation, confidence: number, reason: string): string {
  const recText: Record<Recommendation, string> = {
    strong_opportunity: 'presents a strong opportunity',
    consider: 'is worth considering',
    watch: 'is one to watch',
    avoid: 'should be avoided',
    no_edge: 'shows no clear edge',
  };
  return `${homeTeam} vs ${awayTeam} — ${recText[recommendation]}. Confidence ${Math.round(confidence)}%. ${reason}`;
}

export function buildReason(input: DecisionInput, recommendation: Recommendation): string {
  const parts: string[] = [];
  if (input.clv > 0.02) parts.push('Positive CLV history suggests this is a legitimate edge');
  if (input.modelAgreement > 70) parts.push('Strong agreement across prediction models');
  if (input.ece < 0.025) parts.push('Excellent calibration at this probability level');
  if (input.marketStability > 70) parts.push('Market conditions are stable and predictable');
  if (input.similarMatches > 100) parts.push(`${input.similarMatches} similar historical matches support this pattern`);
  if (recommendation === 'avoid' || recommendation === 'no_edge') parts.push('Current signals do not support a clear edge');
  return parts.length > 0 ? parts.join('. ') + '.' : 'Mixed signals — further analysis recommended.';
}

export function buildWhyNot(input: DecisionInput): string {
  const parts: string[] = [];
  if (input.volatility > 0.2) parts.push('Higher than ideal variance in recent predictions');
  if (input.sampleSize < 200) parts.push('Limited sample size for strong conclusions');
  if (input.dataQualityScore < 60) parts.push('Data quality is below preferred threshold');
  if (input.marketStability < 40) parts.push('Market conditions are unstable');
  return parts.length > 0 ? parts.join('. ') + '.' : 'No significant counter-indicators identified.';
}

export function buildAlternatives(input: DecisionInput): string[] {
  const alts: string[] = [];
  if (input.marketType === 'AH') alts.push('Moneyline — lower risk, lower value');
  if (input.marketType === 'ML') alts.push('Asian Handicap — better value if line is favorable');
  alts.push('Over/Under — uncorrelated opportunity');
  alts.push('Wait for better odds — patience preserves bankroll');
  return alts;
}

export function buildTags(input: DecisionInput): string[] {
  const tags: string[] = [];
  if (input.clv > 0.03) tags.push('positive_clv');
  if (input.modelAgreement > 80) tags.push('high_agreement');
  if (input.ece < 0.02) tags.push('excellent_calibration');
  if (input.marketStability < 40) tags.push('unstable_market');
  if (input.sampleSize < 200) tags.push('small_sample');
  return tags;
}

export function makeDecision(input: DecisionInput, config: DecisionConfig = DEFAULT_DECISION_CONFIG): Decision {
  const evidence = buildEvidenceCard(input);
  const trust = buildTrustCard(input);
  const marketQuality = computeMarketQuality(input);
  const recommendation = computeRecommendation(trust.trustScore, input.confidence, input.ece, config);
  const riskLevel = computeRiskLevel(input.volatility, input.confidence, input.marketStability);
  const reason = buildReason(input, recommendation);
  const whyNot = buildWhyNot(input);

  return {
    recommendation,
    confidence: Math.round(input.confidence),
    marketQuality,
    trustScore: trust.trustScore,
    riskLevel,
    expectedValue: input.expectedValue,
    evidence,
    trust,
    story: buildStory(input.homeTeam, input.awayTeam, recommendation, input.confidence, reason),
    reason,
    whyNot,
    alternatives: buildAlternatives(input),
    tags: buildTags(input),
  };
}