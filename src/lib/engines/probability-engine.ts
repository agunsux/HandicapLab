// HandicapLab Probability Engine
// Location: src/lib/engines/probability-engine.ts

import { ProbabilityOutput } from './probability-engine/types';
import { MatchInput, generatePrediction } from '@/services/probability.engine';

export class ProbabilityEngine {
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
