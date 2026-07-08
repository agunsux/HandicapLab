import { SimulationMetrics, Experiment, ExperimentCard, MetricDelta } from './types';
import { PromotionScorer } from './PromotionScorer';

export class ExperimentCardBuilder {
  /**
   * Translates raw JSON metrics into a human-readable ExperimentCard.
   */
  static build(experiment: Experiment): ExperimentCard {
    const base = experiment.baselineMetrics;
    const cand = experiment.candidateMetrics;

    const deltas: MetricDelta[] = [];

    let promotionScore = 0;
    let promotionReady = false;

    if (base && cand) {
      deltas.push(this.calculateDelta('Yield', base.yield, cand.yield, true));
      deltas.push(this.calculateDelta('Coverage', base.coverage, cand.coverage, true));
      deltas.push(this.calculateDelta('Decision Quality', base.decisionQuality, cand.decisionQuality, true));
      deltas.push(this.calculateDelta('Correct Skips', base.correctSkips, cand.correctSkips, true, false)); // raw number
      deltas.push(this.calculateDelta('Missed Opportunities', base.missedOpportunities, cand.missedOpportunities, false, false));
      
      // Calculate Promotion Score
      const scoreResult = PromotionScorer.score(base, cand, experiment.evidenceLevel);
      promotionScore = scoreResult.compositeScore;
      promotionReady = promotionScore >= 90;
    }

    return {
      experimentId: experiment.id,
      name: experiment.name,
      evidenceLevel: experiment.evidenceLevel,
      executionMode: experiment.executionMode,
      deltas,
      promotionScore,
      promotionReady
    };
  }

  private static calculateDelta(
    metric: string, 
    base: number, 
    cand: number, 
    higherIsBetter: boolean,
    isPercentage: boolean = true
  ): MetricDelta {
    const diff = cand - base;
    const isPositive = higherIsBetter ? diff > 0 : diff < 0;
    
    // Formatting: e.g. "+1.9%" or "-8%" or "+18"
    const sign = diff > 0 ? '+' : '';
    const mult = isPercentage ? 100 : 1;
    const suffix = isPercentage ? '%' : '';
    const numStr = isPercentage ? (diff * mult).toFixed(1) : Math.round(diff * mult).toString();
    const formattedDiff = `${sign}${numStr}${suffix}`;

    return {
      metric,
      baseline: base,
      candidate: cand,
      diff,
      isPositive,
      formattedDiff
    };
  }
}
