import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';
import { runHealthCheck } from '@/lib/services/healthChecker';

export async function GET(request: Request) {
  try {
    const secret = request.headers.get('x-admin-secret');
    if (secret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    // 1. Ingest/Fixture count last 24h
    const { count: fixturesCount, error: fixturesErr } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneDayAgo);

    if (fixturesErr) throw fixturesErr;

    // 2. Odds count last 24h
    const { count: oddsCount, error: oddsErr } = await supabase
      .from('odds_history')
      .select('*', { count: 'exact', head: true })
      .gte('timestamp', oneDayAgo);

    if (oddsErr) throw oddsErr;

    // 3. Signals generated in last 24h
    const { count: signalsGenerated, error: sigsErr } = await supabase
      .from('signals')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneDayAgo);

    if (sigsErr) throw sigsErr;

    // 4. Pending signals
    const { count: pendingSignals, error: pendingErr } = await supabase
      .from('signals')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (pendingErr) throw pendingErr;

    // 5. Settled signals count and CLV metrics
    const { data: settledSignals, error: settledErr } = await supabase
      .from('signals')
      .select('clv_percentage')
      .not('settled_at', 'is', null);

    if (settledErr) throw settledErr;

    const settledCount = settledSignals?.length || 0;
    const insufficientSample = settledCount < 50;

    let averageClv: number | null = null;
    if (!insufficientSample && settledSignals && settledSignals.length > 0) {
      let clvSum = 0;
      let clvCount = 0;
      for (const sig of settledSignals) {
        if (sig.clv_percentage !== null && sig.clv_percentage !== undefined) {
          clvSum += Number(sig.clv_percentage);
          clvCount++;
        }
      }
      averageClv = clvCount > 0 ? Number((clvSum / clvCount).toFixed(2)) : 0.0;
    }

    // 6. Provider status (run the health checker)
    const health = await runHealthCheck();

    return NextResponse.json({
      fixtures_count_last_24h: fixturesCount || 0,
      odds_count_last_24h: oddsCount || 0,
      signals_generated: signalsGenerated || 0,
      pending_signals: pendingSignals || 0,
      settled_signals: settledCount,
      average_clv: averageClv,
      averageClv: averageClv, // Provide both camelCase and snake_case for maximum safety
      provider_status: health.status,
      insufficient_sample: insufficientSample,
      status: insufficientSample ? 'insufficient_sample' : 'sufficient',
      requiredForClv: 50
    });

  } catch (error: any) {
    console.error('❌ Data Health API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}
