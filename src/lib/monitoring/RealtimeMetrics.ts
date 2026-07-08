import { RealtimeMetricsSnapshot } from './types';
import { DecisionObject } from '../decision/DecisionObject';

/**
 * Layer 1: Real-time Metrics
 *
 * Lightweight incremental counters updated on every inference.
 * Designed to be cheap — no DB writes per inference.
 * The hourly snapshot job will read from this and persist.
 *
 * In production, replace the in-memory store with Redis counters
 * or Prometheus metrics. The interface stays the same.
 */

interface Accumulators {
  requestCount: number;
  totalLatencyMs: number;
  decisions: Record<string, number>;
  totalConfidence: number;
  totalEpistemic: number;
  totalAleatoric: number;
  gatePassCount: number;
  windowStartedAt: Date;
}

const acc: Accumulators = {
  requestCount: 0,
  totalLatencyMs: 0,
  decisions: { BET: 0, NO_BET: 0, INCONCLUSIVE: 0, WAIT: 0 },
  totalConfidence: 0,
  totalEpistemic: 0,
  totalAleatoric: 0,
  gatePassCount: 0,
  windowStartedAt: new Date(),
};

export class RealtimeMetrics {
  /**
   * Call this at the end of every inference to record outcomes.
   */
  static record(decision: DecisionObject, latencyMs: number): void {
    acc.requestCount++;
    acc.totalLatencyMs += latencyMs;
    acc.decisions[decision.decision] = (acc.decisions[decision.decision] ?? 0) + 1;
    acc.totalConfidence += decision.confidence ?? 0;
    acc.totalEpistemic += decision.uncertainty_vector?.epistemic ?? 0;
    acc.totalAleatoric += decision.uncertainty_vector?.aleatoric ?? 0;
    if (decision.decision === 'BET') acc.gatePassCount++;
  }

  /**
   * Returns a point-in-time snapshot of current accumulators.
   * Does NOT reset counters.
   */
  static snapshot(): RealtimeMetricsSnapshot {
    const n = acc.requestCount || 1;
    const nonBet = (acc.decisions['NO_BET'] ?? 0) + (acc.decisions['INCONCLUSIVE'] ?? 0) + (acc.decisions['WAIT'] ?? 0);

    return {
      requestCount: acc.requestCount,
      avgLatencyMs: acc.totalLatencyMs / n,
      decisionDistribution: {
        BET: acc.decisions['BET'] ?? 0,
        NO_BET: acc.decisions['NO_BET'] ?? 0,
        INCONCLUSIVE: acc.decisions['INCONCLUSIVE'] ?? 0,
        WAIT: acc.decisions['WAIT'] ?? 0,
      },
      avgConfidence: acc.totalConfidence / n,
      avgUncertaintyEpistemic: acc.totalEpistemic / n,
      avgUncertaintyAleatoric: acc.totalAleatoric / n,
      decisionGatePassRate: acc.gatePassCount / n,
      skipRate: nonBet / n,
      windowStartedAt: acc.windowStartedAt,
    };
  }

  /**
   * Reset accumulators. Called after each hourly snapshot is written.
   */
  static reset(): void {
    acc.requestCount = 0;
    acc.totalLatencyMs = 0;
    acc.decisions = { BET: 0, NO_BET: 0, INCONCLUSIVE: 0, WAIT: 0 };
    acc.totalConfidence = 0;
    acc.totalEpistemic = 0;
    acc.totalAleatoric = 0;
    acc.gatePassCount = 0;
    acc.windowStartedAt = new Date();
  }
}
