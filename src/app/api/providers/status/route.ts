// HandicapLab API - Get Provider Status & Metrics
// Location: src/app/api/providers/status/route.ts

import { NextResponse } from 'next/server';
import { HealthMonitor } from '../../../../lib/data-platform/healthMonitor';
import { ObservabilityRegistry } from '../../../../lib/data-platform/observability';

export async function GET() {
  try {
    const health = HealthMonitor.getFullStatus();
    const metrics = ObservabilityRegistry.getMetrics();
    return NextResponse.json({
      status: 'operational',
      timestamp: new Date().toISOString(),
      healthOverview: health,
      metrics
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
// 
