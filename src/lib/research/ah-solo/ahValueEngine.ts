// EPIC 56 — Asian Handicap Value & Economic Engine (Fixed Unit Scaling)
// Location: src/lib/research/ah-solo/ahValueEngine.ts

import { removeVigProportional } from '../../settlement-core/devig';
import { AhLineSettlementProbabilities, SampleSizeStatus, ValueQualificationState } from './ahTypes';

export function computeActualSampleSize(
  line: number,
  leagueId: string,
  trainingData: Array<{ line: number; leagueId: string }>
): number {
  return trainingData.filter(
    (d) => Math.abs(d.line - line) < 0.01 && d.leagueId === leagueId
  ).length;
}

export interface DevigOddsPair {
  homeOdds: number;
  awayOdds: number;
  homeFairProb: number;
  awayFairProb: number;
  overround: number;
}

export class AhValueEngine {
  public static devig2WayAh(homeOdds: number, awayOdds: number): DevigOddsPair {
    if (homeOdds <= 1.0 || awayOdds <= 1.0) {
      return {
        homeOdds,
        awayOdds,
        homeFairProb: 0.5,
        awayFairProb: 0.5,
        overround: 0,
      };
    }

    const devig = removeVigProportional({ home: homeOdds, away: awayOdds });
    return {
      homeOdds,
      awayOdds,
      homeFairProb: devig.fair.home || 0.5,
      awayFairProb: devig.fair.away || 0.5,
      overround: devig.overround,
    };
  }

  public static computeSettlementAwareEv(
    probs: AhLineSettlementProbabilities,
    takenOdds: number,
    stake = 1.0
  ): number {
    const fwProfit = (takenOdds - 1.0) * stake;
    const hwProfit = ((takenOdds - 1.0) / 2.0) * stake;
    const pushProfit = 0;
    const hlProfit = -0.5 * stake;
    const flProfit = -1.0 * stake;

    const ev =
      probs.pFullWin * fwProfit +
      probs.pHalfWin * hwProfit +
      probs.pPush * pushProfit +
      probs.pHalfLoss * hlProfit +
      probs.pFullLoss * flProfit;

    return Number(((ev / stake) * 100).toFixed(2));
  }

  public static computeClv(takenOdds: number, closingOdds?: number): number | undefined {
    if (!closingOdds || closingOdds <= 1.0 || takenOdds <= 1.0) {
      return undefined;
    }
    return Number((((takenOdds / closingOdds) - 1.0) * 100).toFixed(2));
  }

  public static getSampleSizeStatus(line: number, rowCount: number): SampleSizeStatus {
    const absLine = Math.abs(line);
    if (absLine >= 2.25 || rowCount < 250) {
      return 'INSUFFICIENT';
    }
    if (rowCount < 800) {
      return 'LIMITED';
    }
    return 'ADEQUATE';
  }

  public static qualifyValueState(
    ev: number,
    edge: number,
    sampleStatus: SampleSizeStatus,
    clv?: number
  ): ValueQualificationState {
    if (sampleStatus === 'INSUFFICIENT') {
      return 'INSUFFICIENT_DATA';
    }
    if (ev <= 0 || edge <= 0) {
      return 'NO_EDGE';
    }
    // Hard Gate: Require statistically significant positive CLV and confirmed out-of-sample edge
    if (sampleStatus === 'LIMITED' || ev < 2.0 || clv === undefined || clv <= 0.05) {
      return 'LOW_CONFIDENCE_EDGE';
    }
    return 'NOT_VALIDATED';
  }

  /**
   * Bootstrap 95% confidence interval computation for ROI returns (% scale).
   * @param unitReturns Array of net profit per 1 unit staked
   */
  public static computeBootstrapCi(unitReturns: number[], iterations = 1000): [number, number] {
    const n = unitReturns.length;
    if (n < 10) {
      const avg = n > 0 ? (unitReturns.reduce((a, b) => a + b, 0) / n) * 100 : 0;
      return [Number(avg.toFixed(2)), Number(avg.toFixed(2))];
    }

    const samplePercentages: number[] = [];
    for (let i = 0; i < iterations; i++) {
      let sum = 0;
      for (let j = 0; j < n; j++) {
        const randIdx = Math.floor(Math.random() * n);
        sum += unitReturns[randIdx];
      }
      samplePercentages.push((sum / n) * 100);
    }

    samplePercentages.sort((a, b) => a - b);
    const lowIdx = Math.floor(iterations * 0.025);
    const highIdx = Math.floor(iterations * 0.975);

    return [Number(samplePercentages[lowIdx].toFixed(2)), Number(samplePercentages[highIdx].toFixed(2))];
  }
}
