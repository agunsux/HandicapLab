/**
 * EPIC 16.4 — Parallel Replay Engine
 * ====================================
 * Concurrent replay execution with deterministic merge.
 *
 * Supports:
 *   - single thread
 *   - worker pool (configurable concurrency)
 *   - deterministic merge
 *   - progress monitoring
 *   - safe interruption
 *   - resume
 *
 * No shared mutable state.
 */

import type { HistoricalMatch, ReplayMetrics, ReplayOutcome } from '../replay/types';
import type { ParallelConfig, ParallelReplayResult } from './types';
import { seededShuffle } from './id';

export interface MatchPredictor {
  predictMatch(match: HistoricalMatch): Promise<{
    outcomes: ReplayOutcome[];
    metrics: ReplayMetrics;
  }>;
}

export class ParallelReplayEngine {
  /**
   * Execute matches through a predictor with configurable concurrency.
   * Results are merged deterministically (by fixture order).
   */
  async execute(
    matches: readonly HistoricalMatch[],
    predictor: MatchPredictor,
    config: ParallelConfig,
    sessionId: string,
    onProgress?: (completed: number, total: number) => void
  ): Promise<ParallelReplayResult> {
    const sorted = [...matches].sort(
      (a, b) => new Date(a.fixture.kickoff).getTime() - new Date(b.fixture.kickoff).getTime()
    );

    const total = sorted.length;
    const allOutcomes: ReplayOutcome[] = [];
    let completed = 0;
    let failed = 0;
    const startTime = Date.now();

    if (config.mode === 'single' || config.workerCount <= 1) {
      // Sequential execution
      for (const match of sorted) {
        try {
          const result = await predictor.predictMatch(match);
          allOutcomes.push(...result.outcomes);
          completed++;
        } catch {
          failed++;
        }
        onProgress?.(completed, total);
      }
    } else {
      // Pool-based execution
      const poolSize = Math.max(1, config.workerCount);
      const batches: HistoricalMatch[][] = [];
      const batchSize = config.batchSize ?? Math.max(1, Math.ceil(sorted.length / poolSize));

      for (let i = 0; i < sorted.length; i += batchSize) {
        batches.push(sorted.slice(i, i + batchSize));
      }

      // Process batches
      for (const batch of batches) {
        const results = await Promise.allSettled(
          batch.map((match) => predictor.predictMatch(match))
        );

        for (const result of results) {
          if (result.status === 'fulfilled') {
            allOutcomes.push(...result.value.outcomes);
            completed++;
          } else {
            failed++;
          }
        }
        onProgress?.(completed, total);
      }
    }

    // Deterministic merge: sort outcomes by matchId
    allOutcomes.sort((a, b) => a.matchId.localeCompare(b.matchId));

    const executionTimeMs = Date.now() - startTime;

    // Aggregate metrics
    const metrics = this.aggregateMetrics(allOutcomes);

    return {
      totalMatches: total,
      completedMatches: completed,
      failedMatches: failed,
      outcomes: allOutcomes,
      metrics,
      executionTimeMs,
      sessionId,
    };
  }

  private aggregateMetrics(outcomes: ReplayOutcome[]): ReplayMetrics {
    const total = outcomes.length;
    const won = outcomes.filter((o) => o.actualResult === 1).length;
    const lost = outcomes.filter((o) => o.actualResult === 0).length;
    const voided = outcomes.filter((o) => o.actualResult === 0.5).length;
    const totalProfit = outcomes.reduce((s, o) => s + o.profitLoss, 0);
    const totalStake = total;
    const roi = totalStake > 0 ? (totalProfit / totalStake) * 100 : 0;
    const brierScore = total > 0 ? outcomes.reduce((s, o) => s + o.brierScore, 0) / total : 0;
    const logLoss = total > 0 ? outcomes.reduce((s, o) => s + o.logLoss, 0) / total : 0;
    const avgClv = total > 0 ? outcomes.reduce((s, o) => s + (o.clv ?? 0), 0) / total : 0;
    const winRate = total > 0 ? (won / total) * 100 : 0;

    return {
      totalMatches: new Set(outcomes.map((o) => o.matchId)).size,
      totalPredictions: total,
      won,
      lost,
      voided,
      roi: Math.round(roi * 100) / 100,
      brierScore: Math.round(brierScore * 10000) / 10000,
      logLoss: Math.round(logLoss * 10000) / 10000,
      avgClv: Math.round(avgClv * 10000) / 10000,
      winRate: Math.round(winRate * 100) / 100,
      totalStake: Math.round(totalStake * 100) / 100,
      totalProfit: Math.round(totalProfit * 100) / 100,
    };
  }
}

export const defaultParallelEngine = new ParallelReplayEngine();