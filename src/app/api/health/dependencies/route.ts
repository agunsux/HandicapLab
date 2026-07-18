// Dependencies Health Check Endpoint
// Location: src/app/api/health/dependencies/route.ts

import { NextResponse } from 'next/server';
import { DependencyRegistry } from '@/lib/health/registry';

export const dynamic = 'force-dynamic';

export async function GET() {
  const registry = DependencyRegistry.getInstance();
  const result = await registry.runAll();

  const isHealthy = result.status !== 'unhealthy';
  const status = isHealthy ? 200 : 500;

  return NextResponse.json({
    status: result.status,
    timestamp: result.timestamp,
    version: 'v0.33.0-function-isolation',
    services: result.services
  }, { status });
}
