// HandicapLab Decision Engine
// Location: src/lib/engines/decision-engine.ts

import { EdgeOutput } from './edge-engine';

export interface DecisionOutput {
  matchId: string;
  market: string;
  marketOdds: number;
  fairOdds: number;
  edge: number;
  expectedValue: number;
  clvProjection: number;
  steam: boolean;
  reverseLine: boolean;
  confidence_score: number;
  confidence_label: string;
  risk: 'Low' | 'Medium' | 'High';
  decision: 'NO_ACTION' | 'WATCH' | 'VALUE' | 'STRONG_VALUE' | 'AVOID';
}

export class DecisionEngine {
  /**
   * Evaluates a single edge and produces a decision output.
   * Deterministic, stateless, and pure.
   */
  public static evaluateDecision(
    matchId: string,
    edge: EdgeOutput,
    modelConfidence: number,
    dataConfidence: number
  ): DecisionOutput {
    const compositeConfidence = Number((modelConfidence * dataConfidence).toFixed(4));
    let confidence_label: string;
    if (compositeConfidence >= 0.85) {
      confidence_label = 'HIGH';
    } else if (compositeConfidence >= 0.65) {
      confidence_label = 'MEDIUM';
    } else {
      confidence_label = 'LOW';
    }

    // Risk assessment based on edge magnitude and confidence
    let risk: 'Low' | 'Medium' | 'High';
    if (edge.edge > 10 || compositeConfidence < 0.5) {
      risk = 'High';
    } else if (edge.edge > 5 || compositeConfidence < 0.7) {
      risk = 'Medium';
    } else {
      risk = 'Low';
    }

    // Decision logic
    let decision: 'NO_ACTION' | 'WATCH' | 'VALUE' | 'STRONG_VALUE' | 'AVOID';
    if (edge.EV <= 0 || compositeConfidence < 0.3) {
      decision = 'AVOID';
    } else if (edge.EV >= 10 && compositeConfidence >= 0.80) {
      decision = 'STRONG_VALUE';
    } else if (edge.EV >= 5 && compositeConfidence >= 0.60) {
      decision = 'VALUE';
    } else if (edge.EV > 0 && compositeConfidence >= 0.40) {
      decision = 'WATCH';
    } else {
      decision = 'NO_ACTION';
    }

    return {
      matchId,
      market: edge.market,
      marketOdds: edge.current_odds,
      fairOdds: edge.fair_odds,
      edge: edge.edge,
      expectedValue: edge.EV,
      clvProjection: edge.CLV_projection,
      steam: edge.steam,
      reverseLine: edge.reverse_line,
      confidence_score: compositeConfidence,
      confidence_label,
      risk,
      decision,
    };
  }
}
