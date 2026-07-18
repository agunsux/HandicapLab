// Central Reliability & SLO/SLI Compliance Evaluator
// Location: src/lib/reliability/evaluator.ts

import { SLO_THRESHOLDS } from './thresholds';
import { ReliabilityReport, SLIStatus } from './types';
import { HealthStatus, HealthCheckResult } from '../health/types';

export class ReliabilityEvaluator {
  public static evaluate(
    timestamp: string,
    services: Record<string, HealthCheckResult>
  ): ReliabilityReport {
    const slos: Record<string, SLIStatus> = {};
    const now = new Date(timestamp).getTime();

    // 1. Database SLO Check
    const dbCheck = services.database || { status: 'unhealthy', latency_ms: 0 };
    const dbSloMet = dbCheck.status === 'healthy' && dbCheck.latency_ms <= SLO_THRESHOLDS.database.latency_ms;
    slos.database = {
      name: 'database',
      status: dbCheck.status,
      latency_ms: dbCheck.latency_ms,
      threshold_ms: SLO_THRESHOLDS.database.latency_ms,
      current_value: dbCheck.latency_ms,
      threshold_value: SLO_THRESHOLDS.database.latency_ms,
      slo_met: dbSloMet
    };

    // 2. Prediction SLO Check
    const predCheck = services.prediction || { status: 'unhealthy', latency_ms: 0 };
    const lastPredTs = predCheck.details?.lastPredictionTimestamp;
    let predAge: number | null = null;
    if (lastPredTs) {
      predAge = Math.max(0, (now - new Date(lastPredTs).getTime()) / 1000);
    }
    const predSloMet = predCheck.status === 'healthy' && predAge !== null && predAge <= SLO_THRESHOLDS.prediction.age_seconds;
    slos.prediction = {
      name: 'prediction',
      status: predCheck.status,
      latency_ms: predCheck.latency_ms,
      current_value: predAge !== null ? Math.round(predAge) : null,
      threshold_value: SLO_THRESHOLDS.prediction.age_seconds,
      slo_met: predSloMet
    };

    // 3. Market SLO Check
    const marketCheck = services.market || { status: 'unhealthy', latency_ms: 0 };
    const lastMarketTs = marketCheck.details?.lastModified;
    let marketAge: number | null = null;
    if (lastMarketTs) {
      marketAge = Math.max(0, (now - new Date(lastMarketTs).getTime()) / 1000);
    }
    const marketSloMet = marketCheck.status === 'healthy' && marketAge !== null && marketAge <= SLO_THRESHOLDS.market.age_seconds;
    slos.market = {
      name: 'market',
      status: marketCheck.status,
      latency_ms: marketCheck.latency_ms,
      current_value: marketAge !== null ? Math.round(marketAge) : null,
      threshold_value: SLO_THRESHOLDS.market.age_seconds,
      slo_met: marketSloMet
    };

    // 4. Settlement SLO Check
    const settleCheck = services.settlement || { status: 'unhealthy', latency_ms: 0 };
    const lastSettleTs = settleCheck.details?.lastRunTime;
    let settleAge: number | null = null;
    if (lastSettleTs) {
      settleAge = Math.max(0, (now - new Date(lastSettleTs).getTime()) / 1000);
    }
    const settleSloMet = settleCheck.status === 'healthy' && settleAge !== null && settleAge <= SLO_THRESHOLDS.settlement.delay_seconds;
    slos.settlement = {
      name: 'settlement',
      status: settleCheck.status,
      latency_ms: settleCheck.latency_ms,
      current_value: settleAge !== null ? Math.round(settleAge) : null,
      threshold_value: SLO_THRESHOLDS.settlement.delay_seconds,
      slo_met: settleSloMet
    };

    // 5. Billing SLO Check
    const billingCheck = services.billing || { status: 'unhealthy', latency_ms: 0 };
    const billingSloMet = billingCheck.status === 'healthy' && billingCheck.latency_ms <= SLO_THRESHOLDS.billing.latency_ms;
    slos.billing = {
      name: 'billing',
      status: billingCheck.status,
      latency_ms: billingCheck.latency_ms,
      threshold_ms: SLO_THRESHOLDS.billing.latency_ms,
      current_value: billingCheck.latency_ms,
      threshold_value: SLO_THRESHOLDS.billing.latency_ms,
      slo_met: billingSloMet
    };

    // 6. Storage SLO Check
    const storageCheck = services.storage || { status: 'unhealthy', latency_ms: 0 };
    const storageSloMet = storageCheck.status === 'healthy' && storageCheck.latency_ms <= SLO_THRESHOLDS.storage.latency_ms;
    slos.storage = {
      name: 'storage',
      status: storageCheck.status,
      latency_ms: storageCheck.latency_ms,
      threshold_ms: SLO_THRESHOLDS.storage.latency_ms,
      current_value: storageCheck.latency_ms,
      threshold_value: SLO_THRESHOLDS.storage.latency_ms,
      slo_met: storageSloMet
    };

    // Calculate score (0-100) based on percentage of SLOs met
    const slosList = Object.values(slos);
    const metCount = slosList.filter(s => s.slo_met).length;
    const score = Math.round((metCount / slosList.length) * 100);

    // Calculate overall status based on central degradation rules
    let overallStatus: HealthStatus = 'healthy';
    let hasUnhealthy = false;
    let hasSloViolation = false;

    for (const key in services) {
      if (services[key].status === 'unhealthy') {
        hasUnhealthy = true;
      }
    }

    for (const key in slos) {
      if (!slos[key].slo_met) {
        hasSloViolation = true;
      }
    }

    if (hasUnhealthy) {
      overallStatus = 'unhealthy';
    } else if (hasSloViolation) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      score,
      timestamp,
      services,
      slos
    };
  }
}
