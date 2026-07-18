// Public Health Check Endpoint (Backward Compatible)
// Location: src/app/api/health/route.ts

import { NextResponse } from 'next/server';
import { DependencyRegistry } from '@/lib/health/registry';

export const dynamic = 'force-dynamic';

export async function GET() {
  const registry = DependencyRegistry.getInstance();
  const result = await registry.runAll();

  const dbCheck = result.services.database;
  const storageCheck = result.services.storage;

  const isHealthy = dbCheck.status === 'healthy' && storageCheck.status === 'healthy';
  const status = isHealthy ? 200 : 500;

  const responseBody = {
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: result.timestamp,
    checks: {
      database: dbCheck.status === 'healthy' ? 'healthy' : 'unhealthy',
      environment: {
        missing: storageCheck.status === 'unhealthy' ? [storageCheck.message || ''] : [],
        malformed: []
      },
      dbDetails: dbCheck.message || null
    }
  };

  return NextResponse.json(responseBody, { status });
}
