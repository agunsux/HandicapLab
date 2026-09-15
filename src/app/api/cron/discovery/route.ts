import { NextResponse } from 'next/server';
import { ProviderOrchestrator } from '@/lib/providers/orchestrator';
import { shouldDeferProviderWork } from '@/lib/crons/egressMode';
import { enqueueEgressJob, utcDayKey } from '@/lib/crons/egressQueue';

// Vercel Cron Job A - 00:10 UTC
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Worker mode: never call API-Football from Vercel. Enqueue an idempotent job.
    if (shouldDeferProviderWork(request)) {
      const eventId = await enqueueEgressJob({ job: 'discovery', scope: utcDayKey() });
      return NextResponse.json({ success: true, mode: 'worker', job: 'discovery', enqueued: eventId });
    }

    const orchestrator = new ProviderOrchestrator();
    const result = await orchestrator.runStage1Discovery();
    
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
