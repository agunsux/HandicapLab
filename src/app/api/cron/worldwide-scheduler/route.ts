// EPIC 53/54 — Worldwide Scheduler Cron (redirects to pipeline orchestrator)
// Maintains backward compatibility for existing cron jobs.
// Delegates to the Central Orchestrator.

import { NextResponse, type NextRequest } from 'next/server';
import { runOrchestrator } from '@/lib/crons/orchestrator';
import { getProviderHealth } from '@/lib/providers/quotaManager';
import { getQueueDepth } from '@/lib/crons/eventQueue';
import { getLeagueImportProgress } from '@/lib/crons/fixtureState';

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const mode = request.nextUrl.searchParams.get('mode') || 'full';

  if (mode === 'health') {
    const [health, queue, progress] = await Promise.all([
      getProviderHealth(),
      getQueueDepth(),
      getLeagueImportProgress(),
    ]);
    return NextResponse.json({ success: true, data: { providers: health, queue, leagueProgress: progress } });
  }

  try {
    const result = await runOrchestrator();
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
