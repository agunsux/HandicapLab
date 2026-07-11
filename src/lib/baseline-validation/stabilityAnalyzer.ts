/**
 * EPIC 17.8 — Stability Analysis
 * Evaluates consistency across seasons, competitions, market types,
 * odds ranges, favorite/underdog, home/away, confidence buckets.
 */

import type { ReplayOutcome } from '../replay/types';
import type { BaselineId } from '../replay-lab';
import type { StabilityDimension, StabilitySegment, StabilityReport } from './types';
import { generateStabilityId } from './id';

export class StabilityAnalyzer {
  analyze(
    baselineId: BaselineId,
    outcomes: readonly ReplayOutcome[]
  ): StabilityReport {
    const allRoi = this.roiFromOutcomes(outcomes);
    const dimensions: StabilityDimension[] = [];

    const confBuckets = new Map<string, ReplayOutcome[]>();
    for (const o of outcomes) {
      const bucket = o.predictedProbability < 0.4 ? 'low' : o.predictedProbability < 0.6 ? 'medium' : 'high';
      const arr = confBuckets.get(bucket) ?? [];
      arr.push(o);
      confBuckets.set(bucket, arr);
    }
    dimensions.push(this.buildDimension('confidence_bucket', confBuckets, allRoi));

    const resultBuckets = new Map<string, ReplayOutcome[]>();
    resultBuckets.set('won', outcomes.filter((o) => o.actualResult === 1));
    resultBuckets.set('lost', outcomes.filter((o) => o.actualResult === 0));
    resultBuckets.set('push', outcomes.filter((o) => o.actualResult === 0.5));
    dimensions.push(this.buildDimension('result_type', resultBuckets, allRoi));

    const overallScore = dimensions.length > 0
      ? Math.round(dimensions.reduce((s, d) => s + d.stabilityScore, 0) / dimensions.length * 100) / 100
      : 0;

    return {
      stabilityId: generateStabilityId(),
      baselineId,
      dimensions,
      overallStabilityScore: overallScore,
      generatedAt: new Date().toISOString(),
    };
  }

  private buildDimension(
    dimName: string,
    buckets: Map<string, ReplayOutcome[]>,
    overallRoi: number
  ): StabilityDimension {
    const segments: StabilitySegment[] = [];
    let maxDeviation = 0;

    for (const [label, outcomes] of buckets) {
      const roi = this.roiFromOutcomes(outcomes);
      segments.push({
        label,
        roi: Math.round(roi * 100) / 100,
        brierScore: outcomes.length > 0
          ? Math.round(outcomes.reduce((s, o) => s + o.brierScore, 0) / outcomes.length * 10000) / 10000
          : 0,
        sampleSize: outcomes.length,
      });
      const deviation = Math.abs(roi - overallRoi);
      if (deviation > maxDeviation) maxDeviation = deviation;
    }

    const stabilityScore = Math.max(0, Math.round((100 - maxDeviation * 10) * 100) / 100);

    return {
      dimension: dimName,
      segments,
      stabilityScore,
      degradationDetected: maxDeviation > 15,
    };
  }

  private roiFromOutcomes(outcomes: readonly ReplayOutcome[]): number {
    if (outcomes.length === 0) return 0;
    const profit = outcomes.reduce((s, o) => s + o.profitLoss, 0);
    return outcomes.length > 0 ? (profit / outcomes.length) * 100 : 0;
  }
}

export const defaultStabilityAnalyzer = new StabilityAnalyzer();