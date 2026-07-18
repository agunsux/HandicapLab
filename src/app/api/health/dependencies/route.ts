// Dependencies Full Diagnostics & SLO Endpoint
// Location: src/app/api/health/dependencies/route.ts

import { NextResponse } from 'next/server';
import { DependencyRegistry } from '@/lib/health/registry';
import { ReliabilityEvaluator } from '@/lib/reliability/evaluator';

export const dynamic = 'force-dynamic';

export async function GET() {
  const registry = DependencyRegistry.getInstance();
  const healthResult = await registry.runAll();
  
  const report = ReliabilityEvaluator.evaluate(healthResult.timestamp, healthResult.services);

  const isHealthy = report.status !== 'unhealthy';
  const status = isHealthy ? 200 : 500;

  return NextResponse.json({
    status: report.status,
    score: report.score,
    timestamp: report.timestamp,
    version: 'v0.33.0-function-isolation',
    services: report.services,
    slos: report.slos
  }, { status });
}
