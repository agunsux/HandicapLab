/**
 * EPIC 16.12 — Research Dashboard Data Layer
 * ============================================
 * Generates machine-readable datasets for research dashboards.
 *
 * Exposes: Replay Timeline, Calibration Curve, Profit Curve,
 * Drawdown Curve, ROI Timeline, Model Comparison, Feature Comparison,
 * Confidence Distribution, Probability Histogram, Outcome Distribution.
 */

import type { ReplayOutcome, ReplayMetrics } from '../replay/types';
import type { ReplaySessionSnapshot, PredictionSnapshot, ComparisonReport } from './types';
import type {
  DashboardDataset,
  TimelinePoint,
  CalibrationPoint,
  ProfitPoint,
  DrawdownPoint,
  RoiPoint,
  ModelComparisonPoint,
  FeatureComparisonPoint,
  DistributionBin,
  OutcomeDistPoint,
} from './types';
import { generateDashboardId } from './id';
import { OutcomeEvaluator } from './outcomeEvaluator';

export class DashboardEngine {
  private readonly evaluator = new OutcomeEvaluator();

  /**
   * Generate a complete dashboard dataset from replay outcomes.
   */
  generate(
    session: ReplaySessionSnapshot,
    outcomes: readonly ReplayOutcome[],
    snapshots: readonly PredictionSnapshot[],
    comparisons: readonly ComparisonReport[] = []
  ): DashboardDataset {
    return {
      dashboardId: generateDashboardId(),
      generatedAt: new Date().toISOString(),
      replayTimeline: this.buildTimeline(outcomes),
      calibrationCurve: this.buildCalibrationCurve(outcomes),
      profitCurve: this.buildProfitCurve(outcomes),
      drawdownCurve: this.buildDrawdownCurve(outcomes),
      roiTimeline: this.buildRoiTimeline(outcomes, 20),
      modelComparison: this.buildModelComparison(session, comparisons),
      featureComparison: [],
      confidenceDistribution: this.buildConfidenceDistribution(snapshots),
      probabilityHistogram: this.buildProbabilityHistogram(outcomes),
      outcomeDistribution: this.buildOutcomeDistribution(outcomes),
    };
  }

  private buildTimeline(outcomes: readonly ReplayOutcome[]): TimelinePoint[] {
    return outcomes.map((o, i) => ({
      sessionId: '',
      fixtureId: o.matchId,
      kickoff: '',
      predictedProbability: o.predictedProbability,
      actualResult: o.actualResult,
      profitLoss: o.profitLoss,
    }));
  }

  private buildCalibrationCurve(outcomes: readonly ReplayOutcome[]): CalibrationPoint[] {
    const bins = new Map<number, { expected: number; observed: number; count: number }>();
    for (let i = 0; i < 10; i++) bins.set(i, { expected: 0, observed: 0, count: 0 });

    for (const o of outcomes) {
      const binIdx = Math.min(9, Math.floor(o.predictedProbability * 10));
      const bin = bins.get(binIdx)!;
      bin.expected += o.predictedProbability;
      bin.observed += o.actualResult;
      bin.count++;
    }

    return Array.from(bins.entries())
      .filter(([_, b]) => b.count > 0)
      .map(([binIdx, b]) => ({
        bin: binIdx * 10 + 5,
        expected: Math.round((b.expected / b.count) * 10000) / 10000,
        observed: Math.round((b.observed / b.count) * 10000) / 10000,
        count: b.count,
      }))
      .sort((a, b) => a.bin - b.bin);
  }

  private buildProfitCurve(outcomes: readonly ReplayOutcome[]): ProfitPoint[] {
    let cumulative = 0;
    let peak = 0;
    return outcomes.map((o, i) => {
      cumulative += o.profitLoss;
      if (cumulative > peak) peak = cumulative;
      const dd = peak > 0 ? (peak - cumulative) / peak : 0;
      return { fixtureIndex: i, cumulativeProfit: Math.round(cumulative * 10000) / 10000, drawdown: Math.round(dd * 10000) / 10000 };
    });
  }

  private buildDrawdownCurve(outcomes: readonly ReplayOutcome[]): DrawdownPoint[] {
    let cumulative = 0;
    let peak = 0;
    return outcomes.map((o, i) => {
      cumulative += o.profitLoss;
      if (cumulative > peak) peak = cumulative;
      const ddPct = peak > 0 ? ((peak - cumulative) / peak) * 100 : 0;
      return { fixtureIndex: i, drawdownPct: Math.round(ddPct * 100) / 100 };
    });
  }

  private buildRoiTimeline(outcomes: readonly ReplayOutcome[], windowSize: number): RoiPoint[] {
    const points: RoiPoint[] = [];
    for (let i = windowSize; i <= outcomes.length; i += windowSize) {
      const window = outcomes.slice(i - windowSize, i);
      const profit = window.reduce((s, o) => s + o.profitLoss, 0);
      const roi = window.length > 0 ? (profit / window.length) * 100 : 0;
      points.push({ fixtureIndex: i, rollingRoi: Math.round(roi * 100) / 100, windowSize });
    }
    return points;
  }

  private buildModelComparison(
    session: ReplaySessionSnapshot,
    comparisons: readonly ComparisonReport[]
  ): ModelComparisonPoint[] {
    const points: ModelComparisonPoint[] = [];
    if (session.metrics) {
      points.push({
        modelId: session.modelVersion,
        baselineId: session.baselineId,
        roi: session.metrics.roi,
        brierScore: session.metrics.brierScore,
        sharpeRatio: 0,
        maxDrawdown: 0,
      });
    }
    for (const cmp of comparisons) {
      points.push({
        modelId: cmp.sessionB,
        baselineId: cmp.baselineB,
        roi: 0,
        brierScore: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
      });
    }
    return points;
  }

  private buildConfidenceDistribution(snapshots: readonly PredictionSnapshot[]): DistributionBin[] {
    const bins = new Map<number, number>();
    for (let i = 0; i < 10; i++) bins.set(i, 0);
    for (const s of snapshots) {
      const idx = Math.min(9, Math.floor(s.confidence * 10));
      bins.set(idx, (bins.get(idx) ?? 0) + 1);
    }
    const total = snapshots.length || 1;
    return Array.from(bins.entries())
      .map(([binIdx, count]) => ({
        binLower: binIdx * 0.1,
        binUpper: (binIdx + 1) * 0.1,
        count,
        frequency: Math.round((count / total) * 10000) / 10000,
      }))
      .sort((a, b) => a.binLower - b.binLower);
  }

  private buildProbabilityHistogram(outcomes: readonly ReplayOutcome[]): DistributionBin[] {
    const bins = new Map<number, number>();
    for (let i = 0; i < 10; i++) bins.set(i, 0);
    for (const o of outcomes) {
      const idx = Math.min(9, Math.floor(o.predictedProbability * 10));
      bins.set(idx, (bins.get(idx) ?? 0) + 1);
    }
    const total = outcomes.length || 1;
    return Array.from(bins.entries())
      .map(([binIdx, count]) => ({
        binLower: binIdx * 0.1,
        binUpper: (binIdx + 1) * 0.1,
        count,
        frequency: Math.round((count / total) * 10000) / 10000,
      }))
      .sort((a, b) => a.binLower - b.binLower);
  }

  private buildOutcomeDistribution(outcomes: readonly ReplayOutcome[]): OutcomeDistPoint[] {
    const won = outcomes.filter((o) => o.actualResult === 1).length;
    const lost = outcomes.filter((o) => o.actualResult === 0).length;
    const push = outcomes.filter((o) => o.actualResult === 0.5).length;
    const total = outcomes.length || 1;
    return [
      { outcome: 'won', count: won, frequency: Math.round((won / total) * 10000) / 10000 },
      { outcome: 'lost', count: lost, frequency: Math.round((lost / total) * 10000) / 10000 },
      { outcome: 'push', count: push, frequency: Math.round((push / total) * 10000) / 10000 },
    ];
  }
}

export const defaultDashboardEngine = new DashboardEngine();