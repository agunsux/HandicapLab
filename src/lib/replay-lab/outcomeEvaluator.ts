/**
 * EPIC 16.7 — Outcome Evaluator
 * ===============================
 * Evaluates prediction outcomes against actual results.
 *
 * Computes all required metrics:
 *   win/loss/push, profit, ROI, yield, CLV, expected value realized,
 *   Brier Score, Log Loss, Calibration Error, Profit Factor,
 *   Sharpe Ratio, Max Drawdown, Longest Losing Streak, Kelly Growth.
 *
 * All metrics are deterministic for identical inputs.
 */

import type { ReplayOutcome } from '../replay/types';
import type { DetailedOutcomeMetrics } from './types';

export class OutcomeEvaluator {
  /**
   * Compute detailed outcome metrics from a list of replay outcomes.
   * Outcomes must contain profitLoss, brierScore, logLoss, clv, and predictedProbability.
   */
  evaluate(outcomes: readonly ReplayOutcome[]): DetailedOutcomeMetrics {
    const total = outcomes.length;
    if (total === 0) {
      return {
        totalPredictions: 0, won: 0, lost: 0, push: 0,
        profit: 0, roi: 0, yield_: 0,
        closingLineValue: 0, expectedValueRealized: 0,
        brierScore: 0, logLoss: 0, calibrationError: 0,
        profitFactor: 0, sharpeRatio: 0, maxDrawdown: 0,
        longestLosingStreak: 0, kellyGrowth: 0,
      };
    }

    const won = outcomes.filter((o) => o.actualResult === 1).length;
    const lost = outcomes.filter((o) => o.actualResult === 0).length;
    const push = outcomes.filter((o) => o.actualResult === 0.5).length;

    const profit = outcomes.reduce((s, o) => s + o.profitLoss, 0);
    const totalStake = total; // 1 unit per prediction
    const roi = totalStake > 0 ? (profit / totalStake) * 100 : 0;
    const yield_ = totalStake > 0 ? profit / totalStake : 0;

    const avgClv = outcomes.reduce((s, o) => s + (o.clv ?? 0), 0) / total;

    // Expected value realized: average of (actualResult - predictedProbability)
    const evRealized = outcomes.reduce((s, o) => s + (o.actualResult - o.predictedProbability), 0) / total;

    // Brier Score (already per-outcome, average them)
    const brierScore = outcomes.reduce((s, o) => s + o.brierScore, 0) / total;

    // Log Loss
    const logLoss = outcomes.reduce((s, o) => s + o.logLoss, 0) / total;

    // Calibration Error: MSE of predicted vs actual
    const calibrationError = outcomes.reduce((s, o) => {
      return s + Math.pow(o.predictedProbability - o.actualResult, 2);
    }, 0) / total;

    // Profit Factor: gross profit / gross loss
    const grossProfit = outcomes.filter((o) => o.profitLoss > 0).reduce((s, o) => s + o.profitLoss, 0);
    const grossLoss = Math.abs(outcomes.filter((o) => o.profitLoss < 0).reduce((s, o) => s + o.profitLoss, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? Infinity : 0);

    // Sharpe Ratio: mean(profit) / std(profit)
    const profits = outcomes.map((o) => o.profitLoss);
    const meanProfit = profits.reduce((s, p) => s + p, 0) / total;
    const variance = profits.reduce((s, p) => s + Math.pow(p - meanProfit, 2), 0) / total;
    const stdProfit = Math.sqrt(variance);
    const sharpeRatio = stdProfit > 0 ? meanProfit / stdProfit * Math.sqrt(total) : 0;

    // Max Drawdown
    let cumulative = 0;
    let peak = 0;
    let maxDd = 0;
    for (const o of outcomes) {
      cumulative += o.profitLoss;
      if (cumulative > peak) peak = cumulative;
      const dd = peak > 0 ? (peak - cumulative) / peak : 0;
      if (dd > maxDd) maxDd = dd;
    }

    // Longest Losing Streak
    let currentStreak = 0;
    let longestStreak = 0;
    for (const o of outcomes) {
      if (o.profitLoss <= 0) {
        currentStreak++;
        if (currentStreak > longestStreak) longestStreak = currentStreak;
      } else {
        currentStreak = 0;
      }
    }

    // Kelly Growth: sum of ln(1 + f * outcome) where f = kelly fraction
    const kellyGrowth = outcomes.reduce((s, o) => {
      const f = o.actualResult === 1 ? 0.25 : (o.actualResult === 0.5 ? 0 : -0.25);
      return s + Math.log(1 + f);
    }, 0);

    return {
      totalPredictions: total,
      won,
      lost,
      push,
      profit: Math.round(profit * 10000) / 10000,
      roi: Math.round(roi * 100) / 100,
      yield_: Math.round(yield_ * 10000) / 10000,
      closingLineValue: Math.round(avgClv * 10000) / 10000,
      expectedValueRealized: Math.round(evRealized * 10000) / 10000,
      brierScore: Math.round(brierScore * 10000) / 10000,
      logLoss: Math.round(logLoss * 10000) / 10000,
      calibrationError: Math.round(calibrationError * 10000) / 10000,
      profitFactor: profitFactor === Infinity ? Infinity : Math.round(profitFactor * 10000) / 10000,
      sharpeRatio: Math.round(sharpeRatio * 10000) / 10000,
      maxDrawdown: Math.round(maxDd * 10000) / 10000,
      longestLosingStreak: longestStreak,
      kellyGrowth: Math.round(kellyGrowth * 10000) / 10000,
    };
  }

  /** Evaluate a single outcome. */
  evaluateOne(outcome: ReplayOutcome): number {
    return outcome.profitLoss;
  }
}

export const defaultOutcomeEvaluator = new OutcomeEvaluator();