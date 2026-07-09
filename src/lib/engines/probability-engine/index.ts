import { MatchFeatures } from '../feature-engine/types';
import { ProbabilityOutput, ModelVersion, RawProbabilities } from './types';
import { EnsembleModel } from './ensemble';
import { Calibrator } from './calibration';
import { CompetitionProfileEngine } from '../feature-engine/competition-profile';
import { AdaptiveWeightsEngine } from './adaptive-weights';
import { UncertaintyEngine } from './uncertainty';
import { PoissonModel } from './poisson';
import { DixonColesModel } from './dixon-coles';
import { MarketOdds } from '../edge-scanner/types';
import { PredictionFeatures } from '../../market-intelligence/types';
import { MatchInput, generatePrediction } from '../../../services/probability.engine';


export class ProbabilityEngine {
  /**
   * Main prediction entry point.
   * Calls the ensemble model, applies calibration, and derives market-specific probabilities (ML, AH, OU).
   */
  public static async predict(
    features: MatchFeatures,
    options: {
      weights?: { poisson: number; dixonColes: number };
      calibrationMethod?: 'platt' | 'isotonic' | 'beta' | 'none';
      plattA?: number;
      plattB?: number;
      rho?: number;
      oddsSnapshot?: MarketOdds;
      marketFeatures?: PredictionFeatures;
    } = {}
  ): Promise<ProbabilityOutput> {
    const profile = CompetitionProfileEngine.getProfileForLeague(features.leagueId || 'EPL');

    const calibrationMethod = options.calibrationMethod || 'platt';
    const plattA = options.plattA !== undefined ? options.plattA : (profile.plattA !== undefined ? profile.plattA : 1.02);
    const plattB = options.plattB !== undefined ? options.plattB : (profile.plattB !== undefined ? profile.plattB : -0.01);
    const rho = options.rho !== undefined ? options.rho : -0.06;

    // 1. Competition Profile adjustments
    const adjustedFeatures = { ...features };

    // Apply rest sensitivity to fatigue multiplier calculation
    const homeFatigue = Math.max(0, 7 - features.homeRestDays) * profile.restSensitivity + (features.homeTravelKm / 2000);
    const awayFatigue = Math.max(0, 7 - features.awayRestDays) * profile.restSensitivity;
    
    const homeFatigueMultiplier = Math.max(0.8, Math.min(1.0, 1.0 - homeFatigue * 0.03));
    const awayFatigueMultiplier = Math.max(0.8, Math.min(1.0, 1.0 - awayFatigue * 0.03));

    adjustedFeatures.homeAttack = features.homeAttack * homeFatigueMultiplier;
    adjustedFeatures.awayDefense = features.awayDefense / homeFatigueMultiplier;
    adjustedFeatures.awayAttack = features.awayAttack * awayFatigueMultiplier;
    adjustedFeatures.homeDefense = features.homeDefense / awayFatigueMultiplier;

    // Apply home advantage modifier and international adjustment score
    if (features.competitionType === 'international') {
      adjustedFeatures.isHomeAdvantage = false; // avoid double home-field bonus
      
      const adj = features.internationalAdjustmentScore ?? 1.0;
      adjustedFeatures.homeAttack *= adj;
      adjustedFeatures.awayAttack *= adj;
    }

    // 2. Resolve adaptive weights
    const weights = options.weights || await AdaptiveWeightsEngine.getWeights(features.leagueId);

    // 3. Compute raw Poisson & Dixon Coles outcomes
    const poissonRaw = PoissonModel.predict(adjustedFeatures);
    const dixonColesRaw = DixonColesModel.predict(adjustedFeatures, rho);

    const getMlProbs = (scoreMatrix: number[][]) => {
      let pHome = 0, pDraw = 0, pAway = 0;
      for (let h = 0; h <= 10; h++) {
        for (let a = 0; a <= 10; a++) {
          const p = scoreMatrix[h][a];
          if (h > a) pHome += p;
          else if (h === a) pDraw += p;
          else pAway += p;
        }
      }
      const sum = pHome + pDraw + pAway;
      return [pHome / sum, pDraw / sum, pAway / sum];
    };

    const poissonMl = getMlProbs(poissonRaw.scoreMatrix);
    const dcMl = getMlProbs(dixonColesRaw.scoreMatrix);

    // 4. Combine score matrices using weights
    const sumWeights = weights.poisson + weights.dixonColes;
    const wP = sumWeights > 0 ? weights.poisson / sumWeights : 0.5;
    const wDC = sumWeights > 0 ? weights.dixonColes / sumWeights : 0.5;

    const scoreMatrix: number[][] = [];
    let scoreSum = 0;

    for (let h = 0; h <= 10; h++) {
      scoreMatrix[h] = [];
      for (let a = 0; a <= 10; a++) {
        const prob = wP * poissonRaw.scoreMatrix[h][a] + wDC * dixonColesRaw.scoreMatrix[h][a];
        scoreMatrix[h][a] = prob;
        scoreSum += prob;
      }
    }

    if (scoreSum > 0) {
      for (let h = 0; h <= 10; h++) {
        for (let a = 0; a <= 10; a++) {
          scoreMatrix[h][a] /= scoreSum;
        }
      }
    }

    let probs = {
      homeLambda: wP * poissonRaw.homeLambda + wDC * dixonColesRaw.homeLambda,
      awayLambda: wP * poissonRaw.awayLambda + wDC * dixonColesRaw.awayLambda,
      scoreMatrix
    };

    let calibrationApplied = false;

    // 5. Apply calibration layer if specified
    if (calibrationMethod !== 'none') {
      probs = Calibrator.calibrate(probs, calibrationMethod, plattA, plattB);
      calibrationApplied = true;
    }

    const calibratedMatrix = probs.scoreMatrix;

    // Apply bounded competition profile modifiers [0.95 - 1.05] (Requirement 1)
    const boundedHomeAdv = Math.max(0.95, Math.min(1.05, profile.homeAdvantageModifier));
    const varianceRatio = profile.variance / 1.15;
    const boundedVarMod = Math.max(0.95, Math.min(1.05, varianceRatio));
    const goalRatio = profile.goalEnvironment / 2.5;
    const boundedGoalMod = Math.max(0.95, Math.min(1.05, goalRatio));

    let matrixSum = 0;
    for (let h = 0; h <= 10; h++) {
      for (let a = 0; a <= 10; a++) {
        let p = calibratedMatrix[h][a];
        // Home Advantage
        if (h > a) p *= boundedHomeAdv;
        else if (a > h) p *= (2.0 - boundedHomeAdv);
        // Draw Variance
        else p *= boundedVarMod;
        
        // Goal Environment
        const goals = h + a;
        if (goals > 2.5) p *= boundedGoalMod;
        else p *= (2.0 - boundedGoalMod);

        calibratedMatrix[h][a] = p;
        matrixSum += p;
      }
    }

    if (matrixSum > 0) {
      for (let h = 0; h <= 10; h++) {
        for (let a = 0; a <= 10; a++) {
          calibratedMatrix[h][a] /= matrixSum;
        }
      }
    }

    // 6. Derive Moneyline (1X2) probabilities
    let pHomeRaw = 0;
    let pDrawRaw = 0;
    let pAwayRaw = 0;

    for (let h = 0; h <= 10; h++) {
      for (let a = 0; a <= 10; a++) {
        const p = calibratedMatrix[h][a];
        if (h > a) pHomeRaw += p;
        else if (h === a) pDrawRaw += p;
        else pAwayRaw += p;
      }
    }

    // Round and normalize to ensure sum is exactly 1.0
    const mlSum = pHomeRaw + pDrawRaw + pAwayRaw;
    let pHome = Number((pHomeRaw / mlSum).toFixed(4));
    let pDraw = Number((pDrawRaw / mlSum).toFixed(4));
    let pAway = Number(Math.max(0, 1.0 - pHome - pDraw).toFixed(4));

    // 7. Derive Over/Under (OU) probabilities for standard lines
    const ouLines = ['0.5', '1.5', '2.5', '3.5', '4.5'];
    const pOver: Record<string, number> = {};
    const pUnder: Record<string, number> = {};

    for (const lineStr of ouLines) {
      const line = parseFloat(lineStr);
      let overSum = 0;
      let underSum = 0;

      for (let h = 0; h <= 10; h++) {
        for (let a = 0; a <= 10; a++) {
          const p = calibratedMatrix[h][a];
          if (h + a > line) overSum += p;
          else underSum += p;
        }
      }

      const ouSum = overSum + underSum;
      pOver[lineStr] = Number((overSum / ouSum).toFixed(4));
      pUnder[lineStr] = Number(Math.max(0, 1.0 - pOver[lineStr]).toFixed(4));
    }

    // 8. Derive Asian Handicap (AH) probabilities for standard lines (Home relative)
    const ahLines = ['-1.5', '-1.0', '-0.5', '0.0', '+0.5', '+1.0', '+1.5'];
    const pAhHome: Record<string, number> = {};
    const pAhAway: Record<string, number> = {};

    for (const lineStr of ahLines) {
      const line = parseFloat(lineStr);
      let homeWinSum = 0;
      let awayWinSum = 0;

      for (let h = 0; h <= 10; h++) {
        for (let a = 0; a <= 10; a++) {
          const p = calibratedMatrix[h][a];
          const margin = h - a + line;
          if (margin > 0) homeWinSum += p;
          else if (margin < 0) awayWinSum += p;
        }
      }

      const ahSum = homeWinSum + awayWinSum;
      pAhHome[lineStr] = Number((homeWinSum / ahSum).toFixed(4));
      pAhAway[lineStr] = Number(Math.max(0, 1.0 - pAhHome[lineStr]).toFixed(4));
    }

    // 9. Calculate split confidence via UncertaintyEngine
    const confidence = UncertaintyEngine.calculate(
      adjustedFeatures, 
      poissonMl, 
      dcMl, 
      options.oddsSnapshot, 
      options.marketFeatures
    );

    // Derive Expected Goals (xgHome, xgAway, combined expectedGoals) and BTTS Yes/No
    let xgHome = 0;
    let xgAway = 0;
    let pBttsYes = 0;

    for (let h = 0; h <= 10; h++) {
      for (let a = 0; a <= 10; a++) {
        const p = calibratedMatrix[h][a];
        xgHome += h * p;
        xgAway += a * p;
        if (h >= 1 && a >= 1) {
          pBttsYes += p;
        }
      }
    }

    const expectedGoals = Number((xgHome + xgAway).toFixed(2));
    pBttsYes = Number(pBttsYes.toFixed(4));
    const pBttsNo = Number(Math.max(0, 1.0 - pBttsYes).toFixed(4));

    // 10. Define model version details
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
      leagueId: features.leagueId,
      pHome,
      pDraw,
      pAway,
      pOver,
      pUnder,
      pAhHome,
      pAhAway,
      pBttsYes,
      pBttsNo,
      expectedGoals,
      modelVersion,
      calibrationApplied,
      confidence
    };
  }

  /**
   * Generates a ProbabilityOutput from raw match input data.
   * Delegates to the core prediction engine and normalizes the output.
   */
  public static async generate(
    matchInput: MatchInput,
    matchId: string,
    leagueId?: string
  ): Promise<ProbabilityOutput> {
    const pred = generatePrediction(matchInput);

    return {
      matchId,
      marketType: 'ML',
      leagueId,
      pHome: pred.ml_home_prob,
      pDraw: pred.ml_draw_prob,
      pAway: pred.ml_away_prob,
      pOver: { '2.5': pred.ou_over_prob },
      pUnder: { '2.5': pred.ou_under_prob },
      pAhHome: { '0.0': pred.ah_home_prob },
      pAhAway: { '0.0': pred.ah_away_prob },
      pBttsYes: pred.btts_yes_prob,
      pBttsNo: pred.btts_no_prob,
      expectedGoals: pred.expected_goals_home + pred.expected_goals_away,
      modelVersion: {
        name: 'prematch-v1',
        algo: 'poisson-dixon-coles',
        features: 'basic-v1',
        trainedAt: new Date(),
        trainedOnMatches: 10000,
      },
      calibrationApplied: true,
    };
  }
}


