/**
 * EPIC 17.5 — Statistical Comparison Engine
 * Rigorous model comparison with bootstrap CI, permutation tests, effect size.
 * Rejects statistically unsupported conclusions.
 */

import type { ReplayOutcome } from '../replay/types';
import type { BaselineId } from '../replay-lab/types';
import type { StatisticalComparisonResult } from './types';

export class StatisticalComparisonEngine {
  comparePaired(
    outcomesA: readonly ReplayOutcome[],
    outcomesB: readonly ReplayOutcome[],
    baselineA: BaselineId,
    baselineB: BaselineId,
    metricName: string,
    metricFn: (o: readonly ReplayOutcome[]) => number,
    options: { confidenceLevel?: number; iterations?: number; seed?: number } = {}
  ): StatisticalComparisonResult {
    const cl = options.confidenceLevel ?? 0.95;
    const iters = options.iterations ?? 1000;
    const seed = options.seed ?? 42;

    const valueA = metricFn(outcomesA);
    const valueB = metricFn(outcomesB);
    const delta = valueB - valueA;

    // Bootstrap CI on differences
    const diffs: number[] = [];
    const maxLen = Math.max(outcomesA.length, outcomesB.length);
    for (let i = 0; i < maxLen; i++) {
      const a = outcomesA[i]?.profitLoss ?? 0;
      const b = outcomesB[i]?.profitLoss ?? 0;
      diffs.push(b - a);
    }

    const rng = new SeededRNG(seed);
    const bootDeltas: number[] = [];
    for (let i = 0; i < iters; i++) {
      let sum = 0;
      for (let j = 0; j < diffs.length; j++) {
        sum += diffs[rng.nextInt(0, diffs.length - 1)];
      }
      bootDeltas.push(sum / diffs.length);
    }
    bootDeltas.sort((a, b) => a - b);
    const alpha = 1 - cl;
    const ciLower = bootDeltas[Math.floor(iters * (alpha / 2))];
    const ciUpper = bootDeltas[Math.floor(iters * (1 - alpha / 2))];

    // Permutation test p-value
    const combined = [...outcomesA.map((o) => o.profitLoss), ...outcomesB.map((o) => o.profitLoss)];
    let extreme = 0;
    for (let p = 0; p < 200; p++) {
      const permRng = new SeededRNG(seed + p + 1);
      const shuffled = [...combined];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = permRng.nextInt(0, i);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const permA = shuffled.slice(0, outcomesA.length).reduce((s, v) => s + v, 0) / outcomesA.length;
      const permB = shuffled.slice(outcomesA.length).reduce((s, v) => s + v, 0) / outcomesB.length;
      const permDelta = permB - permA;
      if (Math.abs(permDelta) >= Math.abs(delta)) extreme++;
    }
    const pValue = (extreme + 1) / 201;

    // Effect size (Cohen's d)
    const pooledVar = diffs.reduce((s, d) => s + Math.pow(d - delta, 2), 0) / (diffs.length - 1);
    const effectSize = pooledVar > 0 ? delta / Math.sqrt(pooledVar) : 0;

    const significant = pValue < (1 - cl);
    const practicallySignificant = Math.abs(effectSize) > 0.2;

    return {
      baselineA,
      baselineB,
      metricName,
      valueA,
      valueB,
      delta,
      bootstrapCiLower: Math.round(ciLower * 10000) / 10000,
      bootstrapCiUpper: Math.round(ciUpper * 10000) / 10000,
      pValue: Math.round(pValue * 10000) / 10000,
      effectSize: Math.round(effectSize * 10000) / 10000,
      significant,
      practicallySignificant,
      confidenceLevel: cl,
    };
  }
}

class SeededRNG {
  private state: number;
  constructor(seed: number) { this.state = seed; }
  next(): number {
    this.state = (this.state * 1664525 + 1013904223) & 0x7fffffff;
    return this.state / 0x7fffffff;
  }
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

export const defaultStatsComparison = new StatisticalComparisonEngine();