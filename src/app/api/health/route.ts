// Public Health Check & Reliability Summary Endpoint
// Location: src/app/api/health/route.ts

import { NextResponse } from 'next/server';
import { DependencyRegistry } from '@/lib/health/registry';
import { ReliabilityEvaluator } from '@/lib/reliability/evaluator';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const registry = DependencyRegistry.getInstance();
  const healthResult = await registry.runAll();
  
  const report = ReliabilityEvaluator.evaluate(healthResult.timestamp, healthResult.services);

  const dbCheck = report.services.database || { status: 'unhealthy' };
  const storageCheck = report.services.storage || { status: 'unhealthy' };
  const predictionCheck = report.services.prediction;

  const isHealthy = dbCheck.status === 'healthy' && storageCheck.status === 'healthy';
  const status = isHealthy ? 200 : 500;

  const responseBody = {
    status: isHealthy ? 'healthy' : 'unhealthy',
    canonicalDomain: 'salmo.dev',
    score: report.score,
    timestamp: report.timestamp,
    services: report.services,
    slos: report.slos,
    // Maintain backward compatibility for older tooling/deployment checks
    checks: {
      database: dbCheck.status === 'healthy' ? 'healthy' : 'unhealthy',
      prediction: predictionCheck?.status || 'unknown',
      environment: {
        missing: storageCheck.status === 'unhealthy' ? [storageCheck.message || ''] : [],
        malformed: []
      },
      dbDetails: dbCheck.message || null
    }
  };

  return NextResponse.json(responseBody, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Data-Source': 'live-production',
      'X-Canonical-Domain': 'salmo.dev',
    }
  });
}
