// HandicapLab API - Provider Health Status overview
// Location: src/app/api/providers/health/route.ts

import { NextResponse } from 'next/server';
import { HealthMonitor } from '../../../../lib/data-platform/healthMonitor';

export async function GET() {
  try {
    const health = HealthMonitor.getFullStatus();
    return NextResponse.json({
      status: 'ok',
      providersHealth: health.map((h) => ({
        provider: h.providerName,
        isOnline: h.isOnline,
        latencyMs: h.latencyMs,
        lastHeartbeat: h.lastHeartbeat
      }))
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
