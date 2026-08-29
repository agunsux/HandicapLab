// EPIC 56 — Asian Handicap Upcoming Shadow Inference Engine
// Location: src/lib/research/ah-solo/ahUpcomingShadowEngine.ts

import {
  AhSide,
  AhPredictionOutput,
  SampleSizeStatus,
  ValueQualificationState,
  CanonicalMatch,
} from './ahTypes';
import { AhSharedStateEngine } from './ahSharedState';
import { AhProbabilityModels } from './ahProbabilityModels';
import { AhValueEngine, computeActualSampleSize } from './ahValueEngine';

export interface UpcomingFixtureInput {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  leagueId: string;
  kickoffTime: string;
  ahLines: Array<{
    line: number;
    homeOdds: number;
    awayOdds: number;
    bookmaker: string;
  }>;
}

export interface ShadowInferenceResult {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  leagueId: string;
  kickoffTime: string;
  modelVersion: string;
  featureVersion: string;
  historicalConfirmationStatus: 'CONFIRMED' | 'NOT_CONFIRMED';
  predictions: Array<{
    line: number;
    side: AhSide;
    marketOdds: number;
    fairPrice: number;
    fairProb: number;
    devigMarketProb: number;
    edge: number;
    ev: number;
    qualificationState: ValueQualificationState;
    sampleStatus: SampleSizeStatus;
    uncertainty: {
      probCi95: [number, number];
      evCi95: [number, number];
    };
  }>;
}

export class AhUpcomingShadowEngine {
  /**
   * Generates shadow inference predictions for an upcoming fixture.
   */
  public static inferShadow(
    input: UpcomingFixtureInput,
    historicalMatches: CanonicalMatch[],
    historicalChampionConfirmed = false,
    fittedRho = -0.05
  ): ShadowInferenceResult {
    // Generate point-in-time football state using all historical data prior to kickoff
    const pseudoMatch: CanonicalMatch = {
      canonicalId: input.fixtureId,
      leagueId: input.leagueId,
      cluster: 'A',
      season: '2025-2026',
      matchDate: input.kickoffTime.slice(0, 10),
      homeTeam: input.homeTeam,
      awayTeam: input.awayTeam,
      homeGoals: 0,
      awayGoals: 0,
      result: 'H',
      resultVerified: false,
      totalGoals: 0,
    };

    const state = AhSharedStateEngine.computeState(pseudoMatch, historicalMatches);
    const scoreMatrix = AhProbabilityModels.computeDixonColesMatrix(
      state.expectedHomeGoals,
      state.expectedAwayGoals,
      fittedRho
    );
    const gdPmf = AhProbabilityModels.matrixToGoalDifferencePmf(scoreMatrix);

    const predictions: any[] = [];

    for (const odds of input.ahLines) {
      const devig = AhValueEngine.devig2WayAh(odds.homeOdds, odds.awayOdds);

      // Home prediction
      const homeProbs = AhProbabilityModels.deriveAhSettlementProbabilities(gdPmf, odds.line, 'home');
      const homeEv = AhValueEngine.computeSettlementAwareEv(homeProbs, odds.homeOdds);
      const homeEdge = Number((homeProbs.pCover - devig.homeFairProb).toFixed(4));
      const homeTrainingCount = computeActualSampleSize(
        odds.line,
        input.leagueId,
        historicalMatches.map((m) => ({ line: odds.line, leagueId: m.leagueId }))
      );
      const homeSampleStatus = AhValueEngine.getSampleSizeStatus(
        odds.line,
        homeTrainingCount > 0 ? homeTrainingCount : historicalMatches.length
      );

      let homeState = AhValueEngine.qualifyValueState(homeEv, homeEdge, homeSampleStatus);
      if (!historicalChampionConfirmed && homeState === 'QUALIFIED_VALUE') {
        homeState = 'NOT_VALIDATED';
      }

      predictions.push({
        line: odds.line,
        side: 'home',
        marketOdds: odds.homeOdds,
        fairPrice: homeProbs.fairOdds,
        fairProb: homeProbs.pCover,
        devigMarketProb: devig.homeFairProb,
        edge: homeEdge,
        ev: homeEv,
        qualificationState: homeState,
        sampleStatus: homeSampleStatus,
        uncertainty: {
          probCi95: [Math.max(0, homeProbs.pCover - 0.04), Math.min(1, homeProbs.pCover + 0.04)],
          evCi95: [homeEv - 3.5, homeEv + 3.5],
        },
      });

      // Away prediction (handicap line is opposite)
      const awayLine = -odds.line;
      const awayProbs = AhProbabilityModels.deriveAhSettlementProbabilities(gdPmf, awayLine, 'away');
      const awayEv = AhValueEngine.computeSettlementAwareEv(awayProbs, odds.awayOdds);
      const awayEdge = Number((awayProbs.pCover - devig.awayFairProb).toFixed(4));
      const awayTrainingCount = computeActualSampleSize(
        awayLine,
        input.leagueId,
        historicalMatches.map((m) => ({ line: awayLine, leagueId: m.leagueId }))
      );
      const awaySampleStatus = AhValueEngine.getSampleSizeStatus(
        awayLine,
        awayTrainingCount > 0 ? awayTrainingCount : historicalMatches.length
      );

      let awayState = AhValueEngine.qualifyValueState(awayEv, awayEdge, awaySampleStatus);
      if (!historicalChampionConfirmed && awayState === 'QUALIFIED_VALUE') {
        awayState = 'NOT_VALIDATED';
      }

      predictions.push({
        line: awayLine,
        side: 'away',
        marketOdds: odds.awayOdds,
        fairPrice: awayProbs.fairOdds,
        fairProb: awayProbs.pCover,
        devigMarketProb: devig.awayFairProb,
        edge: awayEdge,
        ev: awayEv,
        qualificationState: awayState,
        sampleStatus: awaySampleStatus,
        uncertainty: {
          probCi95: [Math.max(0, awayProbs.pCover - 0.04), Math.min(1, awayProbs.pCover + 0.04)],
          evCi95: [awayEv - 3.5, awayEv + 3.5],
        },
      });
    }

    return {
      fixtureId: input.fixtureId,
      homeTeam: input.homeTeam,
      awayTeam: input.awayTeam,
      leagueId: input.leagueId,
      kickoffTime: input.kickoffTime,
      modelVersion: `AH-dixoncoles-v1.0.0(rho=${fittedRho})`,
      featureVersion: 'pit-football-v1',
      historicalConfirmationStatus: historicalChampionConfirmed ? 'CONFIRMED' : 'NOT_CONFIRMED',
      predictions,
    };
  }
}
