import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';
import { LEAGUE_REGISTRY } from '@/lib/crons/leagueRegistry';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks = {
    database: false,
    lastCronRun: null as string | null,
    activeCompetitions: 0
  };

  try {
    // 1. Check Supabase DB connectivity by attempting a lightweight head select on matches
    const { data, error } = await supabase
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .limit(1);

    checks.database = !error;
  } catch (dbErr) {
    console.error('[Health Endpoint] Database connectivity test failed:', dbErr);
    checks.database = false;
  }

  try {
    // 2. Count active configurations in registry
    checks.activeCompetitions = LEAGUE_REGISTRY.filter(
      (l) => l.enabled && (l.status === 'ACTIVE' || l.status === 'BETA')
    ).length;
  } catch (regErr) {
    console.error('[Health Endpoint] Registry count failed:', regErr);
  }

  try {
    // 3. Query the last cron run timestamp from cron_runs table
    const { data: lastRun, error: runErr } = await supabase
      .from('cron_runs')
      .select('ran_at')
      .order('ran_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!runErr && lastRun) {
      checks.lastCronRun = lastRun.ran_at;
    }
  } catch (cronErr) {
    console.error('[Health Endpoint] Cron runs check failed:', cronErr);
  }

  const isHealthy = checks.database;
  const status = isHealthy ? 200 : 500;

  return NextResponse.json(checks, { status });
}
