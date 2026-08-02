import { NextResponse } from 'next/server';
import { ProviderOrchestrator } from '@/lib/providers/orchestrator';

// Vercel Cron Job B - 00:20 UTC
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orchestrator = new ProviderOrchestrator();
    const result = await orchestrator.runStage2OddsCollection();
    
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
