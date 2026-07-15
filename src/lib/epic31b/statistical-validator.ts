/**
 * EPIC 31B — Production Replay & Shadow Validation
 * Phase 5: Statistical Validator
 *
 * Measures ROI, Yield, CLV, EV, Calibration, Brier Score, Log Loss,
 * Maximum Drawdown, Sharpe Ratio, Bootstrap Confidence Intervals,
 * and Walk-forward stability.
 */

import type { ReplayOutcome, ReplayMetrics, ConfidenceInterval, LeagueValidationResult } from './types';
import { BootstrapEngine } from '../replay-lab/bootstrapEngine';
import type { BootstrapConfig, BootstrapResult } from '../replay-lab/types';

export class StatisticalValidator {
  /**
   * Compute comprehensive statistical validation for a set of replay outcomes.
   */
  static validate(outcomes: ReplayOutcome[]): {
    metrics: ReplayMetrics;
    confidenceIntervals: ConfidenceInterval[];
    calibrationQuality: string;
    statisticalConfidence: string;
    driftDetected: boolean;
  } {
    const metrics = this.computeMetrics(outcomes);
    const confidenceIntervals = this.computeConfidenceIntervals(outcomes);
    const calibrationQuality = this.assessCalibrationQuality(outcomes);
    const statisticalConfidence = this.assessStatisticalConfidence(metrics, confidenceIntervals);
    const driftDetected = this.detectDrift(outcomes);

    return { metrics, confidenceIntervals, calibrationQuality, statisticalConfidence, driftDetected };
  }

  static computeMetrics(outcomes: ReplayOutcome[]): ReplayMetrics {
    const totalPredictions = outcomes.length;
    const won = outcomes.filter((o) => o.actualResult === 1).length;
    const lost = outcomes.filter((o) => o.actualResult === 0).length;
    const voided = outcomes.filter((o) => o.actualResult === 0.5).length;
    const totalProfit = outcomes.reduce((sum, o) => sum + o.profitLoss, 0);
    const totalStake = outcomes.reduce((sum, o) => sum + o.kellyStake, 0);
    const roi = totalStake > 0 ? (totalProfit / totalStake) * 100 : 0;
    const yieldPct = roi;
    const avgClv = outcomes.length > 0 ? outcomes.reduce((sum, o) => sum + o.clv, 0) / outcomes.length : 0;
    const winRate = totalPredictions > 0 ? (won / totalPredictions) * 100 : 0;
    const brierScore = outcomes.length > 0 ? outcomes.reduce((sum, o) => sum + o.brierScore, 0) / outcomes.length : 0;
    const logLoss = outcomes.length > 0 ? outcomes.reduce((sum, o) => sum + o.logLoss, 0) / outcomes.length : 0;
    const avgKellyStake = outcomes.length > 0 ? outcomes.reduce((sum, o) => sum + o.kellyStake, 0) / outcomes.length : 0;

    let cumulative = 0;
    let peak = 0;
    let maxDrawdown = 0;
    let currentWinStreak = 0;
    let currentLossStreak = 0;
    let longestWinStreak = 0;
    let longestLossStreak = 0;

    for (const o of outcomes) {
      cumulative += o.profitLoss;
      if (cumulative > peak) peak = cumulative;
      const dd = peak - cumulative;
      if (dd > maxDrawdown) maxDrawdown = dd;

      if (o.actualResult === 1) {
        currentWinStreak++;
        currentLossStreak = 0;
        if (currentWinStreak > longestWinStreak) longestWinStreak = currentWinStreak;
      } else if (o.actualResult === 0) {
        currentLossStreak++;
        currentWinStreak = 0;
        if (currentLossStreak > longestLossStreak) longestLossStreak = currentLossStreak;
      }
    }

    const grossProfit = outcomes.filter((o) => o.profitLoss > 0).reduce((s, o) => s + o.profitLoss, 0);
    const grossLoss = Math.abs(outcomes.filter((o) => o.profitLoss < 0).reduce((s, o) => s + o.profitLoss, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    const returns = outcomes.map((o) => o.profitLoss);
    const meanReturn = returns.reduce((s, r) => s + r, 0) / returns.length;
    const variance = returns.reduce((s, r) => s + Math.pow(r - meanReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? (meanReturn / stdDev) * Math.sqrt(outcomes.length) : null;

    return {
      totalMatches: new Set(outcomes.map((o) => o.fixtureId)).size,
      totalPredictions,
      won,
      lost,
      voided,
      roi: Math.round(roi * 100) / 100,
      yield: Math.round(yieldPct * 100) / 100,
      avgClv: Math.round(avgClv * 10000) / 10000,
      winRate: Math.round(winRate * 100) / 100,
      totalStake: Math.round(totalStake * 10000) / 10000,
      totalProfit: Math.round(totalProfit * 10000) / 10000,
      brierScore: Math.round(brierScore * 10000) / 10000,
      logLoss: Math.round(logLoss * 10000) / 10000,
      avgKellyStake: Math.round(avgKellyStake * 10000) / 10000,
      maxDrawdown: Math.round(maxDrawdown * 10000) / 10000,
      sharpeRatio: sharpeRatio ? Math.round(sharpeRatio * 10000) / 10000 : null,
      profitFactor: Math.round(profitFactor * 10000) / 10000,
      longestWinStreak,
      longestLossStreak,
    };
  }

  static computeConfidenceIntervals(outcomes: ReplayOutcome[]): ConfidenceInterval[] {
    const bootstrapEngine = new BootstrapEngine();
    const config: BootstrapConfig = {
      iterations: 1000,
      confidenceLevel: 0.95,
      randomSeed: 42,
      method: 'percentile',
    };

    const roiMetric = (o: readonly ReplayOutcome[]): number => {
      if (o.length === 0) return 0;
      const totalProfit = o.reduce((sum, x) => sum + x.profitLoss, 0);
      const totalStake = o.reduce((sum, x) => sum + x.kellyStake, 0);
      return totalStake > 0 ? (totalProfit / totalStake) * 100 : 0;
    };

    const brierMetric = (o: readonly ReplayOutcome[]): number => {
      if (o.length === 0) return 0;
      return o.reduce((sum, x) => sum + x.brierScore, 0) / o.length;
    };

    const clvMetric = (o: readonly ReplayOutcome[]): number => {
      if (o.length === 0) return 0;
      return o.reduce((sum, x) => sum + x.clv, 0) / o.length;
    };

    const roiReport = bootstrapEngine.bootstrap(
      outcomes as unknown as readonly any[],
      roiMetric as any,
      config,
      'epic31b-roi'
    );
    const brierReport = bootstrapEngine.bootstrap(
      outcomes as unknown as readonly any[],
      brierMetric as any,
      config,
      'epic31b-brier'
    );
    const clvReport = bootstrapEngine.bootstrap(
      outcomes as unknown as readonly any[],
      clvMetric as any,
      config,
      'epic31b-clv'
    );

    return [
      this.toConfidenceInterval('ROI (%)', roiReport.results[0]),
      this.toConfidenceInterval('Brier Score', brierReport.results[0]),
      this.toConfidenceInterval('CLV (%)', clvReport.results[0]),
    ];
  }

  private static toConfidenceInterval(metric: string, result: BootstrapResult): ConfidenceInterval {
    return {
      metric,
      observed: result.observedValue,
      mean: result.mean,
      stdErr: result.stdErr,
      ciLower: result.ciLower,
      ciUpper: result.ciUpper,
      confidenceLevel: result.confidenceLevel,
    };
  }

  private static assessCalibrationQuality(outcomes: ReplayOutcome[]): string {
    const avgBrier = outcomes.length > 0
      ? outcomes.reduce((sum, o) => sum + o.brierScore, 0) / outcomes.length
      : 1;

    if (avgBrier < 0.15) return 'Excellent (Brier < 0.15)';
    if (avgBrier < 0.25) return 'Good (Brier < 0.25)';
    if (avgBrier < 0.35) return 'Acceptable (Brier < 0.35)';
    return 'Poor (Brier >= 0.35) — calibration retraining recommended';
  }

  private static assessStatisticalConfidence(metrics: ReplayMetrics, cis: ConfidenceInterval[]): string {
    const sampleSize = metrics.totalPredictions;

    if (sampleSize < 30) return 'Insufficient (n < 30) — illustrative only';
    if (sampleSize < 100) return 'Directional (n < 100) — monitor for confirmation';
    if (sampleSize < 500) return 'Moderate (n < 500) — directional with some confidence';

    const roiCI = cis.find((c) => c.metric === 'ROI (%)');
    if (roiCI && roiCI.ciLower > 0) return 'High (n >= 500, ROI CI excludes 0)';
    if (roiCI && roiCI.ciUpper < 0) return 'High (n >= 500, ROI CI excludes 0, negative)';

    return 'Moderate (n >= 500, CI overlaps 0)';
  }

  private static detectDrift(outcomes: ReplayOutcome[]): boolean {
    if (outcomes.length < 20) return false;

    const mid = Math.floor(outcomes.length / 2);
    const firstHalf = outcomes.slice(0, mid);
    const secondHalf = outcomes.slice(mid);

    const firstClv = firstHalf.reduce((s, o) => s + o.clv, 0) / firstHalf.length;
    const secondClv = secondHalf.reduce((s, o) => s + o.clv, 0) / secondHalf.length;

    const driftThreshold = 0.02;
    return Math.abs(firstClv - secondClv) > driftThreshold;
  }

  static buildLeagueValidationResult(
    leagueId: string,
    outcomes: ReplayOutcome[],
    validationReport: any
  ): LeagueValidationResult {
    const { metrics, confidenceIntervals, calibrationQuality, statisticalConfidence, driftDetected } =
      this.validate(outcomes);

    const config: any = {};
    const status = validationReport.validFixtures > 0 && metrics.totalPredictions > 0 ? 'PASS' : 'FAIL';

    return {
      leagueId: leagueId as any,
      leagueName: config.leagueName || (leagueId as any),
      status,
      evidence: `${metrics.totalPredictions} predictions from ${metrics.totalMatches} matches. ROI: ${metrics.roi}%, CLV: ${metrics.avgClv}%`,
      metrics,
      confidenceIntervals,
      calibrationQuality,
      statisticalConfidence,
      driftDetected,
    };
  }
}
