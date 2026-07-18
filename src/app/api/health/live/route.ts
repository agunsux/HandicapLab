// Liveness Health Check Endpoint
// Location: src/app/api/health/live/route.ts

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
}
