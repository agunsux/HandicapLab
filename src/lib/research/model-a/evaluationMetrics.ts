/**
 * Baseline Statistical & Betting Evaluation Metrics for Model A
 * Location: src/lib/research/model-a/evaluationMetrics.ts
 */

import {
  MatchOutcomeMetrics,
  AhEvaluationMetrics,
  BettingDiagnostic,
} from './types';
import { settleAsianHandicapBet } from '../ahSettlementEngine';

export interface EvaluatedAhRecord {
  canonicalId: string;
  matchDate: string;
  homeGoals: number;
  awayGoals: number;
  line: number;
  side: 'HOME' | 'AWAY';
  marketOdds: number;
  pCover: number;
  pWin: number;
  pHalfWin: number;
  pPush: number;
  pHalfLoss: number;
  pLoss: number;
  ev: number;
}

export class EvaluationMetricsEngine {
  /**
   * Evaluates match 1X2 outcomes: Log Loss, Brier Score, and Goal MAE.
   */
  public static computeMatchOutcomeMetrics(
    predictions: Array<{
      actualHomeGoals: number;
      actualAwayGoals: number;
      homeLambda: number;
      awayLambda: number;
      pHomeWin: number;
      pDraw: number;
      pAwayWin: number;
    }>
  ): MatchOutcomeMetrics {
    const n = predictions.length;
    if (n === 0) {
      return { logLoss: 0, brierScore: 0, maeHomeGoals: 0, maeAwayGoals: 0, totalMatches: 0 };
    }

    let totalLogLoss = 0;
    let totalBrier = 0;
    let totalMaeHome = 0;
    let totalMaeAway = 0;

    for (const p of predictions) {
      const yH = p.actualHomeGoals > p.actualAwayGoals ? 1 : 0;
      const yD = p.actualHomeGoals === p.actualAwayGoals ? 1 : 0;
      const yA = p.actualHomeGoals < p.actualAwayGoals ? 1 : 0;

      // Safe clamp to avoid Math.log(0)
      const eps = 1e-6;
      const pH = Math.max(eps, Math.min(1 - eps, p.pHomeWin));
      const pD = Math.max(eps, Math.min(1 - eps, p.pDraw));
      const pA = Math.max(eps, Math.min(1 - eps, p.pAwayWin));

      totalLogLoss -= (yH * Math.log(pH) + yD * Math.log(pD) + yA * Math.log(pA));
      totalBrier += (pH - yH) ** 2 + (pD - yD) ** 2 + (pA - yA) ** 2;

      totalMaeHome += Math.abs(p.homeLambda - p.actualHomeGoals);
      totalMaeAway += Math.abs(p.awayLambda - p.actualAwayGoals);
    }

    return {
      logLoss: Number((totalLogLoss / n).toFixed(4)),
      brierScore: Number((totalBrier / n).toFixed(4)),
      maeHomeGoals: Number((totalMaeHome / n).toFixed(4)),
      maeAwayGoals: Number((totalMaeAway / n).toFixed(4)),
      totalMatches: n,
    };
  }

  /**
   * Evaluates AH probability forecast calibration and Brier score.
   */
  public static computeAhEvaluationMetrics(
    records: EvaluatedAhRecord[],
    numBins = 10
  ): AhEvaluationMetrics {
    const n = records.length;
    if (n === 0) {
      return { ahBrierScore: 0, ahLogLoss: 0, ece: 0, numEvaluatedOdds: 0 };
    }

    let totalBrier = 0;
    let totalLogLoss = 0;
    let decidedCount = 0;

    const predProbs: number[] = [];
    const actualScores: number[] = [];

    for (const r of records) {
      const settlement = settleAsianHandicapBet(
        r.homeGoals,
        r.awayGoals,
        r.line,
        r.marketOdds,
        r.side
      );

      // Graded settlement target:
      // WIN => 1.0, HALF_WIN => 0.75, PUSH => 0.50, HALF_LOSS => 0.25, LOSS => 0.0
      let targetScore = 0.0;
      if (settlement.outcome === 'WIN') targetScore = 1.0;
      else if (settlement.outcome === 'HALF_WIN') targetScore = 0.75;
      else if (settlement.outcome === 'PUSH') targetScore = 0.50;
      else if (settlement.outcome === 'HALF_LOSS') targetScore = 0.25;
      else targetScore = 0.0;

      totalBrier += (r.pCover - targetScore) ** 2;
      predProbs.push(r.pCover);
      actualScores.push(targetScore);

      if (settlement.outcome !== 'PUSH') {
        const binTarget = targetScore >= 0.75 ? 1 : 0;
        const eps = 1e-5;
        const pSafe = Math.max(eps, Math.min(1 - eps, r.pCover));
        totalLogLoss -= (binTarget * Math.log(pSafe) + (1 - binTarget) * Math.log(1 - pSafe));
        decidedCount++;
      }
    }

    // Expected Calibration Error (ECE)
    let ece = 0;
    const binWidth = 1.0 / numBins;
    for (let b = 0; b < numBins; b++) {
      const bMin = b * binWidth;
      const bMax = (b + 1) * binWidth;

      let binPredSum = 0;
      let binActualSum = 0;
      let binCount = 0;

      for (let i = 0; i < n; i++) {
        const p = predProbs[i];
        if (p >= bMin && (b === numBins - 1 ? p <= bMax : p < bMax)) {
          binPredSum += p;
          binActualSum += actualScores[i];
          binCount++;
        }
      }

      if (binCount > 0) {
        const avgPred = binPredSum / binCount;
        const avgActual = binActualSum / binCount;
        ece += (binCount / n) * Math.abs(avgPred - avgActual);
      }
    }

    return {
      ahBrierScore: Number((totalBrier / n).toFixed(4)),
      ahLogLoss: Number((decidedCount > 0 ? totalLogLoss / decidedCount : 0).toFixed(4)),
      ece: Number(ece.toFixed(4)),
      numEvaluatedOdds: n,
    };
  }

  /**
   * Diagnostic fixed-stake betting simulation:
   * Bets 1 unit whenever theoretical EV > 0 on pre-match opening odds.
   */
  public static computeBettingDiagnostic(
    records: EvaluatedAhRecord[],
    evThreshold: number = 0.0
  ): BettingDiagnostic {
    // Sort chronologically
    const sorted = [...records].sort((a, b) => a.matchDate.localeCompare(b.matchDate));

    let totalBets = 0;
    let turnover = 0;
    let totalProfit = 0;
    let peakCumulative = 0;
    let maxDrawdown = 0;
    let currentCumulative = 0;

    let winCount = 0;
    let halfWinCount = 0;
    let pushCount = 0;
    let halfLossCount = 0;
    let lossCount = 0;

    for (const r of sorted) {
      if (r.ev <= evThreshold) continue;

      const settlement = settleAsianHandicapBet(
        r.homeGoals,
        r.awayGoals,
        r.line,
        r.marketOdds,
        r.side,
        1.0 // 1 unit stake
      );

      totalBets++;
      turnover += 1.0;
      totalProfit += settlement.profit;
      currentCumulative += settlement.profit;

      if (currentCumulative > peakCumulative) {
        peakCumulative = currentCumulative;
      }
      const drawdown = peakCumulative - currentCumulative;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }

      if (settlement.outcome === 'WIN') winCount++;
      else if (settlement.outcome === 'HALF_WIN') halfWinCount++;
      else if (settlement.outcome === 'PUSH') pushCount++;
      else if (settlement.outcome === 'HALF_LOSS') halfLossCount++;
      else lossCount++;
    }

    const roi = turnover > 0 ? Number((totalProfit / turnover).toFixed(4)) : 0;

    return {
      selectionRule: `Fixed 1.0 unit stake where EV > ${evThreshold.toFixed(2)}`,
      totalBets,
      turnover: Number(turnover.toFixed(2)),
      totalProfit: Number(totalProfit.toFixed(4)),
      roi,
      maxDrawdown: Number(maxDrawdown.toFixed(4)),
      winCount,
      halfWinCount,
      pushCount,
      halfLossCount,
      lossCount,
    };
  }
}

