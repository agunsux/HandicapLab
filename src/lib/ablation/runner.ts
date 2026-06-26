import { ExperimentConfig, ComparisonResult } from './types';
import { AccuracyCalculator } from '../metrics/accuracy-calculator';

export class AblationRunner {
  /**
   * Runs an ablation experiment by comparing variant configurations against a baseline configuration.
   * Utilizes the AccuracyCalculator to pull historical database metrics.
   * 
   * @param config Experiment config containing baseline, variants, dateRange, and filters
   */
  public static async runExperiment(
    config: ExperimentConfig
  ): Promise<{ baseline: ComparisonResult; variants: ComparisonResult[] }> {
    const days = Math.ceil((config.dateRange.end.getTime() - config.dateRange.start.getTime()) / (24 * 60 * 60 * 1000));

    // 1. Fetch baseline metrics
    const baselineStats = await AccuracyCalculator.getMetrics({
      model_version: config.baseline.modelVersion,
      days
    });

    const baselineResult: ComparisonResult = {
      variant: 'Baseline',
      modelVersion: config.baseline.modelVersion,
      featureVersion: config.baseline.featureVersion,
      metrics: {
        totalPredictions: baselineStats.overall.totalPredictions,
        winRate: baselineStats.overall.winRate,
        roi: baselineStats.overall.roi,
        avgBrierScore: baselineStats.overall.avgBrierScore,
        avgCLV: baselineStats.overall.avgCLV,
        totalProfit: baselineStats.overall.totalProfit
      },
      vsBaseline: {
        winRateDelta: 0,
        roiDelta: 0,
        brierDelta: 0,
        clvDelta: 0
      }
    };

    // 2. Fetch and evaluate variants
    const variants: ComparisonResult[] = [];

    for (const variant of config.variants) {
      try {
        const variantStats = await AccuracyCalculator.getMetrics({
          model_version: variant.modelVersion,
          days
        });

        const winRateDelta = variantStats.overall.winRate - baselineResult.metrics.winRate;
        const roiDelta = variantStats.overall.roi - baselineResult.metrics.roi;
        const brierDelta = variantStats.overall.avgBrierScore - baselineResult.metrics.avgBrierScore;
        const clvDelta = (variantStats.overall.avgCLV ?? 0) - (baselineResult.metrics.avgCLV ?? 0);

        variants.push({
          variant: variant.name,
          modelVersion: variant.modelVersion,
          featureVersion: variant.featureVersion,
          metrics: {
            totalPredictions: variantStats.overall.totalPredictions,
            winRate: variantStats.overall.winRate,
            roi: variantStats.overall.roi,
            avgBrierScore: variantStats.overall.avgBrierScore,
            avgCLV: variantStats.overall.avgCLV,
            totalProfit: variantStats.overall.totalProfit
          },
          vsBaseline: {
            winRateDelta: Number(winRateDelta.toFixed(4)),
            roiDelta: Number(roiDelta.toFixed(2)),
            brierDelta: Number(brierDelta.toFixed(4)),
            clvDelta: Number(clvDelta.toFixed(2))
          }
        });
      } catch (error) {
        console.warn(`[AblationRunner] Variant ${variant.name} evaluation failed. Returning empty metrics fallback.`, error);
        variants.push({
          variant: variant.name,
          modelVersion: variant.modelVersion,
          featureVersion: variant.featureVersion,
          metrics: {
            totalPredictions: 0,
            winRate: 0,
            roi: 0,
            avgBrierScore: 0.25,
            avgCLV: null,
            totalProfit: 0
          },
          vsBaseline: {
            winRateDelta: -baselineResult.metrics.winRate,
            roiDelta: -baselineResult.metrics.roi,
            brierDelta: 0.25 - baselineResult.metrics.avgBrierScore,
            clvDelta: -(baselineResult.metrics.avgCLV ?? 0)
          }
        });
      }
    }

    return {
      baseline: baselineResult,
      variants
    };
  }
}
