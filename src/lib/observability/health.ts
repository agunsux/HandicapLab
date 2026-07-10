/**
 * HandicapLab Health Monitoring
 * ==============================
 * Reusable health check framework.
 *
 * Every subsystem exposes:
 *   healthy | degraded | critical | unknown
 *
 * NO runtime behaviour is changed. Health is purely diagnostic.
 */

export type HealthStatus = 'healthy' | 'degraded' | 'critical' | 'unknown';

export interface HealthCheckResult {
  status: HealthStatus;
  component: string;
  message: string;
  lastCheck: string;
  durationMs: number;
  metadata?: Record<string, unknown>;
}

export type HealthCheckFn = () => Promise<HealthCheckResult>;

class HealthRegistry {
  private checks: Map<string, HealthCheckFn> = new Map();
  private results: Map<string, HealthCheckResult> = new Map();

  register(name: string, check: HealthCheckFn): void {
    this.checks.set(name, check);
  }

  async runCheck(name: string): Promise<HealthCheckResult> {
    const check = this.checks.get(name);
    if (!check) {
      const result: HealthCheckResult = {
        status: 'unknown',
        component: name,
        message: 'No health check registered',
        lastCheck: new Date().toISOString(),
        durationMs: 0,
      };
      this.results.set(name, result);
      return result;
    }
    try {
      const start = Date.now();
      const result = await check();
      result.lastCheck = new Date().toISOString();
      result.durationMs = Date.now() - start;
      this.results.set(name, result);
      return result;
    } catch (err) {
      const result: HealthCheckResult = {
        status: 'critical',
        component: name,
        message: err instanceof Error ? err.message : String(err),
        lastCheck: new Date().toISOString(),
        durationMs: Date.now() - (this.results.get(name)?.durationMs ?? 0),
      };
      this.results.set(name, result);
      return result;
    }
  }

  async runAll(): Promise<HealthCheckResult[]> {
    const names = Array.from(this.checks.keys());
    return Promise.all(names.map((name) => this.runCheck(name)));
  }

  getResult(name: string): HealthCheckResult | undefined {
    return this.results.get(name);
  }

  getAllResults(): HealthCheckResult[] {
    return Array.from(this.results.values());
  }

  getOverallStatus(): HealthStatus {
    const results = Array.from(this.results.values());
    if (results.length === 0) return 'unknown';
    if (results.some((r) => r.status === 'critical')) return 'critical';
    if (results.some((r) => r.status === 'degraded')) return 'degraded';
    if (results.every((r) => r.status === 'healthy')) return 'healthy';
    return 'degraded';
  }
}

export const healthRegistry = new HealthRegistry();