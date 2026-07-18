// Centralized Dependency Registry for HandicapLab Health Checks
// Location: src/lib/health/registry.ts

import { HealthCheck, HealthCheckResult, HealthStatus } from './types';
import { runWithTimeout } from './utils';
import { DatabaseCheck } from './checks/database';
import { MarketCheck } from './checks/market';
import { PredictionCheck } from './checks/prediction';
import { SettlementCheck } from './checks/settlement';
import { BillingCheck } from './checks/billing';
import { StorageCheck } from './checks/storage';

export class DependencyRegistry {
  private static instance: DependencyRegistry | null = null;
  private checks: Map<string, HealthCheck> = new Map();

  private constructor() {}

  public static getInstance(): DependencyRegistry {
    if (!this.instance) {
      this.instance = new DependencyRegistry();
      this.instance.register(new DatabaseCheck());
      this.instance.register(new MarketCheck());
      this.instance.register(new PredictionCheck());
      this.instance.register(new SettlementCheck());
      this.instance.register(new BillingCheck());
      this.instance.register(new StorageCheck());
    }
    return this.instance;
  }

  public register(check: HealthCheck) {
    this.checks.set(check.name, check);
  }

  public clear() {
    this.checks.clear();
  }

  public getChecks(): HealthCheck[] {
    return Array.from(this.checks.values());
  }

  public async runAll(timeoutMs: number = 3000): Promise<{
    status: HealthStatus;
    timestamp: string;
    services: Record<string, HealthCheckResult>;
  }> {
    const results: Record<string, HealthCheckResult> = {};
    const checkPromises = Array.from(this.checks.entries()).map(async ([name, check]) => {
      results[name] = await runWithTimeout(name, () => check.run(), timeoutMs);
    });

    await Promise.all(checkPromises);

    // Determine overall status
    let overallStatus: HealthStatus = 'healthy';
    let unhealthyCount = 0;
    let degradedCount = 0;

    for (const name in results) {
      if (results[name].status === 'unhealthy') {
        unhealthyCount++;
      } else if (results[name].status === 'degraded') {
        degradedCount++;
      }
    }

    if (unhealthyCount > 0) {
      overallStatus = 'unhealthy';
    } else if (degradedCount > 0) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: results,
    };
  }
}
