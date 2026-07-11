/**
 * EPIC 17.6 — Ranking Engine
 */

import type { BaselineId } from '../replay-lab';
import type { ReplayMetrics } from '../replay/types';
import type { RankingCriteria, RankingEntry, RankingReport } from './types';
import { generateRankingId } from './id';

export class RankingEngine {
  rank(
    entries: { baselineId: BaselineId; metrics: ReplayMetrics; extra?: Record<string, number> }[],
    criteria: RankingCriteria
  ): RankingReport {
    const scores: { baselineId: BaselineId; breakdown: Record<string, number>; compositeScore: number }[] = [];

    const maxRoi = Math.max(...entries.map((e) => e.metrics.roi), 0.01);
    const maxClv = Math.max(...entries.map((e) => e.metrics.avgClv), 0.01);
    const minBrier = Math.min(...entries.map((e) => e.metrics.brierScore), 1);
    const maxSamples = Math.max(...entries.map((e) => e.metrics.totalPredictions), 1);
    const maxDrawdown = Math.max(...entries.map((e) => e.metrics.lost), 1);

    for (const e of entries) {
      const breakdown: Record<string, number> = {
        roi_score: e.metrics.roi / maxRoi * 100,
        clv_score: Math.max(0, e.metrics.avgClv / maxClv * 100),
        calibration_score: Math.max(0, 100 - (e.metrics.brierScore / minBrier * 100)),
        stability_score: 50,
        drawdown_score: Math.max(0, 100 - (e.metrics.lost / maxDrawdown * 50)),
        sample_size_score: (e.metrics.totalPredictions / maxSamples) * 100,
      };

      const compositeScore = (
        criteria.roi * breakdown.roi_score +
        criteria.clv * breakdown.clv_score +
        criteria.calibration * breakdown.calibration_score +
        criteria.stability * breakdown.stability_score +
        criteria.drawdown * breakdown.drawdown_score +
        criteria.sampleSize * breakdown.sample_size_score
      ) / Math.max(
        criteria.roi + criteria.clv + criteria.calibration +
        criteria.stability + criteria.drawdown + criteria.sampleSize, 1
      );

      scores.push({ baselineId: e.baselineId, breakdown, compositeScore });
    }

    scores.sort((a, b) => b.compositeScore - a.compositeScore);

    const entries2: RankingEntry[] = scores.map((s, i) => ({
      baselineId: s.baselineId,
      compositeScore: Math.round(s.compositeScore * 100) / 100,
      breakdown: Object.fromEntries(
        Object.entries(s.breakdown).map(([k, v]) => [k, Math.round(v * 100) / 100])
      ),
      rank: i + 1,
    }));

    return {
      rankingId: generateRankingId(),
      criteria,
      entries: entries2,
      generatedAt: new Date().toISOString(),
    };
  }
}

export const defaultRankingEngine = new RankingEngine();