import { MatchFeatures } from '../feature-engine/types';
import { MarketOdds } from '../edge-scanner/types';
import { getLeagueConfig, getLeagueConfigById } from '../../crons/leagueRegistry';

export interface Confidence {
  modelConfidence: number; // 0.0 to 1.0
  dataConfidence: number;  // 0.0 to 1.0
  marketConfidence: number; // 0.0 to 1.0
  finalConfidence: number;  // 0.0 to 1.0
  confidenceScore: number;
  dataQualityScore: number;
  recommendationStatus: 'Recommended' | 'Consider' | 'Neutral' | 'Caution' | 'Skip';
  reasons: string[];
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

    // Apply bookmaker quality scoring (sharp_score) to weight market confidence
    let sharpScore = 100;
    if (oddsSnapshot && oddsSnapshot.bookmaker) {
      const bkey = oddsSnapshot.bookmaker.toLowerCase().trim();
      if (bkey.includes('pinnacle') || bkey.includes('pinny')) {
        sharpScore = 100;
      } else if (bkey.includes('singbet') || bkey.includes('ibc') || bkey.includes('sbo') || bkey.includes('sbobet')) {
        sharpScore = 90;
      } else if (bkey.includes('betfair') || bkey.includes('smarkets') || bkey.includes('exchange') || bkey.includes('matchbook') || bkey.includes('smrk')) {
        sharpScore = 85;
      } else {
        sharpScore = 50; // soft books
      }
    }
    marketConfidence = marketConfidence * (sharpScore / 100.0);

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

    // --- Production-Grade Multi-Factor Confidence Engine & Data Quality Score ---
    // A. Data Quality Score calculation (Phase D)
    const hasFixtureInfo = features.kickoffAt && features.matchId;
    const fixtureCompleteness = hasFixtureInfo ? 100 : 50;

    const hasOdds = oddsSnapshot && (oddsSnapshot.homeOdds !== undefined || oddsSnapshot.awayOdds !== undefined);
    const oddsCompleteness = hasOdds ? 100 : 0;

    const timeToKickoffMs = features.kickoffAt ? (new Date(features.kickoffAt).getTime() - Date.now()) : 2 * 24 * 60 * 60 * 1000;
    const isLineupConfirmed = timeToKickoffMs > 0 && timeToKickoffMs <= 60 * 60 * 1000; // lineups confirmed within 60 mins of kickoff
    const lineupAvailability = isLineupConfirmed ? 100 : 60;

    const historicalCount = features.historicalMatchesCount ?? 0;
    const historicalSample = minMatches > 0 ? Math.min(100, Math.round((historicalCount / minMatches) * 100)) : 100;

    const hasML = oddsSnapshot?.homeOdds !== undefined && oddsSnapshot?.awayOdds !== undefined;
    const hasAH = oddsSnapshot?.line !== undefined;
    const marketCoverage = (hasML ? 40 : 0) + (hasAH ? 30 : 0) + 30; // defaults to 100 if both are present

    const formCompleteness = (features.homeFormWeighted !== undefined && features.awayFormWeighted !== undefined) ? 100 : 50;

    const dataQualityScore = Math.round(
      fixtureCompleteness * 0.15 +
      oddsCompleteness * 0.20 +
      lineupAvailability * 0.15 +
      historicalSample * 0.20 +
      marketCoverage * 0.15 +
      formCompleteness * 0.15
    );

    // B. Confidence Score (0-100) factors (Phase B)
    let modelCalibration = 75;
    if (features.leagueId) {
      const config = getLeagueConfigById(features.leagueId) || getLeagueConfig(Number(features.leagueId));
      if (config) {
        if (config.tier === 1) modelCalibration = 85;
        else if (config.tier === 2) modelCalibration = 80;
      }
    }

    let lineMovementStability = 90;
    if (oddsSnapshot && oddsSnapshot.homeOdds && oddsSnapshot.awayOdds) {
      lineMovementStability = Math.round(marketConfidence * 100);
    }

    const lineupCertainty = isLineupConfirmed ? 100 : 70;
    const injuryUncertainty = Math.round(continuity * 100);

    let leagueReliability = 70;
    if (features.leagueId) {
      const config = getLeagueConfigById(features.leagueId) || getLeagueConfig(Number(features.leagueId));
      if (config) {
        if (config.tier === 1) leagueReliability = 95;
        else if (config.tier === 2) leagueReliability = 85;
      }
    }

    const predictionVariance = Math.round(modelConfidence * 100);

    const confidenceScore = Math.max(0, Math.min(100, Math.round(
      predictionVariance * 0.25 +
      modelCalibration * 0.15 +
      historicalSample * 0.15 +
      lineMovementStability * 0.15 +
      lineupCertainty * 0.10 +
      injuryUncertainty * 0.10 +
      leagueReliability * 0.10
    )));

    // C. Recommendation Status (Phase C) - No gambling terminology
    let recommendationStatus: 'Recommended' | 'Consider' | 'Neutral' | 'Caution' | 'Skip' = 'Neutral';
    if (confidenceScore >= 80) {
      recommendationStatus = 'Recommended';
    } else if (confidenceScore >= 65) {
      recommendationStatus = 'Consider';
    } else if (confidenceScore >= 50) {
      recommendationStatus = 'Neutral';
    } else if (confidenceScore >= 35) {
      recommendationStatus = 'Caution';
    } else {
      recommendationStatus = 'Skip';
    }

    // D. Explainability Reasons (Phase E)
    const reasons: string[] = [];
    if (confidenceScore >= 75) {
      reasons.push("High historical calibration");
    }
    if (isLineupConfirmed) {
      reasons.push("Confirmed starting lineup");
    } else {
      reasons.push("Lineup projection stable");
    }
    if (historicalSample >= 75) {
      reasons.push("Robust historical sample size");
    }
    if (predictionVariance >= 85) {
      reasons.push("Low model variance");
    }
    if (lineMovementStability >= 85) {
      reasons.push("Stable market");
    }
    if (leagueReliability >= 85) {
      reasons.push("High-reliability competition profile");
    }
    if (continuity >= 0.8) {
      reasons.push("Consistent squad continuity");
    }

    return {
      modelConfidence,
      dataConfidence,
      marketConfidence,
      finalConfidence,
      confidenceScore,
      dataQualityScore,
      recommendationStatus,
      reasons
    };
  }
}
