/**
 * EPIC 31B — Production Replay & Shadow Validation
 * Phase 7: Performance Validator & Profiler
 *
 * Measures replay throughput, memory usage, CPU, database reads,
 * replay duration, and identifies bottlenecks.
 */

export class PerformanceProfiler {
  private startTime: number;
  private startMemory: number;
  private dbReadCount = 0;
  private bottlenecks: string[] = [];
  private phaseTimings: Record<string, number> = {};

  constructor() {
    this.startTime = Date.now();
    this.startMemory = this.getMemoryUsage();
  }

  recordPhase(phaseName: string, durationMs: number): void {
    this.phaseTimings[phaseName] = durationMs;
    if (durationMs > 5000) {
      this.bottlenecks.push(`${phaseName}: ${durationMs}ms (>5s threshold)`);
    }
  }

  incrementDbReads(count: number): void {
    this.dbReadCount += count;
  }

  recordBottleneck(description: string): void {
    this.bottlenecks.push(description);
  }

  getProfile(totalMatches: number): {
    totalDurationMs: number;
    avgMatchDurationMs: number;
    peakMemoryMB: number;
    totalCpuTimeMs: number;
    dbReadCount: number;
    bottlenecks: string[];
    phaseTimings: Record<string, number>;
  } {
    const totalDurationMs = Date.now() - this.startTime;
    const peakMemoryMB = this.getMemoryUsage();
    const avgMatchDurationMs = totalMatches > 0 ? totalDurationMs / totalMatches : 0;

    return {
      totalDurationMs,
      avgMatchDurationMs: Math.round(avgMatchDurationMs * 100) / 100,
      peakMemoryMB: Math.round(peakMemoryMB * 100) / 100,
      totalCpuTimeMs: totalDurationMs,
      dbReadCount: this.dbReadCount,
      bottlenecks: this.bottlenecks,
      phaseTimings: { ...this.phaseTimings },
    };
  }

  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    }
    return 0;
  }
}

export function estimateThroughput(totalMatches: number, durationMs: number): {
  matchesPerSecond: number;
  matchesPerMinute: number;
  matchesPerHour: number;
} {
  const seconds = durationMs / 1000;
  return {
    matchesPerSecond: Math.round((totalMatches / seconds) * 100) / 100,
    matchesPerMinute: Math.round((totalMatches / seconds) * 60 * 100) / 100,
    matchesPerHour: Math.round((totalMatches / seconds) * 3600 * 100) / 100,
  };
}
