import { removeVigProportional } from '../../lib/settlement-core/devig';
import type { ReplayOutcome } from '../../lib/epic31b/types';

export interface BenchmarkMetrics {
  totalMatches: number;
  modelBrier: number;
  marketBrier: number;
  brierDelta: number; // positive if model is better (lower Brier)
  modelAccuracy: number;
  marketAccuracy: number;
  accuracyDelta: number;
  averageCLV: number;
  roi: number;
}

export class BookmakerBenchmark {
  /**
   * Benchmarks the model's performance against the bookmaker consensus/closing odds.
   */
  public static benchmark(
    outcomes: ReplayOutcome[],
    closingOddsList: Array<{ homeOdds: number; drawOdds: number; awayOdds: number; selection: 'home' | 'draw' | 'away' }>
  ): BenchmarkMetrics {
    let modelBrierSum = 0;
    let marketBrierSum = 0;
    let modelTp = 0;
    let marketTp = 0;
    let clvSum = 0;
    let validCount = 0;

    for (let i = 0; i < outcomes.length; i++) {
      const outcome = outcomes[i];
      const closingOdds = closingOddsList[i];
      if (!closingOdds) continue;

      const oddsMap = {
        home: closingOdds.homeOdds,
        draw: closingOdds.drawOdds,
        away: closingOdds.awayOdds,
      };

      // 1. Remove vig to get market consensus (fair) probabilities
      const devigged = removeVigProportional(oddsMap);
      const selKey = outcome.selection; // "home", "draw", or "away"
      const marketProb = devigged.fair[selKey] || 0.33;

      const act = outcome.actualResult; // 1 = win, 0.5 = push, 0 = loss
      const binaryAct = act === 1 ? 1 : 0;

      // 2. Compute Brier scores
      modelBrierSum += Math.pow(outcome.predictedProbability - binaryAct, 2);
      marketBrierSum += Math.pow(marketProb - binaryAct, 2);

      // 3. Compute Accuracies (threshold at 0.5 for predicted, or pick selection vs market favourite)
      if (outcome.predictedProbability >= 0.5 && act === 1) {
        modelTp++;
      }
      if (marketProb >= 0.5 && act === 1) {
        marketTp++;
      }

      clvSum += outcome.clv;
      validCount++;
    }

    const totalMatches = validCount;
    const modelBrier = totalMatches > 0 ? modelBrierSum / totalMatches : 0;
    const marketBrier = totalMatches > 0 ? marketBrierSum / totalMatches : 0;
    const brierDelta = marketBrier - modelBrier; // positive = model outperforms market

    const modelAccuracy = totalMatches > 0 ? (modelTp / totalMatches) * 100 : 0;
    const marketAccuracy = totalMatches > 0 ? (marketTp / totalMatches) * 100 : 0;
    const accuracyDelta = modelAccuracy - marketAccuracy;

    const averageCLV = totalMatches > 0 ? clvSum / totalMatches : 0;
    const roi = outcomes.reduce((sum, o) => sum + o.profitLoss, 0);

    return {
      totalMatches,
      modelBrier: Math.round(modelBrier * 10000) / 10000,
      marketBrier: Math.round(marketBrier * 10000) / 10000,
      brierDelta: Math.round(brierDelta * 10000) / 10000,
      modelAccuracy: Math.round(modelAccuracy * 100) / 100,
      marketAccuracy: Math.round(marketAccuracy * 100) / 100,
      accuracyDelta: Math.round(accuracyDelta * 100) / 100,
      averageCLV: Math.round(averageCLV * 10000) / 10000,
      roi: Math.round(roi * 100) / 100,
    };
  }
}
