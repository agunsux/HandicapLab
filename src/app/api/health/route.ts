import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';
import { apiFootballClient } from '@/lib/apis/apifootball';
import { oddsApiClient } from '@/lib/apis/oddspapi';

export async function GET() {
  const healthStatus: any = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      database: 'unknown',
      apiFootball: 'unknown',
      oddsApi: 'unknown'
    },
    latestSignal: null
  };

  try {
    // 1. Check Database Health
    const { data: dbCheck, error: dbErr } = await supabase
      .from('signals')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1);

    if (dbErr) {
      healthStatus.status = 'degraded';
      healthStatus.checks.database = `error: ${dbErr.message}`;
    } else {
      healthStatus.checks.database = 'healthy';
      if (dbCheck && dbCheck.length > 0) {
        healthStatus.latestSignal = dbCheck[0].created_at;
      }
    }

    // 2. Check API Football Connectivity (Fast ping without key check bypass where possible)
    try {
      const start = Date.now();
      // Try to fetch fixtures for EPL 2026 as a connectivity check
      await apiFootballClient.getFixtures(39, 2026);
      healthStatus.checks.apiFootball = `healthy (${Date.now() - start}ms)`;
    } catch (err: any) {
      healthStatus.status = 'degraded';
      healthStatus.checks.apiFootball = `error: ${err.message || err}`;
    }

    // 3. Check The Odds API Connectivity
    try {
      const start = Date.now();
      await oddsApiClient.getSports();
      healthStatus.checks.oddsApi = `healthy (${Date.now() - start}ms)`;
    } catch (err: any) {
      healthStatus.status = 'degraded';
      healthStatus.checks.oddsApi = `error: ${err.message || err}`;
    }

    const statusCode = healthStatus.status === 'healthy' ? 200 : 500;
    return NextResponse.json(healthStatus, { status: statusCode });
  } catch (error: any) {
    console.error('[Health Endpoint Fatal Error]:', error);
    return NextResponse.json({
      status: 'unhealthy',
      error: error.message || 'Internal Server Error'
    }, { status: 500 });
  }
}
