// Health Check Utility functions
// Location: src/lib/health/utils.ts

import { HealthCheckResult } from './types';

export async function runWithTimeout(
  checkName: string,
  checkFn: () => Promise<any>,
  timeoutMs: number = 3000
): Promise<HealthCheckResult> {
  const start = Date.now();
  const timestamp = new Date().toISOString();

  try {
    const result = await Promise.race([
      checkFn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout of ${timeoutMs}ms exceeded checking ${checkName}`)), timeoutMs)
      ),
    ]);

    return {
      status: result.status || 'healthy',
      latency_ms: Date.now() - start,
      message: result.message || undefined,
      details: result.details || undefined,
      timestamp,
    };
  } catch (err: any) {
    return {
      status: 'unhealthy',
      latency_ms: Date.now() - start,
      message: err.message || String(err),
      timestamp,
    };
  }
}
