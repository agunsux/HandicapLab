// HandicapLab Decision Engine v1 - Recommendation Engine
// Location: src/lib/engines/decision-engine-v1/recommendation-engine.ts

import { PredictionFeatures } from '../../market-intelligence/types';
import { MatchFeatures } from '../feature-engine/types';
import { EnsemblePrediction } from './ensemble-engine';
import { ValueEngine } from './value-engine';
import { RiskEngine } from './risk-engine';
import { SHAPContribution, ExplainabilityEngine } from './explainability-engine';

export interface RecommendationOutput {
  prediction: string;
  probability: number;
  fairOdds: number;
  marketOdds: number;
  expectedValue: number;
  edge: number;
  confidence: number; // Combined Model + Market Confidence
  riskScore: number; // continuous risk score (0-100)
  recommendationScore: number; // Continuous score (0-100)
  recommendation: 'NO BET' | 'LEAN' | 'VALUE BET' | 'PREMIUM BET';
  reasonCodes: string[];
  featureContributions: SHAPContribution[];
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

    // 3. Evaluate Kelly stake fraction
    const kelly = RiskEngine.calculateKellyFraction(prob, marketOdds, kellyMultiplier);

    // 4. Combine Model + Market Confidence
    const finalConfidence = Math.round((ensemble.modelConfidence + marketFeatures.marketConfidence) / 2);

    // 5. Evaluate Risk Score (0-100)
    const riskScore = RiskEngine.calculateRiskScore(
      ensemble.disagreementScore,
      marketFeatures.steamScore,
      marketFeatures.marketRegime,
      kelly.kellyFraction
    );

    // 6. Compute the continuous Recommendation Score (0-100)
    // Score = EV + Confidence + Market Agreement + Steam Confirmation + Calibration Quality - Variance - Disagreement - Market Risk
    const evFactor = Math.max(-20, Math.min(20, value.expectedValue * 2));
    const steamConfirmation = marketFeatures.steamScore > 50 ? 10 : 0;
    const confidenceFactor = finalConfidence * 0.4;
    const marketAgreement = (100 - ensemble.disagreementScore) * 0.2;
    const liquidityBonus = features.leagueId === '39' ? 10 : 5;
    const disagreementPenalty = ensemble.disagreementScore * 0.2;
    const riskPenalty = riskScore * 0.1;

    const rawScore = evFactor + steamConfirmation + confidenceFactor + marketAgreement + liquidityBonus - disagreementPenalty - riskPenalty;
    const recommendationScore = Math.round(Math.max(0, Math.min(100, rawScore)));

    // 7. Map to Tiers
    let recommendation: 'NO BET' | 'LEAN' | 'VALUE BET' | 'PREMIUM BET' = 'NO BET';
    if (recommendationScore >= 81) {
      recommendation = 'PREMIUM BET';
    } else if (recommendationScore >= 61) {
      recommendation = 'VALUE BET';
    } else if (recommendationScore >= 41) {
      recommendation = 'LEAN';
    }

    // 8. Strict EV / Steam filter rejection
    if (value.expectedValue <= 0) {
      recommendation = 'NO BET';
    }

    // 9. Generate reason codes
    const reasonCodes: string[] = [];
    if (value.expectedValue > 5) reasonCodes.push('Positive Expected Value');
    if (marketFeatures.steamScore > 60) reasonCodes.push('Steam Confirmed');
    if (ensemble.disagreementScore < 15) reasonCodes.push('Low Model Disagreement');
    if (finalConfidence > 80) reasonCodes.push('High composite confidence');

    // 10. Generate SHAP explainability contributions
    const featureContributions = ExplainabilityEngine.explain(features);

    return {
      prediction: marketName,
      probability: prob,
      fairOdds: value.fairOdds,
      marketOdds,
      expectedValue: value.expectedValue,
      edge: value.edge,
      confidence: finalConfidence,
      riskScore,
      recommendationScore,
      recommendation,
      reasonCodes,
      featureContributions
    };
  }
}
