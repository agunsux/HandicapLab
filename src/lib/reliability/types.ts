// Reliability & SLO/SLI Type Definitions
// Location: src/lib/reliability/types.ts

import { HealthStatus, HealthCheckResult } from '../health/types';

export interface SLIStatus {
  name: string;
  status: HealthStatus;
  latency_ms?: number;
  threshold_ms?: number;
  current_value?: any;
  threshold_value?: any;
  slo_met: boolean;
}

export interface ReliabilityReport {
  status: HealthStatus;
  score: number;
  timestamp: string;
  services: Record<string, HealthCheckResult>;
  slos: Record<string, SLIStatus>;
}
