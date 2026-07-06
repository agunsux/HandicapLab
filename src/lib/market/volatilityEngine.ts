// HandicapLab Market Intelligence - Volatility Engine
// Location: src/lib/market/volatilityEngine.ts

import { OddsMovementEvent } from './providerInterface';

export interface VolatilityResult {
  volatilityScore: number; // 0-100
  movementFrequency: number;
  avgMovementSize: number;
  cumulativeMovement: number;
  maxSwing: number;
}

export class VolatilityEngine {
  /**
   * Calculates volatility metrics from odds history events.
   */
  public static calculate(events: OddsMovementEvent[]): VolatilityResult {
    if (events.length === 0) {
      return {
        volatilityScore: 0,
        movementFrequency: 0,
        avgMovementSize: 0,
        cumulativeMovement: 0,
        maxSwing: 0
      };
    }

    const movementFrequency = events.length;
    let sumMagnitude = 0;
    let cumulativeMovement = 0;
    
    const oddsValues: number[] = [];

    events.forEach((evt) => {
      sumMagnitude += evt.movementMagnitude;
      cumulativeMovement += Math.abs(evt.newOdds - evt.oldOdds);
      oddsValues.push(evt.newOdds);
    });

    const avgMovementSize = sumMagnitude / events.length;
    
    const maxOdds = Math.max(...oddsValues);
    const minOdds = Math.min(...oddsValues);
    const maxSwing = maxOdds - minOdds;

    // Volatility Score 0-100 based on frequency and cumulative magnitude
    // e.g. Score = (cumulativeMovement * 40) + (movementFrequency * 5)
    const rawScore = (cumulativeMovement * 50) + (movementFrequency * 8);
    const volatilityScore = Math.min(100, Math.round(rawScore));

    return {
      volatilityScore,
      movementFrequency,
      avgMovementSize: Number(avgMovementSize.toFixed(4)),
      cumulativeMovement: Number(cumulativeMovement.toFixed(4)),
      maxSwing: Number(maxSwing.toFixed(4))
    };
  }
}
