// Health Check Types definitions
// Location: src/lib/health/types.ts

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface HealthCheckResult {
  status: HealthStatus;
  latency_ms: number;
  message?: string;
  timestamp: string;
  details?: Record<string, any>;
}

export interface HealthCheck {
  name: string;
  run(): Promise<Omit<HealthCheckResult, 'latency_ms' | 'timestamp'>>;
}
