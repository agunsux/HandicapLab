// HandicapLab Decision Engine v1 - Recommendation Engine
// Location: src/lib/engines/decision-engine-v1/recommendation-engine.ts

import { PredictionFeatures } from '../../market-intelligence/types';
import { MatchFeatures } from '../feature-engine/types';
import { EnsemblePrediction } from './ensemble-engine';
import { ValueEngine } from './value-engine';
import { RiskEngine } from './risk-engine';

export interface RecommendationOutput {
  matchId: string;
  market: string;
  probability: number;
  fairOdds: number;
  marketOdds: number;
  edge: number;
  expectedValue: number;
  kellyFraction: number;
  recommendedStake: number;
  finalConfidence: number; // Combined Model + Market Confidence
  disagreementScore: number;
  recommendationScore: number; // Continuous score (0-100)
  decision: 'Premium Bet' | 'Value Bet' | 'Lean' | 'NO BET';
  reasons: string[];
}

export class RecommendationEngine {
  /**
   * Generates intelligent betting recommendations using score-based evaluations.
   */
  public static generate(
    features: MatchFeatures,
    ensemble: EnsemblePrediction,
    marketFeatures: PredictionFeatures,
    marketOdds: number,
    marketSelection: 'home' | 'draw' | 'away',
    marketName: string,
    kellyMultiplier: number = 0.25
  ): RecommendationOutput {
    // 1. Calculate probability of the targeted selection
    let prob = ensemble.pHome;
    if (marketSelection === 'draw') prob = ensemble.pDraw;
    else if (marketSelection === 'away') prob = ensemble.pAway;

    // 2. Evaluate EV
    const value = ValueEngine.calculate(prob, marketOdds);

    // 3. Evaluate Risk / Kelly fraction
    const risk = RiskEngine.calculateKellyFraction(prob, marketOdds, kellyMultiplier);

    // 4. Combine Model + Market Confidence
    const finalConfidence = Math.round((ensemble.modelConfidence + marketFeatures.marketConfidence) / 2);

    // 5. Compute the continuous Recommendation Score (0-100)
    // Score = EV + Expected_CLV + Confidence + Market_Agreement + Liquidity - Disagreement
    const evFactor = Math.max(-20, Math.min(20, value.expectedValue * 2)); // EV scaled up
    const clvExpectation = marketFeatures.steamScore > 50 ? 10 : 0; // proxy expected CLV from steam
    const confidenceFactor = finalConfidence * 0.4; // up to 40 points
    const marketAgreement = (100 - ensemble.disagreementScore) * 0.2; // up to 20 points
    const liquidityBonus = features.leagueId === '39' ? 10 : 5; // e.g. EPL is high liquidity
    const disagreementPenalty = ensemble.disagreementScore * 0.2; // penalty for model dispute

    const rawScore = evFactor + clvExpectation + confidenceFactor + marketAgreement + liquidityBonus - disagreementPenalty;
    const recommendationScore = Math.round(Math.max(0, Math.min(100, rawScore)));

    // 6. Map to Tiers
    let decision: 'Premium Bet' | 'Value Bet' | 'Lean' | 'NO BET' = 'NO BET';
    if (recommendationScore >= 81) {
      decision = 'Premium Bet';
    } else if (recommendationScore >= 61) {
      decision = 'Value Bet';
    } else if (recommendationScore >= 41) {
      decision = 'Lean';
    }

    // 7. Reject bet if EV is negative
    if (value.expectedValue <= 0) {
      decision = 'NO BET';
    }

    // 8. Generate reason codes
    const reasons: string[] = [];
    if (value.expectedValue > 5) reasons.push('High EV detected');
    if (marketFeatures.steamScore > 60) reasons.push('Steam Move alignment');
    if (ensemble.disagreementScore < 15) reasons.push('High model consensus');
    if (finalConfidence > 80) reasons.push('High composite confidence');

    return {
      matchId: features.matchId,
      market: marketName,
      probability: prob,
      fairOdds: value.fairOdds,
      marketOdds,
      edge: value.edge,
      expectedValue: value.expectedValue,
      kellyFraction: risk.kellyFraction,
      recommendedStake: risk.recommendedStake,
      finalConfidence,
      disagreementScore: ensemble.disagreementScore,
      recommendationScore,
      decision,
      reasons
    };
  }
}
