/**
 * EPIC 17.4 — Evaluation Metrics Engine
 */

import type { ReplayOutcome } from '../replay/types';
import type { EvaluationMetricsResult } from './types';

export class MetricsEngine {
  evaluate(outcomes: readonly ReplayOutcome[]): EvaluationMetricsResult {
    const total = outcomes.length;
    if (total === 0) return this.emptyResult();

    const won = outcomes.filter((o) => o.actualResult === 1).length;
    const lost = outcomes.filter((o) => o.actualResult === 0).length;
    const push = outcomes.filter((o) => o.actualResult === 0.5).length;

    const profit = outcomes.reduce((s, o) => s + o.profitLoss, 0);
    const totalStake = total;
    const roi = totalStake > 0 ? (profit / totalStake) * 100 : 0;
    const yield_ = totalStake > 0 ? profit / totalStake : 0;
    const netProfit = profit;

    // Use clv as proxy for expected value since ReplayOutcome doesn't have expectedValue
    const avgEv = outcomes.reduce((s, o) => s + (o.clv ?? 0), 0) / total;
    const avgClv = outcomes.reduce((s, o) => s + (o.clv ?? 0), 0) / total;

    const hitRate = total > 0 ? (won + push) / total : 0;
    const winRate = total > 0 ? won / total : 0;
    const lossRate = total > 0 ? lost / total : 0;
    const pushRate = total > 0 ? push / total : 0;

    const brierScore = outcomes.reduce((s, o) => s + o.brierScore, 0) / total;
    const logLoss = outcomes.reduce((s, o) => s + o.logLoss, 0) / total;
    const calibrationError = outcomes.reduce((s, o) => s + Math.pow(o.predictedProbability - o.actualResult, 2), 0) / total;

    let cumulative = 0, peak = 0, maxDd = 0;
    for (const o of outcomes) {
      cumulative += o.profitLoss;
      if (cumulative > peak) peak = cumulative;
      const dd = peak > 0 ? (peak - cumulative) / peak : 0;
      if (dd > maxDd) maxDd = dd;
    }

    const grossProfit = Math.abs(outcomes.filter((o) => o.profitLoss > 0).reduce((s, o) => s + o.profitLoss, 0));
    const grossLoss = Math.abs(outcomes.filter((o) => o.profitLoss < 0).reduce((s, o) => s + o.profitLoss, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? Infinity : 0);

    const profits = outcomes.map((o) => o.profitLoss);
    const meanP = profits.reduce((s, p) => s + p, 0) / total;
    const varP = profits.reduce((s, p) => s + Math.pow(p - meanP, 2), 0) / total;
    const stdP = Math.sqrt(varP);
    const sharpeRatio = stdP > 0 ? (meanP / stdP) * Math.sqrt(total) : 0;

    const downside = profits.filter((p) => p < 0).map((p) => Math.pow(p, 2));
    const downsideDev = Math.sqrt(downside.reduce((s, d) => s + d, 0) / (downside.length || 1));
    const sortinoRatio = downsideDev > 0 ? (meanP / downsideDev) * Math.sqrt(total) : 0;

    const kellyGrowth = outcomes.reduce((s, o) => {
      const f = o.actualResult === 1 ? 0.25 : (o.actualResult === 0.5 ? 0 : -0.25);
      return s + Math.log(1 + f);
    }, 0);

    const avgOdds = outcomes.reduce((s, o) => {
      const odds = o.profitLoss >= 0 ? (o.profitLoss + 1) : (1 - Math.abs(o.profitLoss));
      return s + Math.max(odds, 1);
    }, 0) / total;

    const betFrequency = total > 0 ? 1 : 0;
    const expectedVsActual = outcomes.reduce((s, o) => s + (o.predictedProbability - o.actualResult), 0) / total;

    return {
      roi: Math.round(roi * 100) / 100,
      yield_: Math.round(yield_ * 10000) / 10000,
      netProfit: Math.round(netProfit * 10000) / 10000,
      expectedValue: Math.round(avgEv * 10000) / 10000,
      closingLineValue: Math.round(avgClv * 10000) / 10000,
      hitRate: Math.round(hitRate * 10000) / 10000,
      winRate: Math.round(winRate * 10000) / 10000,
      lossRate: Math.round(lossRate * 10000) / 10000,
      pushRate: Math.round(pushRate * 10000) / 10000,
      brierScore: Math.round(brierScore * 10000) / 10000,
      logLoss: Math.round(logLoss * 10000) / 10000,
      calibrationError: Math.round(calibrationError * 10000) / 10000,
      maxDrawdown: Math.round(maxDd * 10000) / 10000,
      profitFactor: profitFactor === Infinity ? Infinity : Math.round(profitFactor * 10000) / 10000,
      sharpeRatio: Math.round(sharpeRatio * 10000) / 10000,
      sortinoRatio: Math.round(sortinoRatio * 10000) / 10000,
      kellyGrowth: Math.round(kellyGrowth * 10000) / 10000,
      averageOdds: Math.round(avgOdds * 10000) / 10000,
      betFrequency: Math.round(betFrequency * 10000) / 10000,
      expectedVsActual: Math.round(expectedVsActual * 10000) / 10000,
    };
  }

  private emptyResult(): EvaluationMetricsResult {
    return {
      roi: 0, yield_: 0, netProfit: 0, expectedValue: 0, closingLineValue: 0,
      hitRate: 0, winRate: 0, lossRate: 0, pushRate: 0,
      brierScore: 0, logLoss: 0, calibrationError: 0,
      maxDrawdown: 0, profitFactor: 0, sharpeRatio: 0, sortinoRatio: 0,
      kellyGrowth: 0, averageOdds: 0, betFrequency: 0, expectedVsActual: 0,
    };
  }
}

export const defaultMetricsEngine = new MetricsEngine();