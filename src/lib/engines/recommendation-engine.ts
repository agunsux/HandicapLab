// HandicapLab Recommendation Engine
// Location: src/lib/engines/recommendation-engine.ts

import { DecisionOutput } from './decision-engine';

export interface RecommendationOutput {
  match_id: string;
  market: string;
  probability: number;
  calibrated_probability: number;
  fair_odds: number;
  market_odds: number;
  edge: number;
  expected_value: number;
  kelly_fraction: number; // e.g. 0.017
  recommended_stake: number; // e.g. 1.4 (%)
  confidence_score: number;
  confidence_label: string;
  risk: 'Low' | 'Medium' | 'High';
  decision: 'NO_ACTION' | 'WATCH' | 'VALUE' | 'STRONG_VALUE' | 'AVOID';
  reasoning: string[];
}

export class RecommendationEngine {
  /**
   * Deterministically calculates stake sizes and aggregates reasoning statements.
   */
  public static generateRecommendation(
    decision: DecisionOutput,
    rawProb: number,
    calibratedProb: number,
    kellyMultiplier: number = 0.25
  ): RecommendationOutput {
    const odds = decision.marketOdds;
    
    // Calculate Kelly Fraction: f* = (p * b - 1) / (b - 1)
    let kellyFraction = 0.0;
    let recommendedStake = 0.0;

    if (decision.decision === 'VALUE' || decision.decision === 'STRONG_VALUE') {
      if (odds > 1.0) {
        const rawKelly = (calibratedProb * odds - 1) / (odds - 1);
        kellyFraction = Math.max(0, Number(rawKelly.toFixed(4)));
        recommendedStake = Math.max(0, Number((kellyFraction * kellyMultiplier * 100).toFixed(2)));
      }
    }

    // Generate human-readable reasons based on values
    const reasoning: string[] = [];
    if (decision.decision === 'STRONG_VALUE') {
      reasoning.push(`Model identifies a strong statistical value with an expected edge of ${decision.edge}%.`);
      reasoning.push(`High confidence level (${decision.confidence_score}%) warrants a recommended stake of ${recommendedStake}%.`);
    } else if (decision.decision === 'VALUE') {
      reasoning.push(`Model identified standard value edge of ${decision.edge}%.`);
      reasoning.push(`Confidence is acceptable at ${decision.confidence_label}.`);
    } else if (decision.decision === 'WATCH') {
      reasoning.push(`Marginal value detected (${decision.edge}% edge). Place on watchlist.`);
    } else if (decision.decision === 'AVOID') {
      reasoning.push(`Negative expected value or very low data confidence indicates this market should be avoided.`);
    } else {
      reasoning.push(`No active market edge identified.`);
    }

    return {
      match_id: decision.matchId,
      market: decision.market,
      probability: Number(rawProb.toFixed(3)),
      calibrated_probability: Number(calibratedProb.toFixed(3)),
      fair_odds: decision.fairOdds,
      market_odds: decision.marketOdds,
      edge: decision.edge,
      expected_value: decision.expectedValue,
      kelly_fraction: kellyFraction,
      recommended_stake: recommendedStake,
      confidence_score: decision.confidence_score,
      confidence_label: decision.confidence_label,
      risk: decision.risk,
      decision: decision.decision,
      reasoning
    };
  }
}
