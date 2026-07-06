// HandicapLab Feature Intelligence - Multi-Objective Ranking Engine
import { FeatureDefinition } from '../feature-platform/registry';

export interface RankingMetrics {
  predictiveImportance: number; // 0 to 1
  stability: number;            // 0 to 1
  driftResistance: number;      // 0 to 1
  dataQuality: number;          // 0 to 1
  coverage: number;             // 0 to 1
  computationalCost: number;    // 0 to 1 (1 = lowest cost)
  explainability: number;       // 0 to 1
}

export interface RankedFeature {
  featureId: string;
  finalScore: number;
  metrics: RankingMetrics;
}

export class RankingEngine {
  /**
   * Weights defined by the Feature Intelligence specs
   */
  private static readonly WEIGHTS = {
    predictiveImportance: 0.30,
    stability: 0.20,
    driftResistance: 0.15,
    dataQuality: 0.10,
    coverage: 0.10,
    computationalCost: 0.10,
    explainability: 0.05
  };

  public static calculateScore(metrics: RankingMetrics): number {
    return (
      metrics.predictiveImportance * this.WEIGHTS.predictiveImportance +
      metrics.stability * this.WEIGHTS.stability +
      metrics.driftResistance * this.WEIGHTS.driftResistance +
      metrics.dataQuality * this.WEIGHTS.dataQuality +
      metrics.coverage * this.WEIGHTS.coverage +
      metrics.computationalCost * this.WEIGHTS.computationalCost +
      metrics.explainability * this.WEIGHTS.explainability
    );
  }

  public static rankFeatures(features: Record<string, RankingMetrics>): RankedFeature[] {
    const ranked: RankedFeature[] = [];

    for (const [featureId, metrics] of Object.entries(features)) {
      ranked.push({
        featureId,
        metrics,
        finalScore: this.calculateScore(metrics)
      });
    }

    return ranked.sort((a, b) => b.finalScore - a.finalScore);
  }
}
