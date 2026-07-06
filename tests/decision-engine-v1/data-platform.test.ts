// HandicapLab Live Data Platform - Verification Tests
// Location: tests/decision-engine-v1/data-platform.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { OddsNormalizer } from '../../src/lib/data-platform/oddsNormalizer';
import { RateLimiter } from '../../src/lib/data-platform/rateLimiter';
import { RetryEngine, CircuitBreaker } from '../../src/lib/data-platform/retryEngine';
import { DataQualityEngine } from '../../src/lib/data-platform/dataQualityEngine';
import { ReplayEngine } from '../../src/lib/data-platform/replayEngine';
import { EventBus, StandardEvent } from '../../src/lib/data-platform/eventBus';
import { StorageZones } from '../../src/lib/data-platform/storageZones';
import { ProviderRegistry } from '../../src/lib/data-platform/providerRegistry';
import { CanonicalOdds } from '../../src/lib/data-platform/canonicalModel';

describe('Sprint 26: Live Data Platform & Feature Store Foundation Tests', () => {

  beforeEach(() => {
    RateLimiter.reset();
    RetryEngine.clearDLQ();
    EventBus.clear();
    StorageZones.clear();
  });

  describe('Odds Normalizer Calculations', () => {
    it('should normalize Decimal format directly', () => {
      expect(OddsNormalizer.toDecimal(1.95, 'Decimal')).toBe(1.95);
    });

    it('should normalize Hong Kong format', () => {
      expect(OddsNormalizer.toDecimal(0.95, 'HongKong')).toBe(1.95);
    });

    it('should normalize Malay format', () => {
      expect(OddsNormalizer.toDecimal(0.95, 'Malay')).toBe(1.95);
      expect(OddsNormalizer.toDecimal(-0.50, 'Malay')).toBe(3.00);
    });

    it('should normalize Indonesian format', () => {
      expect(OddsNormalizer.toDecimal(1.50, 'Indonesian')).toBe(2.50);
      expect(OddsNormalizer.toDecimal(-1.25, 'Indonesian')).toBe(1.80);
    });

    it('should normalize American format', () => {
      expect(OddsNormalizer.toDecimal(150, 'American')).toBe(2.50);
      expect(OddsNormalizer.toDecimal(-200, 'American')).toBe(1.50);
    });

    it('should normalize Fractional format string', () => {
      expect(OddsNormalizer.toDecimal('5/2', 'Fractional')).toBe(3.50);
    });
  });

  describe('Rate Limiter & Retry Engine (Circuit Breaker)', () => {
    it('should enforce quota limits on rate limiter', () => {
      const config = { requestsPerSec: 2, requestsPerMin: 5 };
      expect(RateLimiter.isAllowed(config)).toBe(true);
      expect(RateLimiter.isAllowed(config)).toBe(true);
      expect(RateLimiter.isAllowed(config)).toBe(false); // blocked by per sec limit
    });

    it('should toggle Circuit Breaker states based on failures and recovery', () => {
      const breaker = new CircuitBreaker(2, 50); // 2 failures threshold, 50ms cooldown
      let runCount = 0;

      // 1. Success execution
      breaker.execute(() => { runCount++; });
      expect(breaker.state).toBe('CLOSED');

      // 2. Failure executions to open circuit
      expect(() => {
        breaker.execute(() => { throw new Error('Network Drop'); });
      }).toThrow('Network Drop');
      expect(breaker.state).toBe('CLOSED');

      expect(() => {
        breaker.execute(() => { throw new Error('Network Drop'); });
      }).toThrow('Network Drop');
      expect(breaker.state).toBe('OPEN');

      // 3. Blocked requests during open state
      expect(() => {
        breaker.execute(() => { runCount++; });
      }).toThrow('Circuit Breaker is OPEN');

      // 4. Cooldown recovery
      breaker.state = 'HALF_OPEN';
      breaker.execute(() => { runCount++; });
      expect(breaker.state).toBe('CLOSED'); // recovered to closed
    });

    it('should execute backoffs and populate DLQ on final failure exhaust', async () => {
      let callCount = 0;
      const fn = async () => {
        callCount++;
        throw new Error('API Timeout');
      };

      await expect(
        RetryEngine.executeWithRetry(fn, { maxRetries: 2, initialDelayMs: 5, factor: 1.5 })
      ).rejects.toThrow('API Timeout');

      expect(callCount).toBe(3); // Initial + 2 retries
      expect(RetryEngine.getDLQ().length).toBe(1);
    });
  });

  describe('Data Quality Scoring', () => {
    it('should score high quality data correctly', () => {
      const now = new Date().toISOString();
      const records: CanonicalOdds[] = [
        {
          fixtureId: '1', provider: 'Mock', marketType: 'ML', selection: 'home',
          oddsDecimal: 2.10, impliedProbability: 0.47,
          receivedAt: now, providerTimestamp: now, processedTimestamp: now,
          latencyMs: 5, normalizerVersion: '1.0.0'
        }
      ];

      const report = DataQualityEngine.evaluate(records);
      expect(report.score).toBeGreaterThanOrEqual(90);
      expect(report.issues.length).toBe(0);
    });

    it('should flag anomalies and reduce quality score', () => {
      const now = new Date().toISOString();
      const records: CanonicalOdds[] = [
        {
          fixtureId: '1', provider: 'Mock', marketType: 'ML', selection: 'home',
          oddsDecimal: -1.5, // invalid
          impliedProbability: 0,
          receivedAt: now, providerTimestamp: now, processedTimestamp: now,
          latencyMs: 600, // high latency
          normalizerVersion: '1.0.0'
        }
      ];

      const report = DataQualityEngine.evaluate(records);
      expect(report.score).toBeLessThan(80);
      expect(report.issues.some((i) => i.includes('latency') || i.includes('odds'))).toBe(true);
    });
  });

  describe('Event Bus & Deterministic Replay Engine', () => {
    it('should register versioned event and detect out of order replay anomaly', () => {
      const e1 = EventBus.publish('FixtureCreated', 'match-1', { home: 'Arsenal' });
      
      // Publish event with out-of-order date
      const e2: StandardEvent = {
        eventId: 'evt-out-of-order',
        eventVersion: '1.0.0',
        eventType: 'OddsOpened',
        aggregateId: 'match-1',
        aggregateVersion: '1.0.0',
        occurredAt: new Date(Date.now() - 50000).toISOString(), // older date
        receivedAt: new Date().toISOString(),
        payload: { odds: 1.95 },
        checksum: '1c9a6df7a'
      };

      const events = [e1, e2];
      const report = ReplayEngine.replay(events);

      expect(report.outOfOrderCount).toBe(1);
      expect(report.anomalies.some((a) => a.includes('Out of order'))).toBe(true);
    });
  });

  describe('Hexagonal Storage Zones', () => {
    it('should write raw normalized and curated files', () => {
      StorageZones.writeRaw('test_raw.json', { raw: 'data' });
      StorageZones.writeNormalized('test_norm.json', { norm: 'data' });
      StorageZones.writeCurated('test_cur.json', { cur: 'data' });

      expect(StorageZones.readZoneFile('raw', 'test_raw.json')).toBeDefined();
      expect(StorageZones.readZoneFile('normalized', 'test_norm.json')).toBeDefined();
      expect(StorageZones.readZoneFile('curated', 'test_cur.json')).toBeDefined();
    });
  });
});
