// Readiness Health Check & SLO Verification Endpoint
// Location: src/app/api/health/ready/route.ts

import { NextResponse } from 'next/server';
import { DependencyRegistry } from '@/lib/health/registry';
import { ReliabilityEvaluator } from '@/lib/reliability/evaluator';

export const dynamic = 'force-dynamic';

export async function GET() {
  const registry = DependencyRegistry.getInstance();
  const healthResult = await registry.runAll();
  
  const report = ReliabilityEvaluator.evaluate(healthResult.timestamp, healthResult.services);

  const dbSlo = report.slos.database;
  const storageSlo = report.slos.storage;

  const isReady = dbSlo.slo_met && storageSlo.slo_met;
  const status = isReady ? 200 : 503;

  return NextResponse.json({
    status: isReady ? 'ready' : 'not_ready',
    timestamp: report.timestamp,
    services: {
      database: dbSlo.status,
      storage: storageSlo.status
    },
    slo_compliance: {
      database_slo_met: dbSlo.slo_met,
      storage_slo_met: storageSlo.slo_met
    }
  }, { status });
}
