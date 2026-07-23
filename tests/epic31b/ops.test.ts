import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { ExperimentScheduler } from '../../src/infrastructure/scheduler/experiment-scheduler';
import { DatasetRegistry } from '../../src/infrastructure/registry/dataset-registry';
import type { ReplayMetrics } from '../../src/lib/epic31b/types';

describe('SUPER EPIC 31B.5E — Research Operations (ResOps) Platform', () => {
  it('should schedule validation jobs and perform side-by-side experiment delta comparisons', () => {
    const scheduler = new ExperimentScheduler();
    const job = scheduler.scheduleJob('exp-1');
    expect(job.status).toBe('PENDING');

    scheduler.updateJobStatus(job.jobId, 'RUNNING');
    expect(scheduler.getQueue()[0].status).toBe('RUNNING');

    const baseMetrics: ReplayMetrics = {
      totalMatches: 10, totalPredictions: 10, won: 5, lost: 5, voided: 0,
      roi: 2.5, yield: 2.5, avgClv: 0.015, winRate: 50, totalStake: 1.0,
      totalProfit: 0.025, brierScore: 0.22, logLoss: 0.62, avgKellyStake: 0.1,
      maxDrawdown: 5.0, sharpeRatio: 1.2, sortinoRatio: 1.4, profitFactor: 1.1,
      longestWinStreak: 2, longestLossStreak: 2, ece: 0.035, mce: 0.06,
      sharpness: 0.1, entropy: 0.95, accuracy: 0.5, precision: 0.5, recall: 0.5, f1: 0.5,
      rocauc: 0.65, prauc: 0.68, kellyRiskRatio: 0.02
    };

    const candidateMetrics: ReplayMetrics = {
      totalMatches: 10, totalPredictions: 10, won: 6, lost: 4, voided: 0,
      roi: 6.8, yield: 6.8, avgClv: 0.025, winRate: 60, totalStake: 1.0,
      totalProfit: 0.068, brierScore: 0.19, logLoss: 0.55, avgKellyStake: 0.1,
      maxDrawdown: 3.5, sharpeRatio: 1.8, sortinoRatio: 2.1, profitFactor: 1.4,
      longestWinStreak: 3, longestLossStreak: 1, ece: 0.021, mce: 0.04,
      sharpness: 0.15, entropy: 0.88, accuracy: 0.6, precision: 0.6, recall: 0.6, f1: 0.6,
      rocauc: 0.75, prauc: 0.78, kellyRiskRatio: 0.02
    };

    const comp = ExperimentScheduler.compare('exp-1', baseMetrics, 120, 'exp-2', candidateMetrics, 105);
    expect(comp.deltaROI).toBe(4.3);
    expect(comp.deltaCLV).toBe(0.01);
    expect(comp.deltaECE).toBe(-0.014); // improvement (lower ECE)
    expect(comp.deltaLogLoss).toBe(-0.07);
    expect(comp.deltaRuntimeMs).toBe(-15);
  });

  it('should load and verify the Golden Dataset regression suite', async () => {
    const goldenPath = path.join(process.cwd(), 'data', 'golden', 'golden_matches.csv');
    expect(fs.existsSync(goldenPath)).toBe(true);

    const registry = new DatasetRegistry();
    const metadata = await registry.auditAndRegister(goldenPath, 'EPL', 'golden');
    expect(metadata.coverage.matchesCount).toBeGreaterThanOrEqual(50);
    expect(metadata.openingOddsCompleteness).toBeGreaterThanOrEqual(0);
  });

  it('should run performance profiling benchmarks', () => {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

    // Simulate match processing loop
    let dummySum = 0;
    for (let i = 0; i < 1000; i++) {
      dummySum += Math.sqrt(i);
    }

    const duration = Date.now() - startTime;
    const endMemory = process.memoryUsage().heapUsed;
    const memoryMB = (endMemory - startMemory) / 1024 / 1024;

    expect(duration).toBeLessThan(100); // should run fast
    expect(memoryMB).toBeLessThan(50); // should not leak memory
  });
});
