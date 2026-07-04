import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';
import { checkEnvironmentStatus } from '@/lib/utils/envValidator';

export const dynamic = 'force-dynamic';

export async function GET() {
  const envStatus = checkEnvironmentStatus();

  const criticalVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'API_FOOTBALL_KEY',
    'ODDSPAPI_KEY',
    'CRON_SECRET'
  ];
  const criticalMissing = envStatus.missing.filter(v => criticalVars.includes(v));
  const criticalMalformed = envStatus.malformed.filter(v => criticalVars.includes(v));
  const isEnvHealthy = criticalMissing.length === 0 && criticalMalformed.length === 0;

  const checks = {
    database: false,
    environment: isEnvHealthy,
    dbError: null as string | null
  };

  try {
    // Check Supabase DB connectivity by attempting a lightweight head select on matches
    const { error } = await supabase
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .limit(1);

    if (error) {
      checks.database = false;
      checks.dbError = `${error.code}: ${error.message}`;
    } else {
      checks.database = true;
    }
  } catch (dbErr: any) {
    console.error('[Health Endpoint] Database connectivity test failed:', dbErr);
    checks.database = false;
    checks.dbError = dbErr.message || 'Unknown DB error';
  }

  const isHealthy = checks.database && checks.environment;
  const status = isHealthy ? 200 : 500;

  const responseBody = {
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    checks: {
      database: checks.database ? 'healthy' : 'unhealthy',
      environment: envStatus,
      dbDetails: checks.dbError
    }
  };

  return NextResponse.json(responseBody, { status });
}
