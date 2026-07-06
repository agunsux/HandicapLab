// HandicapLab Market Intelligence - Steam Move Detector
// Location: src/lib/market/steamDetector.ts

import { OddsMovementEvent } from './providerInterface';

export interface SteamDetectionResult {
  isSharpSteam: boolean;
  isPublicSteam: boolean;
  isReverseLineMovement: boolean;
  isLateSharpMoney: boolean;
  isFakeMovement: boolean;
  steamScore: number; // 0-100
}

export class SteamMoveDetector {
  /**
   * Evaluates and classifies steam movements based on timeline events and model predictions.
   */
  public static detect(
    events: OddsMovementEvent[],
    predictedSelection: 'home' | 'draw' | 'away',
    openingOdds: number,
    closingOdds: number,
    thresholds: {
      steamThreshold: number; // e.g. 0.05
      clvThreshold: number;
      volatilityThreshold: number;
      lateSteamMinutes: number;
    } = { steamThreshold: 0.05, clvThreshold: 0.03, volatilityThreshold: 20, lateSteamMinutes: 60 }
  ): SteamDetectionResult {
    if (events.length === 0) {
      return {
        isSharpSteam: false,
        isPublicSteam: false,
        isReverseLineMovement: false,
        isLateSharpMoney: false,
        isFakeMovement: false,
        steamScore: 0
      };
    }

    let isSharpSteam = false;
    let isPublicSteam = false;
    let isReverseLineMovement = false;
    let isLateSharpMoney = false;
    let isFakeMovement = false;
    let steamScore = 0;

    // 1. Check for sharp steam (sudden movement on high liquidity books like Pinnacle)
    const pinEvents = events.filter((e) => e.bookmaker === 'Pinnacle' || e.bookmaker === 'PS3838');
    const sharpMovement = pinEvents.some((e) => e.movementMagnitude >= thresholds.steamThreshold);
    if (sharpMovement) {
      isSharpSteam = true;
      steamScore += 45;
    }

    // 2. Check for public steam (large cumulative small updates across public books like Bet365)
    const publicEvents = events.filter((e) => e.bookmaker === 'Bet365');
    if (publicEvents.length >= 3 && !isSharpSteam) {
      isPublicSteam = true;
      steamScore += 25;
    }

    // 3. Reverse Line Movement (odds move down/in favor of selection when odds should rise, or vice versa)
    // E.g., if predicted selection is 'home' and home odds drop from 2.10 to 1.90, but model prediction says it was high value
    const oddsDrop = openingOdds - closingOdds;
    if (oddsDrop > thresholds.clvThreshold && predictedSelection === 'home') {
      isReverseLineMovement = true;
      steamScore += 20;
    }

    // 4. Late Sharp Money (large movement within kickoff window, e.g. 60 mins before kickoff)
    const lateEvents = pinEvents.filter((e) => {
      const timeDiff = Date.now() - new Date(e.timestamp).getTime();
      return Math.abs(timeDiff) < thresholds.lateSteamMinutes * 60 * 1000;
    });
    if (lateEvents.some((e) => e.movementMagnitude >= thresholds.clvThreshold)) {
      isLateSharpMoney = true;
      steamScore += 15;
    }

    // 5. Fake Movement (volatility spike returning back to baseline)
    if (events.length >= 3) {
      const first = events[0].newOdds;
      const last = events[events.length - 1].newOdds;
      const hasSpike = events.some((e) => Math.abs(e.newOdds - first) > 0.15);
      if (hasSpike && Math.abs(last - first) <= 0.03) {
        isFakeMovement = true;
        steamScore = Math.max(0, steamScore - 30);
      }
    }

    return {
      isSharpSteam,
      isPublicSteam,
      isReverseLineMovement,
      isLateSharpMoney,
      isFakeMovement,
      steamScore: Math.min(100, steamScore)
    };
  }
}
