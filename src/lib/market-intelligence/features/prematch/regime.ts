// HandicapLab Market Intelligence - Regime Classifier
// Location: src/lib/market-intelligence/features/prematch/regime.ts

import { OddsTimeline } from '../../types';
import { AnomalyDetector } from './anomaly-detector';

export class MarketRegimeClassifier {
  /**
   * Classifies the overall market environment for a specific match.
   */
  public static classify(timeline: OddsTimeline): 'Stable' | 'Volatile' | 'Steam' | 'Mixed' {
    const anomalies = AnomalyDetector.detectAnomalies(timeline);

    const hasSteam = anomalies.some(a => a.includes('Steam') || a.includes('Sharp Money'));
    const hasVol = anomalies.includes('High Volatility');

    if (hasSteam && !hasVol) return 'Steam';
    if (hasVol && !hasSteam) return 'Volatile';
    if (hasSteam && hasVol) return 'Mixed';
    
    return 'Stable';
  }

  /**
   * Generates a composite market confidence score based on regime and anomalies.
   * High score = Trust the market signal / Model.
   * Low score = High uncertainty or adverse movement.
   */
  public static calculateConfidence(timeline: OddsTimeline): number {
    const regime = this.classify(timeline);
    let baseConfidence = 100;

    switch (regime) {
      case 'Stable':
        baseConfidence = 90; // Predictable
        break;
      case 'Steam':
        baseConfidence = 85; // Strong signal, but could be over-adjusted
        break;
      case 'Mixed':
        baseConfidence = 50; // Contradictory signals
        break;
      case 'Volatile':
        baseConfidence = 40; // Too much noise
        break;
    }

    return baseConfidence;
  }
}
