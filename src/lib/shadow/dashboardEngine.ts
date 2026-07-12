/**
 * 21.8 — Live Performance Dashboard Engine
 * Aggregates metrics across today, week, month, season, overall.
 */

import type { DashboardReport, DashboardMetrics, DashboardBreakdown, LiveEvaluationResult, ResearchEntry } from './types';
import { generateDashboardId } from './id';

export class ShadowDashboardEngine {
  generate(entries: readonly ResearchEntry[], evaluations: readonly LiveEvaluationResult[], period: DashboardReport['period'] = 'overall'): DashboardReport {
    const total = entries.length;
    const won = entries.filter((e) => e.actualResult === 1).length;
    const lost = entries.filter((e) => e.actualResult === 0).length;
    const profit = entries.reduce((s, e) => s + e.profit, 0);
    const totalStake = entries.reduce((s, e) => s + e.stake, 0);
    const roi = totalStake > 0 ? (profit / totalStake) * 100 : 0;
    const yield_ = totalStake > 0 ? profit / totalStake : 0;
    const avgClv = entries.length > 0 ? entries.reduce((s, e) => s + e.clv, 0) / entries.length : 0;
    const winRate = total > 0 ? (won / total) * 100 : 0;
    const avgEv = entries.length > 0 ? entries.reduce((s, e) => s + (e.predictedProb - e.marketOdds), 0) / entries.length : 0;
    const avgBrier = evaluations.length > 0 ? evaluations.reduce((s, e) => s + e.brierScore, 0) / evaluations.length : 0;

    // Sharpe
    const profits = entries.map((e) => e.profit);
    const meanP = profits.reduce((s, p) => s + p, 0) / (profits.length || 1);
    const varP = profits.reduce((s, p) => s + Math.pow(p - meanP, 2), 0) / (profits.length || 1);
    const sharpe = Math.sqrt(varP) > 0 ? (meanP / Math.sqrt(varP)) * Math.sqrt(profits.length) : 0;

    // Kelly Growth
    const kellyGrowth = entries.reduce((s, e) => {
      const f = e.actualResult === 1 ? 0.25 : e.actualResult === 0.5 ? 0 : -0.25;
      return s + Math.log(1 + f);
    }, 0);

    // Max Drawdown
    let cumulative = 0, peak = 0, maxDd = 0;
    for (const e of entries) {
      cumulative += e.profit;
      if (cumulative > peak) peak = cumulative;
      const dd = peak > 0 ? (peak - cumulative) / peak : 0;
      if (dd > maxDd) maxDd = dd;
    }

    const metrics: DashboardMetrics = {
      totalPredictions: total, roi: Math.round(roi * 100) / 100, yield_: Math.round(yield_ * 10000) / 10000,
      clv: Math.round(avgClv * 10000) / 10000, winRate: Math.round(winRate * 100) / 100,
      expectedValue: Math.round(avgEv * 10000) / 10000, calibration: Math.round(avgBrier * 10000) / 10000,
      brierScore: Math.round(avgBrier * 10000) / 10000, sharpeRatio: Math.round(sharpe * 10000) / 10000,
      kellyGrowth: Math.round(kellyGrowth * 10000) / 10000, maxDrawdown: Math.round(maxDd * 10000) / 10000,
      averageEdge: Math.round(avgEv * 10000) / 10000,
    };

    const breakdown: DashboardBreakdown = {
      byRecommendation: {},
      byLeague: {},
      byMarket: entries.reduce((acc, e) => ({ ...acc, [e.market]: (acc[e.market] ?? 0) + 1 }), {} as Record<string, number>),
      byPolicy: entries.reduce((acc, e) => ({ ...acc, [e.policyUsed]: (acc[e.policyUsed] ?? 0) + 1 }), {} as Record<string, number>),
    };

    return { dashboardId: generateDashboardId(), generatedAt: new Date().toISOString(), period, metrics, breakdown };
  }
}

export const defaultShadowDashboardEngine = new ShadowDashboardEngine();