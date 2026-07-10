/**
 * Shared health score types.
 * Extracted from monitoring/types.ts and attribution/explainability types
 * to break circular dependency:
 *   attribution/types.ts ↔ monitoring/types.ts
 *   explainability/types.ts ↔ monitoring/types.ts
 *
 * This file has ZERO imports — it's the root of the dependency tree.
 */

export type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'INSUFFICIENT_DATA';

export interface HealthScoreBreakdown {
  score: number;                  // 0-100
  status: HealthStatus;
  components: {
    predictionQuality: number;    // weight: 25%
    calibration: number;          // weight: 20%
    decisionQuality: number;      // weight: 20%
    dataQuality: number;          // weight: 15%
    drift: number;                // weight: 10%
    latency: number;              // weight: 5%
    coverage: number;             // weight: 5%
  };
}