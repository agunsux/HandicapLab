import { NextResponse } from 'next/server';
import { ProviderOrchestrator } from '@/lib/providers/orchestrator';
import { shouldDeferProviderWork } from '@/lib/crons/egressMode';
import { enqueueEgressJob, utcHourKey } from '@/lib/crons/egressQueue';

// Vercel Cron Job C - Every 30 mins
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Worker mode: never call API-Football from Vercel. Enqueue an idempotent job.
    if (shouldDeferProviderWork(request)) {
      const eventId = await enqueueEgressJob({ job: 'enrichment', scope: utcHourKey() });
      return NextResponse.json({ success: true, mode: 'worker', job: 'enrichment', enqueued: eventId });
    }

    const orchestrator = new ProviderOrchestrator();
    const result = await orchestrator.runStage3Enrichment();
    
    // In a real pipeline, stage 4 prediction generation runs after enrichment
    await orchestrator.runStage4PredictionGeneration();
    
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
