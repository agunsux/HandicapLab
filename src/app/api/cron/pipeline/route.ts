// EPIC 54 — Autonomous Pipeline Cron Route
// Called 4x daily by Vercel Cron Jobs.
// Triggers the Central Orchestrator which coordinates all pipeline stages.
// The orchestrator handles recovery, queue processing, and quota management.
// If a run is missed (deploy, outage), the next run recovers via recoverStuckEvents.

import { NextResponse, type NextRequest } from 'next/server';
import { runOrchestrator } from '@/lib/crons/orchestrator';
import { getProviderHealth } from '@/lib/providers/quotaManager';
import { getQueueDepth } from '@/lib/crons/eventQueue';
import { getLeagueImportProgress } from '@/lib/crons/fixtureState';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const mode = request.nextUrl.searchParams.get('mode') || 'full';

  // Read-only modes (no pipeline execution)
  if (mode === 'health') {
    const [health, queue, progress] = await Promise.all([
      getProviderHealth(),
      getQueueDepth(),
      getLeagueImportProgress(),
    ]);
    return NextResponse.json({ success: true, data: { providers: health, queue, leagueProgress: progress } });
  }

  if (mode === 'queue') {
    const queue = await getQueueDepth();
    return NextResponse.json({ success: true, data: queue });
  }

  // Full pipeline run
  try {
    const report = await runOrchestrator();
    return NextResponse.json({ success: true, result: report });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Pipeline Cron] Fatal:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
