// Centralized Health System Unit and Integration Tests
// Location: tests/health.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { DependencyRegistry } from '../src/lib/health/registry';
import { HealthCheck } from '../src/lib/health/types';

describe('DependencyRegistry and Health System Tests', () => {
  beforeEach(() => {
    DependencyRegistry.getInstance().clear();
  });

  it('should run healthy checks and return healthy overall status', async () => {
    const registry = DependencyRegistry.getInstance();

    const mockCheck1: HealthCheck = {
      name: 'service1',
      run: async () => ({ status: 'healthy' })
    };

    const mockCheck2: HealthCheck = {
      name: 'service2',
      run: async () => ({ status: 'healthy', details: { ok: true } })
    };

    registry.register(mockCheck1);
    registry.register(mockCheck2);

    const result = await registry.runAll();
    expect(result.status).toBe('healthy');
    expect(result.services.service1.status).toBe('healthy');
    expect(result.services.service2.status).toBe('healthy');
    expect(result.services.service2.details).toEqual({ ok: true });
    expect(result.services.service1.latency_ms).toBeGreaterThanOrEqual(0);
  });

  it('should return unhealthy overall status if any dependency is unhealthy', async () => {
    const registry = DependencyRegistry.getInstance();

    const mockCheck1: HealthCheck = {
      name: 'db',
      run: async () => ({ status: 'unhealthy', message: 'Connection failed' })
    };

    const mockCheck2: HealthCheck = {
      name: 'api',
      run: async () => ({ status: 'healthy' })
    };

    registry.register(mockCheck1);
    registry.register(mockCheck2);

    const result = await registry.runAll();
    expect(result.status).toBe('unhealthy');
    expect(result.services.db.status).toBe('unhealthy');
    expect(result.services.db.message).toBe('Connection failed');
    expect(result.services.api.status).toBe('healthy');
  });

  it('should return degraded overall status if a dependency is degraded and none are unhealthy', async () => {
    const registry = DependencyRegistry.getInstance();

    const mockCheck1: HealthCheck = {
      name: 'billing',
      run: async () => ({ status: 'degraded', message: 'Stripe keys missing' })
    };

    const mockCheck2: HealthCheck = {
      name: 'db',
      run: async () => ({ status: 'healthy' })
    };

    registry.register(mockCheck1);
    registry.register(mockCheck2);

    const result = await registry.runAll();
    expect(result.status).toBe('degraded');
    expect(result.services.billing.status).toBe('degraded');
    expect(result.services.db.status).toBe('healthy');
  });

  it('should handle timeout scenario gracefully', async () => {
    const registry = DependencyRegistry.getInstance();

    const slowCheck: HealthCheck = {
      name: 'slowService',
      run: async () => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return { status: 'healthy' };
      }
    };

    registry.register(slowCheck);

    // Run with 100ms timeout
    const result = await registry.runAll(100);
    expect(result.status).toBe('unhealthy');
    expect(result.services.slowService.status).toBe('unhealthy');
    expect(result.services.slowService.message).toContain('Timeout');
  });

  it('should catch exceptions and report unhealthy instead of crashing', async () => {
    const registry = DependencyRegistry.getInstance();

    const throwingCheck: HealthCheck = {
      name: 'buggyService',
      run: async () => {
        throw new Error('Unexpected crash');
      }
    };

    registry.register(throwingCheck);

    const result = await registry.runAll();
    expect(result.status).toBe('unhealthy');
    expect(result.services.buggyService.status).toBe('unhealthy');
    expect(result.services.buggyService.message).toBe('Unexpected crash');
  });
});
