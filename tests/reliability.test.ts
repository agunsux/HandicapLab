// Centralized Reliability & SLO/SLI Test Suite
// Location: tests/reliability.test.ts

import { describe, it, expect } from 'vitest';
import { ReliabilityEvaluator } from '../src/lib/reliability/evaluator';
import { HealthCheckResult } from '../src/lib/health/types';

describe('Reliability & SLO/SLI Evaluator Tests', () => {
  const timestamp = new Date().toISOString();

  it('should return 100 score and healthy status when all dependencies are healthy and within thresholds', () => {
    const mockServices: Record<string, HealthCheckResult> = {
      database: { status: 'healthy', latency_ms: 50, timestamp },
      prediction: {
        status: 'healthy',
        latency_ms: 100,
        timestamp,
        details: { lastPredictionTimestamp: new Date(Date.now() - 10 * 1000).toISOString() }
      },
      market: {
        status: 'healthy',
        latency_ms: 40,
        timestamp,
        details: { lastModified: new Date(Date.now() - 30 * 1000).toISOString() }
      },
      settlement: {
        status: 'healthy',
        latency_ms: 80,
        timestamp,
        details: { lastRunTime: new Date(Date.now() - 60 * 1000).toISOString() }
      },
      billing: { status: 'healthy', latency_ms: 120, timestamp },
      storage: { status: 'healthy', latency_ms: 60, timestamp }
    };

    const report = ReliabilityEvaluator.evaluate(timestamp, mockServices);

    expect(report.status).toBe('healthy');
    expect(report.score).toBe(100);
    expect(report.slos.database.slo_met).toBe(true);
    expect(report.slos.prediction.slo_met).toBe(true);
    expect(report.slos.market.slo_met).toBe(true);
    expect(report.slos.settlement.slo_met).toBe(true);
    expect(report.slos.billing.slo_met).toBe(true);
    expect(report.slos.storage.slo_met).toBe(true);
  });

  it('should return unhealthy overall status if database is unhealthy', () => {
    const mockServices: Record<string, HealthCheckResult> = {
      database: { status: 'unhealthy', latency_ms: 0, timestamp, message: 'Connection failed' },
      prediction: {
        status: 'healthy',
        latency_ms: 100,
        timestamp,
        details: { lastPredictionTimestamp: new Date().toISOString() }
      },
      market: {
        status: 'healthy',
        latency_ms: 40,
        timestamp,
        details: { lastModified: new Date().toISOString() }
      },
      settlement: {
        status: 'healthy',
        latency_ms: 80,
        timestamp,
        details: { lastRunTime: new Date().toISOString() }
      },
      billing: { status: 'healthy', latency_ms: 120, timestamp },
      storage: { status: 'healthy', latency_ms: 60, timestamp }
    };

    const report = ReliabilityEvaluator.evaluate(timestamp, mockServices);

    expect(report.status).toBe('unhealthy');
    expect(report.slos.database.slo_met).toBe(false);
    expect(report.score).toBeLessThan(100);
  });

  it('should return degraded overall status and false slo_met if database latency exceeds threshold', () => {
    const mockServices: Record<string, HealthCheckResult> = {
      database: { status: 'healthy', latency_ms: 250, timestamp }, // Limit is 200ms
      prediction: {
        status: 'healthy',
        latency_ms: 100,
        timestamp,
        details: { lastPredictionTimestamp: new Date().toISOString() }
      },
      market: {
        status: 'healthy',
        latency_ms: 40,
        timestamp,
        details: { lastModified: new Date().toISOString() }
      },
      settlement: {
        status: 'healthy',
        latency_ms: 80,
        timestamp,
        details: { lastRunTime: new Date().toISOString() }
      },
      billing: { status: 'healthy', latency_ms: 120, timestamp },
      storage: { status: 'healthy', latency_ms: 60, timestamp }
    };

    const report = ReliabilityEvaluator.evaluate(timestamp, mockServices);

    expect(report.status).toBe('degraded');
    expect(report.slos.database.slo_met).toBe(false);
    expect(report.score).toBe(83); // 5 out of 6 met -> 83%
  });

  it('should return degraded overall status if prediction age exceeds freshness threshold', () => {
    const mockServices: Record<string, HealthCheckResult> = {
      database: { status: 'healthy', latency_ms: 50, timestamp },
      prediction: {
        status: 'healthy',
        latency_ms: 100,
        timestamp,
        details: { lastPredictionTimestamp: new Date(Date.now() - 400 * 1000).toISOString() } // limit is 300s
      },
      market: {
        status: 'healthy',
        latency_ms: 40,
        timestamp,
        details: { lastModified: new Date().toISOString() }
      },
      settlement: {
        status: 'healthy',
        latency_ms: 80,
        timestamp,
        details: { lastRunTime: new Date().toISOString() }
      },
      billing: { status: 'healthy', latency_ms: 120, timestamp },
      storage: { status: 'healthy', latency_ms: 60, timestamp }
    };

    const report = ReliabilityEvaluator.evaluate(timestamp, mockServices);

    expect(report.status).toBe('degraded');
    expect(report.slos.prediction.slo_met).toBe(false);
    expect(report.slos.prediction.current_value).toBe(400);
    expect(report.score).toBe(83);
  });

  it('should degrade if settlement delay is violated', () => {
    const mockServices: Record<string, HealthCheckResult> = {
      database: { status: 'healthy', latency_ms: 50, timestamp },
      prediction: {
        status: 'healthy',
        latency_ms: 100,
        timestamp,
        details: { lastPredictionTimestamp: new Date().toISOString() }
      },
      market: {
        status: 'healthy',
        latency_ms: 40,
        timestamp,
        details: { lastModified: new Date().toISOString() }
      },
      settlement: {
        status: 'healthy',
        latency_ms: 80,
        timestamp,
        details: { lastRunTime: new Date(Date.now() - 700 * 1000).toISOString() } // limit is 600s
      },
      billing: { status: 'healthy', latency_ms: 120, timestamp },
      storage: { status: 'healthy', latency_ms: 60, timestamp }
    };

    const report = ReliabilityEvaluator.evaluate(timestamp, mockServices);

    expect(report.status).toBe('degraded');
    expect(report.slos.settlement.slo_met).toBe(false);
    expect(report.slos.settlement.current_value).toBe(700);
  });
});
