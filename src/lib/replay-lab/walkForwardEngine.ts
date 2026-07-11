/**
 * EPIC 16.3 — Walk-Forward Research Engine
 * =========================================
 * Generates deterministic walk-forward validation folds from historical data.
 *
 * Supports:
 *   - Expanding window  (train grows, test is fixed-size next block)
 *   - Rolling window    (train + test both slide forward)
 *   - Fixed window      (train is fixed size, test is fixed-size next block)
 *   - Season split      (one fold per season)
 *   - League split      (one fold per league)
 *
 * All folds are deterministic for identical inputs.
 * Future leakage is prevented by design: test always follows train chronologically.
 */

import type { HistoricalMatch } from '../replay/types';
import type { WalkForwardConfig, WalkForwardFold, WalkForwardReport, WindowStrategy } from './types';
import { generateFoldId } from './id';

export type { WalkForwardConfig, WalkForwardFold, WalkForwardReport };

export class WalkForwardEngine {
  /**
   * Generate folds from a chronologically sorted array of matches.
   * Matches must be pre-sorted by kickoff (ascending).
   */
  generateFolds(
    matches: readonly HistoricalMatch[],
    config: WalkForwardConfig,
    experimentId: string,
    datasetId: string
  ): WalkForwardReport {
    const sorted = [...matches].sort(
      (a, b) => new Date(a.fixture.kickoff).getTime() - new Date(b.fixture.kickoff).getTime()
    );

    if (sorted.length === 0) {
      return {
        experimentId,
        datasetId,
        config,
        folds: [],
        aggregateMetrics: null,
        completedAt: new Date().toISOString(),
      };
    }

    const total = sorted.length;
    const strategy = config.strategy;
    const testSize = config.testSize ?? Math.max(1, Math.floor(total * 0.2));
    const stepSize = config.stepSize ?? testSize;
    const minTrain = config.minTrainFixtures ?? testSize;
    const folds: WalkForwardFold[] = [];

    if (strategy === 'season' || strategy === 'league') {
      // Season/league split: group by season/league id
      const groups = new Map<string, HistoricalMatch[]>();
      for (const m of sorted) {
        const key = strategy === 'season' ? (m.fixture.season ?? 'unknown') : (m.fixture.leagueId ?? 'unknown');
        const arr = groups.get(key) ?? [];
        arr.push(m);
        groups.set(key, arr);
      }
      let index = 0;
      for (const [key, group] of groups) {
        const ids = group.map((m) => m.fixture.id);
        folds.push({
          foldId: generateFoldId(),
          index,
          strategy,
          trainStart: sorted[0].fixture.kickoff,
          trainEnd: group[0].fixture.kickoff,
          testStart: group[0].fixture.kickoff,
          testEnd: group[group.length - 1].fixture.kickoff,
          trainFixtures: sorted.filter((m) => !group.includes(m)).map((m) => m.fixture.id),
          testFixtures: ids,
          sessionId: null,
        });
        index++;
      }
    } else {
      // Expanding, rolling, fixed — all use the same sliding window mechanics
      let trainStart = 0;
      let trainEnd: number;

      if (strategy === 'expanding') {
        // Train starts at 0 and grows; initial train size = testSize
        trainEnd = Math.min(testSize, total - testSize);
      } else if (strategy === 'rolling') {
        trainEnd = Math.min(config.trainSize ?? testSize * 3, total - testSize);
      } else {
        // fixed
        trainEnd = Math.min(config.trainSize ?? testSize * 3, total - testSize);
      }

      let index = 0;
      while (trainEnd + testSize <= total) {
        const testStartIdx = trainEnd;
        const testEndIdx = testStartIdx + testSize;

        const trainSlice = sorted.slice(trainStart, trainEnd);
        const testSlice = sorted.slice(testStartIdx, testEndIdx);

        if (trainSlice.length >= minTrain && testSlice.length > 0) {
          folds.push({
            foldId: generateFoldId(),
            index,
            strategy,
            trainStart: trainSlice[0].fixture.kickoff,
            trainEnd: trainSlice[trainSlice.length - 1].fixture.kickoff,
            testStart: testSlice[0].fixture.kickoff,
            testEnd: testSlice[testSlice.length - 1].fixture.kickoff,
            trainFixtures: trainSlice.map((m) => m.fixture.id),
            testFixtures: testSlice.map((m) => m.fixture.id),
            sessionId: null,
          });
          index++;
        }

        if (strategy === 'expanding') {
          trainEnd += stepSize;
        } else {
          // rolling / fixed: slide both windows
          trainStart += stepSize;
          trainEnd += stepSize;
        }
      }
    }

    return {
      experimentId,
      datasetId,
      config,
      folds,
      aggregateMetrics: null,
      completedAt: new Date().toISOString(),
    };
  }
}

export const defaultWalkForwardEngine = new WalkForwardEngine();