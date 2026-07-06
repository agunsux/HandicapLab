// HandicapLab Market Intelligence - Steam Detection
// Location: src/lib/market-intelligence/features/prematch/steam.ts

import { OddsTimeline } from '../../types';
import { OddsMovementAnalyzer } from './odds-movement';

export class SteamDetector {
  /**
   * Calculates a Steam Score (0-100) based on velocity, magnitude, and liquidity.
   */
  public static calculateSteamScore(timeline: OddsTimeline, selection: 'home' | 'draw' | 'away'): number {
    const delta = OddsMovementAnalyzer.calculateImpliedDelta(timeline)[selection];
    
    // If the probability dropped (odds drifted up), this is not steam for this selection.
    if (delta <= 0) return 0;

    const velocity = OddsMovementAnalyzer.calculateVelocity(timeline, selection);
    
    // Magnitude factor: 1.0 at 5% probability move
    const magnitudeFactor = Math.min(delta / 0.05, 1.0);
    
    // Velocity factor: 1.0 at 2% probability move per hour
    const velocityFactor = Math.min(Math.max(velocity, 0) / 0.02, 1.0);
    
    // For now, liquidity is mocked based on the provider tier.
    // E.g., Pinnacle = 1.0, lower tier = 0.6
    const liquidityFactor = timeline.provider.toLowerCase() === 'pinnacle' ? 1.0 : 0.8;

    const rawScore = (magnitudeFactor * 0.6 + velocityFactor * 0.4) * liquidityFactor * 100;

    return Math.min(Math.max(Math.round(rawScore), 0), 100);
  }

  /**
   * Evaluates all selections and returns the highest steam score and the selection it applies to.
   */
  public static evaluateMatchSteam(timeline: OddsTimeline): { selection: 'home' | 'draw' | 'away' | 'none'; score: number } {
    const homeScore = this.calculateSteamScore(timeline, 'home');
    const drawScore = this.calculateSteamScore(timeline, 'draw');
    const awayScore = this.calculateSteamScore(timeline, 'away');

    let maxScore = homeScore;
    let maxSelection: 'home' | 'draw' | 'away' | 'none' = 'home';

    if (drawScore > maxScore) {
      maxScore = drawScore;
      maxSelection = 'draw';
    }
    
    if (awayScore > maxScore) {
      maxScore = awayScore;
      maxSelection = 'away';
    }

    if (maxScore < 20) { // Threshold for "meaningful" steam
      return { selection: 'none', score: 0 };
    }

    return { selection: maxSelection, score: maxScore };
  }
}
