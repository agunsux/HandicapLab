/**
 * Asian Handicap Probability & Expected Value Engine for Model A
 * Location: src/lib/research/model-a/ahProbabilityEngine.ts
 */

import {
  BivariateScoreDistribution,
  GoalDifferenceDistribution,
  AhLineProbability,
  AhSide,
} from './types';
import { calculateAhExpectedValue } from '../ahSettlementEngine';

export class AhProbabilityEngine {
  /**
   * Derives discrete Goal Difference PMF from bivariate score distribution.
   */
  public static scoreDistributionToGoalDifferencePmf(
    scoreDist: BivariateScoreDistribution
  ): GoalDifferenceDistribution {
    const pmf: Record<number, number> = {};
    const maxGoals = scoreDist.maxGoals;
    let expectedGd = 0;

    for (let gd = -maxGoals; gd <= maxGoals; gd++) {
      pmf[gd] = 0;
    }

    for (let h = 0; h <= maxGoals; h++) {
      for (let a = 0; a <= maxGoals; a++) {
        const p = scoreDist.matrix[h][a];
        const gd = h - a;
        pmf[gd] = (pmf[gd] || 0) + p;
        expectedGd += gd * p;
      }
    }

    // Re-normalize for micro-rounding preservation
    let total = 0;
    for (const v of Object.values(pmf)) total += v;
    if (total > 0) {
      for (const k of Object.keys(pmf)) {
        pmf[Number(k)] = Number((pmf[Number(k)] / total).toFixed(6));
      }
    }

    return {
      pmf,
      expectedGd: Number(expectedGd.toFixed(4)),
    };
  }

  /**
   * Computes exact settlement probabilities, fair decimal odds, and EV for any AH line.
   * Leverages canonical calculateAhExpectedValue to guarantee exact quarter-line settlement symmetry.
   */
  public static computeAhLineProbabilities(
    scoreDist: BivariateScoreDistribution,
    line: number,
    marketOdds: number = 1.95,
    side: AhSide = 'HOME'
  ): AhLineProbability {
    // calculateAhExpectedValue handles full, half, and quarter lines
    const res = calculateAhExpectedValue(
      { matrix: scoreDist.matrix, maxGoals: scoreDist.maxGoals },
      line,
      marketOdds,
      side
    );

    const pCover = Number((res.pWin + 0.5 * res.pHalfWin).toFixed(4));

    return {
      line,
      side,
      pWin: res.pWin,
      pHalfWin: res.pHalfWin,
      pPush: res.pPush,
      pHalfLoss: res.pHalfLoss,
      pLoss: res.pLoss,
      pCover,
      fairOdds: res.fairOdds,
      ev: res.ev,
    };
  }

  /**
   * Asserts exact market symmetry between Home (line L) and Away (line -L).
   */
  public static verifySymmetry(
    scoreDist: BivariateScoreDistribution,
    line: number
  ): {
    symmetric: boolean;
    homeLine: AhLineProbability;
    awayLine: AhLineProbability;
    maxDiscrepancy: number;
  } {
    const homeLine = this.computeAhLineProbabilities(scoreDist, line, 1.95, 'HOME');
    const awayLine = this.computeAhLineProbabilities(scoreDist, -line, 1.95, 'AWAY');

    const dWin = Math.abs(homeLine.pWin - awayLine.pLoss);
    const dHalfWin = Math.abs(homeLine.pHalfWin - awayLine.pHalfLoss);
    const dPush = Math.abs(homeLine.pPush - awayLine.pPush);
    const dHalfLoss = Math.abs(homeLine.pHalfLoss - awayLine.pHalfWin);
    const dLoss = Math.abs(homeLine.pLoss - awayLine.pWin);

    const maxDiscrepancy = Math.max(dWin, dHalfWin, dPush, dHalfLoss, dLoss);
    const symmetric = maxDiscrepancy < 1e-3;

    return {
      symmetric,
      homeLine,
      awayLine,
      maxDiscrepancy,
    };
  }
}

