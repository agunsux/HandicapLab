// HandicapLab Decision Engine
// Location: src/lib/engines/decision-engine/index.ts

import { EdgeOutput } from '../edge-engine';

export interface DecisionOutput {
  matchId: string;
  market: string;
  expectedValue: number;
  confidence_score: number; // 0-100
  confidence_label: 'Very High' | 'High' | 'Medium' | 'Low' | 'Very Low';
  risk: 'Low' | 'Medium' | 'High';
  edge: number;
  fairOdds: number;
  marketOdds: number;
  decision: 'NO_ACTION' | 'WATCH' | 'VALUE' | 'STRONG_VALUE' | 'AVOID';
}

export class DecisionEngine {
  /**
   * Deterministically evaluates an Edge to produce a Decision.
   * Input is completely stateless. No random variables or Date.now().
   */
  public static evaluateDecision(
    matchId: string,
    edge: EdgeOutput,
    modelConfidenceScore: number, // 0.0 - 1.0
    dataQualityScore: number // 0.0 - 1.0
  ): DecisionOutput {
    // Confidence Score: scale 0-100 from model confidence and data quality
    const calculatedScore = Math.max(0, Math.min(100, Math.round(((modelConfidenceScore * 0.7) + (dataQualityScore * 0.3)) * 100)));

    // Confidence Label
    let confidence_label: 'Very High' | 'High' | 'Medium' | 'Low' | 'Very Low';
    if (calculatedScore >= 80) {
      confidence_label = 'Very High';
    } else if (calculatedScore >= 60) {
      confidence_label = 'High';
    } else if (calculatedScore >= 40) {
      confidence_label = 'Medium';
    } else if (calculatedScore >= 20) {
      confidence_label = 'Low';
    } else {
      confidence_label = 'Very Low';
    }

    // Risk calculation based on bookmaker odds and model confidence
    // High odds or low confidence indicates high risk.
    let risk: 'Low' | 'Medium' | 'High' = 'Medium';
    if (edge.current_odds > 3.0 || calculatedScore < 40) {
      risk = 'High';
    } else if (edge.current_odds < 1.7 && calculatedScore > 60) {
      risk = 'Low';
    }

    // Decision rule logic (deterministic):
    // STRONG_VALUE: EV > 8.0% and Confidence >= High
    // VALUE: EV > 2.0% and Confidence >= Medium
    // WATCH: EV between 0.0% and 2.0%
    // AVOID: EV is negative OR confidence is Very Low
    // NO_ACTION: Default state
    let decision: 'NO_ACTION' | 'WATCH' | 'VALUE' | 'STRONG_VALUE' | 'AVOID' = 'NO_ACTION';

    if (edge.EV < 0.0 || confidence_label === 'Very Low') {
      decision = 'AVOID';
    } else if (edge.EV >= 8.0 && (confidence_label === 'Very High' || confidence_label === 'High')) {
      decision = 'STRONG_VALUE';
    } else if (edge.EV >= 2.0 && (confidence_label === 'Very High' || confidence_label === 'High' || confidence_label === 'Medium')) {
      decision = 'VALUE';
    } else if (edge.EV >= 0.0) {
      decision = 'WATCH';
    }

    return {
      matchId,
      market: edge.market,
      expectedValue: edge.EV,
      confidence_score: calculatedScore,
      confidence_label,
      risk,
      edge: edge.edge,
      fairOdds: edge.fair_odds,
      marketOdds: edge.current_odds,
      decision
    };
  }
}
