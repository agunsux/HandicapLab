// HandicapLab Market Intelligence - Anomaly Detector
// Location: src/lib/market-intelligence/features/prematch/anomaly-detector.ts

import { OddsTimeline } from '../../types';
import { SteamDetector } from './steam';
import { OddsMovementAnalyzer } from './odds-movement';

export class AnomalyDetector {
  /**
   * Detects market anomalies such as Steam, Reverse Line Movement (placeholder), and Volatility.
   */
  public static detectAnomalies(timeline: OddsTimeline): string[] {
    const anomalies: string[] = [];

    // 1. Steam Detection
    const steamEval = SteamDetector.evaluateMatchSteam(timeline);
    if (steamEval.score >= 80) {
      anomalies.push(`Sharp Money (${steamEval.selection})`);
    } else if (steamEval.score >= 40) {
      anomalies.push(`Steam (${steamEval.selection})`);
    }

    // 2. High Volatility Detection
    // For simplicity, we check if there are multiple significant zig-zag moves in history.
    // A robust implementation would measure standard deviation of tick changes.
    let reversals = 0;
    if (timeline.history.length >= 3) {
      for (let i = 1; i < timeline.history.length - 1; i++) {
        const prevH = OddsMovementAnalyzer.toImpliedProbability(timeline.history[i-1].moneyline.home);
        const currH = OddsMovementAnalyzer.toImpliedProbability(timeline.history[i].moneyline.home);
        const nextH = OddsMovementAnalyzer.toImpliedProbability(timeline.history[i+1].moneyline.home);
        
        if ((currH > prevH && currH > nextH) || (currH < prevH && currH < nextH)) {
          // Changed direction by at least 1% probability
          if (Math.abs(currH - prevH) > 0.01 && Math.abs(nextH - currH) > 0.01) {
            reversals++;
          }
        }
      }
    }
    if (reversals >= 2) {
      anomalies.push('High Volatility');
    }

    // 3. Fake Steam / Public Trap (Conceptual)
    // Needs public betting % vs line movement to truly calculate.
    // If public % > 75% on favorite, but odds stay same or drift up = Public Trap
    // anomalies.push('Public Trap (Mock)');

    return anomalies;
  }
}
