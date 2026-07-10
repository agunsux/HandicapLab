/**
 * HandicapLab Decision Engine — Core Types
 * ==========================================
 * The Decision Layer transforms raw metrics into actionable recommendations.
 *
 * Output is NOT "probability 0.65".
 * Output IS "Consider Asian Handicap -0.25. Confidence 84%. Risk Medium."
 *
 * Every decision is deterministic, evidence-based, and auditable.
 */

export type Recommendation = 'strong_opportunity' | 'consider' | 'watch' | 'avoid' | 'no_edge';

export type RiskLevel = 'low' | 'medium' | 'high';

export type MarketQualityLabel = 'excellent' | 'good' | 'neutral' | 'avoid';

export type ResearchGrade = 'A' | 'B' | 'C' | 'D' | 'Insufficient';

// ─── Evidence Card ──────────────────────────────────────────────────────

export interface EvidenceCard {
  similarMatches: number;
  bootstrapConfidence: number;    // 0-100
  calibrationEce: number;
  walkForwardSeasons: number;
  clvPositive: boolean;
  sampleSize: number;
  researchGrade: ResearchGrade;
  details: string[];
}

// ─── Trust Card ─────────────────────────────────────────────────────────

export interface TrustCard {
  trustScore: number;             // 0-100
  calibrationScore: number;
  clvScore: number;
  historicalAccuracy: number;
  varianceScore: number;
  sampleSizeScore: number;
  dataQualityScore: number;
}

// ─── Decision ───────────────────────────────────────────────────────────

export interface Decision {
  recommendation: Recommendation;
  confidence: number;             // 0-100
  marketQuality: MarketQualityLabel;
  trustScore: number;             // 0-100
  riskLevel: RiskLevel;
  expectedValue: number;
  evidence: EvidenceCard;
  trust: TrustCard;
  story: string;                  // Narrative summary (deterministic)
  reason: string;                 // Why this recommendation
  whyNot: string;                 // Why not the alternative
  alternatives: string[];         // Other options considered
  tags: string[];                 // e.g. ['home_favored', 'market_overreaction']
}

// ─── Decision Config ────────────────────────────────────────────────────

export interface DecisionConfig {
  minTrustScoreForConsider: number;
  minTrustScoreForStrong: number;
  maxEceForConsider: number;
  minConfidenceForConsider: number;
  minSimilarMatches: number;
  minSampleSizeForGradeA: number;
  minSampleSizeForGradeB: number;
}

export const DEFAULT_DECISION_CONFIG: DecisionConfig = {
  minTrustScoreForConsider: 60,
  minTrustScoreForStrong: 80,
  maxEceForConsider: 0.04,
  minConfidenceForConsider: 55,
  minSimilarMatches: 50,
  minSampleSizeForGradeA: 1000,
  minSampleSizeForGradeB: 500,
};