// HandicapLab Decision Engine
// Location: src/lib/engines/decision-engine/index.ts

import { ProbabilityOutput } from '../probability-engine/types';

export interface DecisionOutput {
  matchId: string;
  market: string;          // e.g. "Moneyline Home", "AH -0.5", "Over 2.5"
  edge: number;            // e.g. 6.30 (expressed as percentage)
  confidence: 'High' | 'Medium' | 'Low';
  fairOdds: number;        // e.g. 1.71
  marketOdds: number;      // e.g. 1.89
  expectedValue: number;   // e.g. 10.50 (%)
  recommendedStake: number; // e.g. 1.40 (%)
  risk: 'Low' | 'Medium' | 'High';
  reasons: string[];
}

export class DecisionEngine {
  private kellyMultiplier: number;

  constructor(kellyMultiplier: number = 0.25) {
    this.kellyMultiplier = kellyMultiplier;
  }

  public calculateDecision(
    matchId: string,
    prob: ProbabilityOutput,
    odds: { homeOdds: number; drawOdds: number; awayOdds: number; over25Odds?: number; under25Odds?: number }
  ): DecisionOutput | null {
    const decisions: DecisionOutput[] = [];

    // Helper to calculate EV, Kelly and construct recommendation
    const evaluateMarket = (
      marketName: string,
      modelProb: number,
      bookmakerOdds: number,
      reasons: string[]
    ) => {
      if (!bookmakerOdds || bookmakerOdds <= 1.0) return;

      const fairOdds = 1 / Math.max(0.01, modelProb);
      const ev = (modelProb * bookmakerOdds - 1) * 100; // in %
      
      if (ev <= 0) return;

      // Kelly staking
      const rawKelly = (modelProb * bookmakerOdds - 1) / (bookmakerOdds - 1);
      const recommendedStake = Math.max(0, rawKelly * this.kellyMultiplier * 100); // in %

      // Classify confidence and risk
      const confidence = prob.confidence?.confidenceScore && prob.confidence.confidenceScore > 0.75
        ? 'High'
        : prob.confidence?.confidenceScore && prob.confidence.confidenceScore > 0.50
        ? 'Medium'
        : 'Low';

      const risk = recommendedStake > 3.0 ? 'High' : recommendedStake > 1.0 ? 'Medium' : 'Low';

      decisions.push({
        matchId,
        market: marketName,
        edge: parseFloat(ev.toFixed(2)),
        confidence,
        fairOdds: parseFloat(fairOdds.toFixed(2)),
        marketOdds: bookmakerOdds,
        expectedValue: parseFloat(ev.toFixed(2)),
        recommendedStake: parseFloat(recommendedStake.toFixed(2)),
        risk,
        reasons
      });
    };

    // 1. Evaluate Moneyline Home
    evaluateMarket('Moneyline Home', prob.pHome, odds.homeOdds, [
      'Elo difference supports home edge',
      `Model probability of ${(prob.pHome * 100).toFixed(1)}% is higher than bookmaker implied probability of ${(100 / odds.homeOdds).toFixed(1)}%`
    ]);

    // 2. Evaluate Moneyline Away
    evaluateMarket('Moneyline Away', prob.pAway, odds.awayOdds, [
      'Elo difference supports away edge',
      `Model probability of ${(prob.pAway * 100).toFixed(1)}% is higher than bookmaker implied probability of ${(100 / odds.awayOdds).toFixed(1)}%`
    ]);

    // 3. Evaluate Over 2.5 Goals (if odds and model prob are present)
    const probOver25 = prob.pOver && prob.pOver['2.5'];
    if (probOver25 && odds.over25Odds) {
      evaluateMarket('Over 2.5 Goals', probOver25, odds.over25Odds, [
        `High goal projections indicate an Over value`
      ]);
    }

    // 4. Evaluate Under 2.5 Goals
    const probUnder25 = prob.pUnder && prob.pUnder['2.5'];
    if (probUnder25 && odds.under25Odds) {
      evaluateMarket('Under 2.5 Goals', probUnder25, odds.under25Odds, [
        `Tactical low-scoring projections indicate an Under value`
      ]);
    }

    if (decisions.length === 0) {
      // Return a neutral default recommendation if no positive EV exists
      return {
        matchId,
        market: 'No Bet',
        edge: 0.0,
        confidence: 'Low',
        fairOdds: 0.0,
        marketOdds: 0.0,
        expectedValue: 0.0,
        recommendedStake: 0.0,
        risk: 'Low',
        reasons: ['No positive EV edge identified against bookmaker odds.']
      };
    }

    // Sort decisions by EV and return the highest edge recommendation
    decisions.sort((a, b) => b.expectedValue - a.expectedValue);
    return decisions[0];
  }
}
