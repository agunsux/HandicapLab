// EPIC 53 Stage C/F — Worldwide Scheduler Cron + Provider Health Dashboard
// Called 2-3x daily by Vercel Cron Jobs.
// Orchestrates the full worldwide prediction pipeline within quota limits.

import { NextResponse, type NextRequest } from 'next/server';
import { runWorldwideScheduler } from '@/lib/crons/worldwideScheduler';
import { getProviderHealth } from '@/lib/providers/quotaManager';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const mode = request.nextUrl.searchParams.get('mode') || 'full';

  if (mode === 'health') {
    const health = await getProviderHealth();
    return NextResponse.json({ success: true, data: health });
  }

  try {
    const result = await runWorldwideScheduler();
    return NextResponse.json({ success: true, result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Worldwide Cron] Fatal:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
