// Readiness Health Check Endpoint
// Location: src/app/api/health/ready/route.ts

import { NextResponse } from 'next/server';
import { DependencyRegistry } from '@/lib/health/registry';

export const dynamic = 'force-dynamic';

export async function GET() {
  const registry = DependencyRegistry.getInstance();
  const result = await registry.runAll();

  // Readiness depends on database and storage (env vars) being healthy
  const dbCheck = result.services.database;
  const storageCheck = result.services.storage;

  const isReady = dbCheck.status === 'healthy' && storageCheck.status === 'healthy';
  const status = isReady ? 200 : 503;

  return NextResponse.json({
    status: isReady ? 'ready' : 'not_ready',
    timestamp: result.timestamp,
    services: {
      database: dbCheck.status,
      storage: storageCheck.status
    }
  }, { status });
}
