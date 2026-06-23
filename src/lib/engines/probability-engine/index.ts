import { MatchFeatures } from '../feature-engine/types';
import { ProbabilityOutput, ModelVersion, RawProbabilities } from './types';
import { EnsembleModel } from './ensemble';
import { Calibrator } from './calibration';

export class ProbabilityEngine {
  /**
   * Main prediction entry point.
   * Calls the ensemble model, applies calibration, and derives market-specific probabilities (ML, AH, OU).
   */
  public static predict(
    features: MatchFeatures,
    options: {
      weights?: { poisson: number; dixonColes: number };
      calibrationMethod?: 'platt' | 'isotonic' | 'none';
      plattA?: number;
      plattB?: number;
    } = {}
  ): ProbabilityOutput {
    const weights = options.weights || { poisson: 0.5, dixonColes: 0.5 };
    const calibrationMethod = options.calibrationMethod || 'platt';
    const plattA = options.plattA !== undefined ? options.plattA : 1.02;
    const plattB = options.plattB !== undefined ? options.plattB : -0.01;

    // 1. Get raw ensembled probabilities
    let probs = EnsembleModel.predict(features, weights);
    let calibrationApplied = false;

    // 2. Apply calibration layer if specified
    if (calibrationMethod !== 'none') {
      probs = Calibrator.calibrate(probs, calibrationMethod, plattA, plattB);
      calibrationApplied = true;
    }

    const { scoreMatrix } = probs;

    // 3. Derive Moneyline (1X2) probabilities
    let pHomeRaw = 0;
    let pDrawRaw = 0;
    let pAwayRaw = 0;

    for (let h = 0; h <= 10; h++) {
      for (let a = 0; a <= 10; a++) {
        const p = scoreMatrix[h][a];
        if (h > a) pHomeRaw += p;
        else if (h === a) pDrawRaw += p;
        else pAwayRaw += p;
      }
    }

    // Round and normalize to ensure sum is exactly 1.0
    const mlSum = pHomeRaw + pDrawRaw + pAwayRaw;
    let pHome = Number((pHomeRaw / mlSum).toFixed(4));
    let pDraw = Number((pDrawRaw / mlSum).toFixed(4));
    let pAway = Number((pAwayRaw / mlSum).toFixed(4));
    const mlDiff = 1.0 - (pHome + pDraw + pAway);
    if (Math.abs(mlDiff) > 0) {
      const maxVal = Math.max(pHome, pDraw, pAway);
      if (maxVal === pHome) pHome = Number((pHome + mlDiff).toFixed(4));
      else if (maxVal === pDraw) pDraw = Number((pDraw + mlDiff).toFixed(4));
      else pAway = Number((pAway + mlDiff).toFixed(4));
    }

    // 4. Derive Over/Under (OU) probabilities for standard lines
    const ouLines = ['0.5', '1.5', '2.5', '3.5', '4.5'];
    const pOver: Record<string, number> = {};
    const pUnder: Record<string, number> = {};

    for (const lineStr of ouLines) {
      const line = parseFloat(lineStr);
      let overSum = 0;
      let underSum = 0;

      for (let h = 0; h <= 10; h++) {
        for (let a = 0; a <= 10; a++) {
          const p = scoreMatrix[h][a];
          if (h + a > line) overSum += p;
          else underSum += p;
        }
      }

      pOver[lineStr] = Number(overSum.toFixed(4));
      pUnder[lineStr] = Number(underSum.toFixed(4));
    }

    // 5. Derive Asian Handicap (AH) probabilities for standard lines (Home relative)
    const ahLines = ['-1.5', '-1.0', '-0.5', '0.0', '+0.5', '+1.0', '+1.5'];
    const pAhHome: Record<string, number> = {};
    const pAhAway: Record<string, number> = {};

    for (const lineStr of ahLines) {
      const line = parseFloat(lineStr);
      let homeWinSum = 0;
      let awayWinSum = 0;

      for (let h = 0; h <= 10; h++) {
        for (let a = 0; a <= 10; a++) {
          const p = scoreMatrix[h][a];
          const margin = h - a + line;
          if (margin > 0) homeWinSum += p;
          else if (margin < 0) awayWinSum += p;
        }
      }

      pAhHome[lineStr] = Number(homeWinSum.toFixed(4));
      pAhAway[lineStr] = Number(awayWinSum.toFixed(4));
    }

    // 6. Define model version details
    const modelVersion: ModelVersion = {
      name: 'prematch-v1',
      algo: 'dixon-coles-poisson-ensemble',
      features: 'basic-v1',
      trainedAt: new Date('2026-06-24T00:00:00Z'),
      trainedOnMatches: 1250
    };

    return {
      matchId: features.matchId,
      marketType: features.marketType,
      pHome,
      pDraw,
      pAway,
      pOver,
      pUnder,
      pAhHome,
      pAhAway,
      modelVersion,
      calibrationApplied
    };
  }
}
