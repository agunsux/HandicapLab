// EPIC 54/55 — Autonomous Pipeline Cron Route
// Called 4x daily by Vercel Cron Jobs (06:00, 12:00, 18:00, 22:00 UTC).
// Triggers the Central Orchestrator which coordinates all pipeline stages.
// Phase 0 (recovery) ensures no work is lost on restart/deploy.

import { NextResponse, type NextRequest } from 'next/server';
import { runOrchestrator } from '@/lib/crons/orchestrator';
import { getProviderHealth } from '@/lib/providers/quotaManager';
import { getQueueDepth } from '@/lib/crons/eventQueue';
import { getLeagueImportProgress } from '@/lib/crons/fixtureState';

export const maxDuration = 300;

const WINDOW_LABELS: Record<number, string> = {
  6: 'morning',
  12: 't120_prelineup',
  18: 't60_lineups',
  22: 'postmatch',
};

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const mode = request.nextUrl.searchParams.get('mode') || 'full';
  const hour = new Date().getUTCHours();
  const windowLabel = WINDOW_LABELS[hour] ?? `hour_${hour}`;

  console.log(`[Pipeline Cron] Triggered at UTC ${hour}:00 (window: ${windowLabel})`);

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

  try {
    const report = await runOrchestrator();
    return NextResponse.json({ success: true, window: windowLabel, result: report });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Pipeline Cron] Fatal:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
