import { MatchFeatures } from '../feature-engine/types';
import { MarketOdds } from '../edge-scanner/types';
import { getLeagueConfig, getLeagueConfigById } from '../../crons/leagueRegistry';

export interface Confidence {
  modelConfidence: number; // 0.0 to 1.0
  dataConfidence: number;  // 0.0 to 1.0
  marketConfidence: number; // 0.0 to 1.0
  finalConfidence: number;  // 0.0 to 1.0
}

export class UncertaintyEngine {
  /**
   * Calculates split confidence metrics based on model, data, and market factors.
   * Exposes a unified finalConfidence value.
   */
  public static calculate(
    features: MatchFeatures,
    poissonProbs: number[], // ML probs [home, draw, away]
    dcProbs: number[],      // ML probs [home, draw, away]
    oddsSnapshot?: MarketOdds
  ): Confidence {
    // 1. Model Confidence: Discrepancy between models. Closer predictions = higher confidence.
    const modelDiff = Math.abs(poissonProbs[0] - dcProbs[0]) +
                      Math.abs(poissonProbs[1] - dcProbs[1]) +
                      Math.abs(poissonProbs[2] - dcProbs[2]);
    const pressure = features.knockoutPressure ?? 0.3;
    const modelConfidence = Number(Math.max(0.0, Math.min(1.0, (1.0 - modelDiff * 1.5) * (1.0 - pressure * 0.05))).toFixed(4));

    // 2. Data Confidence: Volume, availability, and continuity of squad data.
    const familiarity = features.squadFamiliarity ?? 1.0;
    const continuity = ((features.squadContinuityHome ?? 0.75) + (features.squadContinuityAway ?? 0.75)) / 2;
    const formCount = (features.homeFormLast5?.length ?? 5) + (features.awayFormLast5?.length ?? 5);
    const dataVolFactor = Math.min(1.0, formCount / 10.0);
    const dataConfidence = Number(Math.max(0.0, Math.min(1.0, (familiarity * 0.4 + continuity * 0.3) + dataVolFactor * 0.3)).toFixed(4));

    // 3. Market Confidence: Odds movement consensus.
    let marketConfidence = 0.85; // baseline default
    if (oddsSnapshot && oddsSnapshot.homeOdds && oddsSnapshot.awayOdds) {
      const impliedHome = 1.0 / oddsSnapshot.homeOdds;
      const impliedAway = 1.0 / oddsSnapshot.awayOdds;
      const impliedDraw = oddsSnapshot.drawOdds ? 1.0 / oddsSnapshot.drawOdds : 0.0;
      const margin = (impliedHome + impliedAway + impliedDraw) - 1.0;
      
      // Higher bookmaker margin indicates higher uncertainty
      marketConfidence = Math.max(0.1, 1.0 - margin * 4.0);
    }

    // Resolve league config for marketLiquidity and minimumHistoricalMatches
    let minMatches = 10;
    let liquidity: 'high' | 'medium' | 'low' = 'high';
    if (features.leagueId) {
      const config = getLeagueConfigById(features.leagueId) || getLeagueConfig(Number(features.leagueId));
      if (config) {
        if (config.minimumHistoricalMatches !== undefined) {
          minMatches = config.minimumHistoricalMatches;
        }
        if (config.profile && config.profile.marketLiquidity) {
          liquidity = config.profile.marketLiquidity;
        }
      }
    }

    // Deduct confidence margins if marketLiquidity is low or medium
    if (liquidity === 'medium') {
      marketConfidence = Math.max(0.0, marketConfidence - 0.1);
    } else if (liquidity === 'low') {
      marketConfidence = Math.max(0.0, marketConfidence - 0.25);
    }

    marketConfidence = Number(Math.max(0.0, Math.min(1.0, marketConfidence)).toFixed(4));

    // 4. Final Confidence: Weighted combination of the three
    let finalConfidence = Number(
      (modelConfidence * 0.4 + dataConfidence * 0.3 + marketConfidence * 0.3).toFixed(4)
    );

    // Apply history completeness discount (Requirement 2)
    if (features.historicalMatchesCount !== undefined) {
      const historicalCount = features.historicalMatchesCount;
      const historyCompleteness = minMatches > 0 ? Math.min(1.0, historicalCount / minMatches) : 1.0;
      if (historyCompleteness < 1.0) {
        finalConfidence = Number((finalConfidence * historyCompleteness).toFixed(4));
      }
    }

    return {
      modelConfidence,
      dataConfidence,
      marketConfidence,
      finalConfidence
    };
  }
}
